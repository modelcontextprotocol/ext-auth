/**
 * Cross-App Access Fetch Middleware
 *
 * Implements Enterprise-Managed Authorization for MCP as a fetch middleware.
 * Automatically handles 401 responses by:
 * 1. Discovering the authorization server
 * 2. Exchanging ID Token for ID-JAG
 * 3. Exchanging ID-JAG for access token
 * 4. Retrying the request with the access token
 *
 * Based on the specification at:
 * https://github.com/modelcontextprotocol/ext-auth/blob/main/specification/draft/enterprise-managed-authorization.mdx
 */

import type {
  CrossAppAccessConfig,
  ProtectedResourceMetadata,
  AuthorizationServerMetadata,
  TokenExchangeRequest,
  TokenExchangeResponse,
  JwtBearerGrantRequest,
  AccessTokenResponse,
} from './types.js';

import {
  parseWwwAuthenticate,
  buildFormData,
  discoverAuthorizationServerMetadata,
  getResourceUrl,
  cloneRequestWithAuth,
  isUnauthorized,
  extractOAuthError,
} from './utils.js';

/**
 * Cross-App Access Middleware
 *
 * Wraps the fetch function to automatically handle enterprise-managed authorization
 */
export class CrossAppAccessMiddleware {
  private config: CrossAppAccessConfig;
  private fetchFn: typeof fetch;
  private tokenCache: Map<string, { token: string; expiresAt: number }>;
  private pendingTokenRequests: Map<string, Promise<string>>;

  constructor(config: CrossAppAccessConfig) {
    this.config = config;
    this.fetchFn = config.fetch || fetch;
    this.tokenCache = new Map();
    this.pendingTokenRequests = new Map();
  }

