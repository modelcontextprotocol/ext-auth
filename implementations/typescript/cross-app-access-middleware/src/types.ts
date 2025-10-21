/**
 * Type definitions for Cross-App Access Middleware
 * Implements Enterprise-Managed Authorization for MCP
 *
 * Based on the specification at:
 * https://github.com/modelcontextprotocol/ext-auth/blob/main/specification/draft/enterprise-managed-authorization.mdx
 */

/**
 * Configuration for the Cross-App Access Middleware
 */
export interface CrossAppAccessConfig {
  /**
   * The ID Token or SAML assertion obtained from the enterprise IdP during SSO
   * This is used as the subject token in the token exchange request
   */
  getIdToken: () => Promise<string>;

  /**
   * The issuer URL of the enterprise Identity Provider
   */
  idpIssuerUrl: string;

  /**
   * Client ID registered with the IdP
   */
  idpClientId: string;

  /**
   * Client secret for authenticating with the IdP (if required)
   */
  idpClientSecret?: string;

  /**
   * Client ID registered with the MCP Server's authorization server
   */
  mcpClientId: string;

  /**
   * Client secret for authenticating with the MCP Server's authorization server
   */
  mcpClientSecret?: string;

  /**
   * Optional: Custom fetch implementation (defaults to global fetch)
   */
  fetch?: typeof fetch;

  /**
   * Optional: Callback for token storage/caching
   */
  onAccessTokenReceived?: (token: AccessTokenResponse) => void | Promise<void>;

  /**
   * Optional: Get cached access token for a resource
   */
  getCachedAccessToken?: (resourceUrl: string) => Promise<string | null>;
}

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 */
export interface ProtectedResourceMetadata {
  /**
   * The protected resource identifier
   */
  resource: string;

  /**
   * Authorization servers that can issue tokens for this resource
   */
  authorization_servers: string[];

  /**
   * Bearer token methods supported
   */
  bearer_methods_supported?: string[];

  /**
   * Resource signing algorithms supported
   */
  resource_signing_alg_values_supported?: string[];

  /**
   * Resource documentation URL
   */
  resource_documentation?: string;
}

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 */
export interface AuthorizationServerMetadata {
  /**
   * The authorization server's issuer identifier
   */
  issuer: string;

  /**
   * URL of the token endpoint
   */
  token_endpoint: string;

  /**
   * Grant types supported
   */
  grant_types_supported?: string[];

  /**
   * Token endpoint authentication methods supported
   */
  token_endpoint_auth_methods_supported?: string[];

  /**
   * Token endpoint signing algorithms supported
   */
  token_endpoint_auth_signing_alg_values_supported?: string[];

  /**
   * Response types supported
   */
  response_types_supported?: string[];

  /**
   * JWKS URI for public keys
   */
  jwks_uri?: string;
}

/**
 * Token Exchange Request (RFC 8693)
 */
export interface TokenExchangeRequest {
  /**
   * Must be "urn:ietf:params:oauth:grant-type:token-exchange"
   */
  grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange';

  /**
   * The type of token being requested
   * Must be "urn:ietf:params:oauth:token-type:id-jag"
   */
  requested_token_type: 'urn:ietf:params:oauth:token-type:id-jag';

  /**
   * The issuer URL of the MCP Server's authorization server
   */
  audience: string;

  /**
   * The resource identifier of the MCP Server
   */
  resource: string;

  /**
   * Optional scopes being requested
   */
  scope?: string;

  /**
   * The ID Token or SAML assertion from the IdP
   */
  subject_token: string;

  /**
   * The type of the subject token
   * "urn:ietf:params:oauth:token-type:id_token" for OIDC
   * "urn:ietf:params:oauth:token-type:saml2" for SAML
   */
  subject_token_type: 'urn:ietf:params:oauth:token-type:id_token' | 'urn:ietf:params:oauth:token-type:saml2';

  /**
   * Client ID (if using client authentication)
   */
  client_id?: string;

  /**
   * Client secret (if using client secret authentication)
   */
  client_secret?: string;
}

/**
 * Token Exchange Response (RFC 8693)
 */
export interface TokenExchangeResponse {
  /**
   * The type of token issued
   * Should be "urn:ietf:params:oauth:token-type:id-jag"
   */
  issued_token_type: string;

  /**
   * The Identity Assertion JWT Authorization Grant (ID-JAG)
   * Note: Despite the name, this is NOT an OAuth access token
   */
  access_token: string;

  /**
   * Token type (should be "N_A" as this is not an OAuth access token)
   */
  token_type: string;

  /**
   * Granted scopes
   */
  scope?: string;

  /**
   * Lifetime in seconds
   */
  expires_in?: number;
}

/**
 * JWT Authorization Grant Request (RFC 7523)
 */
export interface JwtBearerGrantRequest {
  /**
   * Must be "urn:ietf:params:oauth:grant-type:jwt-bearer"
   */
  grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer';

  /**
   * The ID-JAG obtained from token exchange
   */
  assertion: string;

  /**
   * Client ID (if using client authentication)
   */
  client_id?: string;

  /**
   * Client secret (if using client secret authentication)
   */
  client_secret?: string;
}

/**
 * Access Token Response (RFC 6749)
 */
export interface AccessTokenResponse {
  /**
   * The access token issued by the authorization server
   */
  access_token: string;

  /**
   * The type of token (typically "Bearer")
   */
  token_type: string;

  /**
   * Lifetime in seconds
   */
  expires_in?: number;

  /**
   * Granted scopes
   */
  scope?: string;

  /**
   * Refresh token (if issued)
   */
  refresh_token?: string;
}

/**
 * OAuth 2.0 Error Response (RFC 6749 Section 5.2)
 */
export interface OAuthErrorResponse {
  /**
   * Error code
   */
  error: string;

  /**
   * Human-readable error description
   */
  error_description?: string;

  /**
   * URI with information about the error
   */
  error_uri?: string;
}

/**
 * WWW-Authenticate header challenge parameters
 */
export interface WwwAuthenticateChallenge {
  /**
   * Authentication scheme (should be "Bearer")
   */
  scheme: string;

  /**
   * Realm
   */
  realm?: string;

  /**
   * Scope required
   */
  scope?: string;

  /**
   * Error code
   */
  error?: string;

  /**
   * Error description
   */
  error_description?: string;

  /**
   * URL to the protected resource metadata
   */
  resource_metadata?: string;
}

/**
 * Internal state for tracking ongoing requests
 */
export interface RequestState {
  /**
   * The original request
   */
  request: Request;

  /**
   * Number of retries attempted
   */
  retries: number;

  /**
   * Whether token acquisition is in progress
   */
  tokenAcquisitionInProgress: boolean;
}