  /**
   * Fetch wrapper that handles 401 responses with cross-app access flow
   *
   * @param input - Request URL or Request object
   * @param init - Request init options
   * @returns Response
   */
  public async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init);

    // Try to get cached token first
    const resourceUrl = getResourceUrl(request);
    const cachedToken = await this.getCachedToken(resourceUrl);

    if (cachedToken) {
      const requestWithAuth = cloneRequestWithAuth(request, cachedToken);
      const response = await this.fetchFn(requestWithAuth);

      // If the cached token works, return the response
      if (!isUnauthorized(response)) {
        return response;
      }

      // Cached token is invalid, clear it and continue
      this.tokenCache.delete(resourceUrl);
    }

    // Make the initial request without a token (or if cached token failed)
    const response = await this.fetchFn(request);

    // If not a 401, return the response
    if (!isUnauthorized(response)) {
      return response;
    }

    // Handle 401 by acquiring a token and retrying
    return this.handleUnauthorized(request, response);
  }

  /**
   * Handle a 401 Unauthorized response
   *
   * @param request - The original request
   * @param response - The 401 response
   * @returns New response after acquiring token and retrying
   */
  private async handleUnauthorized(request: Request, response: Response): Promise<Response> {
    // Parse WWW-Authenticate header
    const wwwAuth = response.headers.get('WWW-Authenticate');
    if (!wwwAuth) {
      // No WWW-Authenticate header, can't proceed
      return response;
    }

    const challenge = parseWwwAuthenticate(wwwAuth);

    if (challenge.scheme !== 'Bearer') {
      // Only support Bearer authentication
      return response;
    }

    if (!challenge.resource_metadata) {
      throw new Error('WWW-Authenticate header missing resource_metadata URL');
    }

    // Acquire access token for this resource
    const resourceUrl = getResourceUrl(request);
    const accessToken = await this.acquireAccessToken(resourceUrl, challenge.resource_metadata, challenge.scope);

    // Retry the request with the access token
    const requestWithAuth = cloneRequestWithAuth(request, accessToken);
    return this.fetchFn(requestWithAuth);
  }

  /**
   * Acquire an access token for a resource
   * Ensures only one token acquisition is in flight per resource
   *
   * @param resourceUrl - The resource URL
   * @param metadataUrl - The protected resource metadata URL
   * @param scope - Optional scope to request
   * @returns Access token
   */
  private async acquireAccessToken(
    resourceUrl: string,
    metadataUrl: string,
    scope?: string
  ): Promise<string> {
    // Check if a token request is already in progress for this resource
    const pending = this.pendingTokenRequests.get(resourceUrl);
    if (pending) {
      return pending;
    }

    // Start a new token acquisition
    const tokenPromise = this.performTokenAcquisition(resourceUrl, metadataUrl, scope);
    this.pendingTokenRequests.set(resourceUrl, tokenPromise);

    try {
      const token = await tokenPromise;
      return token;
    } finally {
      this.pendingTokenRequests.delete(resourceUrl);
    }
  }

  /**
   * Perform the full token acquisition flow
   *
   * @param resourceUrl - The resource URL
   * @param metadataUrl - The protected resource metadata URL
   * @param scope - Optional scope to request
   * @returns Access token
   */
  private async performTokenAcquisition(
    resourceUrl: string,
    metadataUrl: string,
    scope?: string
  ): Promise<string> {
    // Step 1: Fetch protected resource metadata
    const metadata = await this.fetchProtectedResourceMetadata(metadataUrl);

    // Step 2: Select an authorization server
    if (!metadata.authorization_servers || metadata.authorization_servers.length === 0) {
      throw new Error('No authorization servers found in protected resource metadata');
    }

    const authServerIssuer = metadata.authorization_servers[0];

    // Step 3: Discover authorization server metadata
    const authServerMetadata = await discoverAuthorizationServerMetadata(authServerIssuer, this.fetchFn);

    if (!authServerMetadata.token_endpoint) {
      throw new Error('Authorization server metadata missing token_endpoint');
    }

    // Step 4: Perform token exchange (ID Token -> ID-JAG)
    const idJag = await this.performTokenExchange(
      authServerIssuer,
      metadata.resource,
      authServerMetadata.token_endpoint,
      scope
    );

    // Step 5: Perform JWT bearer grant (ID-JAG -> Access Token)
    const accessToken = await this.performJwtBearerGrant(idJag, authServerMetadata.token_endpoint);

    return accessToken;
  }

  /**
   * Fetch protected resource metadata
   *
   * @param metadataUrl - The metadata URL from WWW-Authenticate header
   * @returns Protected resource metadata
   */
  private async fetchProtectedResourceMetadata(metadataUrl: string): Promise<ProtectedResourceMetadata> {
    const response = await this.fetchFn(metadataUrl);

    if (!response.ok) {
      const error = await extractOAuthError(response);
      throw new Error(`Failed to fetch protected resource metadata: ${error}`);
    }

    return await response.json();
  }

  /**
   * Perform token exchange to get ID-JAG
   * Step in the flow: ID Token -> ID-JAG
   *
   * @param audience - The authorization server issuer URL
   * @param resource - The resource identifier
   * @param tokenEndpoint - The IdP's token endpoint
   * @param scope - Optional scope
   * @returns ID-JAG (Identity Assertion JWT Authorization Grant)
   */
  private async performTokenExchange(
    audience: string,
    resource: string,
    tokenEndpoint: string,
    scope?: string
  ): Promise<string> {
    // Get the ID Token from the config
    const idToken = await this.config.getIdToken();

    // Build token exchange request
    const requestBody: TokenExchangeRequest = {
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requested_token_type: 'urn:ietf:params:oauth:token-type:id-jag',
      audience,
      resource,
      subject_token: idToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      client_id: this.config.idpClientId,
      client_secret: this.config.idpClientSecret,
    };

    if (scope) {
      requestBody.scope = scope;
    }

    // Make token exchange request to IdP
    const response = await this.fetchFn(this.config.idpIssuerUrl + '/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormData(requestBody as unknown as Record<string, string>),
    });

    if (!response.ok) {
      const error = await extractOAuthError(response);
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenResponse: TokenExchangeResponse = await response.json();

    // Validate the response
    if (tokenResponse.issued_token_type !== 'urn:ietf:params:oauth:token-type:id-jag') {
      throw new Error(`Unexpected token type: ${tokenResponse.issued_token_type}`);
    }

    return tokenResponse.access_token; // This is actually the ID-JAG
  }

  /**
   * Perform JWT bearer grant to get access token
   * Step in the flow: ID-JAG -> Access Token
   *
   * @param idJag - The ID-JAG from token exchange
   * @param tokenEndpoint - The MCP authorization server's token endpoint
   * @returns Access token
   */
  private async performJwtBearerGrant(idJag: string, tokenEndpoint: string): Promise<string> {
    // Build JWT bearer grant request
    const requestBody: JwtBearerGrantRequest = {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: idJag,
      client_id: this.config.mcpClientId,
      client_secret: this.config.mcpClientSecret,
    };

    // Make JWT bearer grant request to MCP authorization server
    const response = await this.fetchFn(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormData(requestBody as unknown as Record<string, string>),
    });

    if (!response.ok) {
      const error = await extractOAuthError(response);
      throw new Error(`JWT bearer grant failed: ${error}`);
    }

    const tokenResponse: AccessTokenResponse = await response.json();

    // Cache the token
    const expiresIn = tokenResponse.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000 - 60000; // 1 minute buffer

    this.tokenCache.set(getResourceUrl(new Request(tokenEndpoint)), {
      token: tokenResponse.access_token,
      expiresAt,
    });

    // Call the callback if provided
    if (this.config.onAccessTokenReceived) {
      await this.config.onAccessTokenReceived(tokenResponse);
    }

    return tokenResponse.access_token;
  }

  /**
   * Get a cached token for a resource
   *
   * @param resourceUrl - The resource URL
   * @returns Cached token or null
   */
  private async getCachedToken(resourceUrl: string): Promise<string | null> {
    // Check user-provided cache first
    if (this.config.getCachedAccessToken) {
      const cached = await this.config.getCachedAccessToken(resourceUrl);
      if (cached) {
        return cached;
      }
    }

    // Check internal cache
    const cached = this.tokenCache.get(resourceUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    return null;
  }

  /**
   * Clear all cached tokens
   */
  public clearTokenCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Clear cached token for a specific resource
   *
   * @param resourceUrl - The resource URL
   */
  public clearTokenForResource(resourceUrl: string): void {
    this.tokenCache.delete(resourceUrl);
  }
}

/**
 * Create a fetch function with cross-app access middleware
 *
 * @param config - Middleware configuration
 * @returns Fetch function with middleware applied
 */
export function createCrossAppAccessFetch(config: CrossAppAccessConfig): typeof fetch {
  const middleware = new CrossAppAccessMiddleware(config);
  return (input: RequestInfo | URL, init?: RequestInit) => middleware.fetch(input, init);
}
