/**
 * Node.js server-side example
 *
 * This example demonstrates how to use the middleware in a Node.js application,
 * such as a backend service that needs to access MCP servers on behalf of users.
 */

import { CrossAppAccessMiddleware } from '@modelcontextprotocol/cross-app-access-middleware';

/**
 * Server-side token manager using an in-memory cache
 * In production, you might want to use Redis or another distributed cache
 */
class ServerTokenManager {
  private idTokens = new Map<string, string>();
  private accessTokens = new Map<string, { token: string; expiresAt: number }>();

  /**
   * Store a user's ID Token (after they log in)
   */
  setIdToken(userId: string, idToken: string): void {
    this.idTokens.set(userId, idToken);
  }

  /**
   * Get a user's ID Token
   */
  getIdToken(userId: string): string {
    const token = this.idTokens.get(userId);
    if (!token) {
      throw new Error(`No ID Token found for user ${userId}`);
    }
    return token;
  }

  /**
   * Get a cached access token for a user and resource
   */
  getCachedAccessToken(userId: string, resourceUrl: string): string | null {
    const key = `${userId}:${resourceUrl}`;
    const cached = this.accessTokens.get(key);

    if (!cached) {
      return null;
    }

    // Check if still valid
    if (Date.now() < cached.expiresAt - 60000) {
      return cached.token;
    }

    // Expired
    this.accessTokens.delete(key);
    return null;
  }

  /**
   * Store an access token
   */
  setAccessToken(
    userId: string,
    resourceUrl: string,
    token: string,
    expiresIn: number
  ): void {
    const key = `${userId}:${resourceUrl}`;
    const expiresAt = Date.now() + expiresIn * 1000;

    this.accessTokens.set(key, { token, expiresAt });
  }

  /**
   * Clear all tokens for a user
   */
  clearUserTokens(userId: string): void {
    this.idTokens.delete(userId);

    // Clear access tokens
    for (const [key] of this.accessTokens) {
      if (key.startsWith(`${userId}:`)) {
        this.accessTokens.delete(key);
      }
    }
  }
}

/**
 * Service that makes authenticated requests to MCP servers
 */
class McpService {
  private tokenManager: ServerTokenManager;
  private middlewareCache = new Map<string, CrossAppAccessMiddleware>();

  constructor() {
    this.tokenManager = new ServerTokenManager();
  }

  /**
   * Get or create a middleware instance for a user
   */
  private getMiddleware(userId: string, resourceUrl: string): CrossAppAccessMiddleware {
    const cacheKey = userId;
    let middleware = this.middlewareCache.get(cacheKey);

    if (!middleware) {
      middleware = new CrossAppAccessMiddleware({
        idpIssuerUrl: process.env.IDP_ISSUER_URL!,
        idpClientId: process.env.IDP_CLIENT_ID!,
        idpClientSecret: process.env.IDP_CLIENT_SECRET!,
        mcpClientId: process.env.MCP_CLIENT_ID!,
        mcpClientSecret: process.env.MCP_CLIENT_SECRET!,

        getIdToken: async () => this.tokenManager.getIdToken(userId),
        getCachedAccessToken: async (url) =>
          this.tokenManager.getCachedAccessToken(userId, url),
        onAccessTokenReceived: async (tokenResponse) => {
          this.tokenManager.setAccessToken(
            userId,
            resourceUrl,
            tokenResponse.access_token,
            tokenResponse.expires_in || 3600
          );
        },
      });

      this.middlewareCache.set(cacheKey, middleware);
    }

    return middleware;
  }

  /**
   * Make an authenticated request to an MCP server on behalf of a user
   */
  async fetchForUser(userId: string, url: string, init?: RequestInit): Promise<Response> {
    const resourceUrl = new URL(url).origin;
    const middleware = this.getMiddleware(userId, resourceUrl);
    return middleware.fetch(url, init);
  }

  /**
   * Handle user login - store their ID Token
   */
  handleUserLogin(userId: string, idToken: string): void {
    this.tokenManager.setIdToken(userId, idToken);
  }

  /**
   * Handle user logout - clear their tokens
   */
  handleUserLogout(userId: string): void {
    this.tokenManager.clearUserTokens(userId);
    this.middlewareCache.delete(userId);
  }
}

/**
 * Example Express.js route handlers
 */
const mcpService = new McpService();

/**
 * Example: Express.js login callback
 */
async function handleLoginCallback(req: any, res: any) {
  // After successful OIDC login, you receive an ID Token
  const { id_token } = req.body;
  const userId = 'user-123'; // Extract from ID Token

  // Store the ID Token
  mcpService.handleUserLogin(userId, id_token);

  res.json({ success: true });
}

/**
 * Example: API endpoint that proxies to MCP server
 */
async function handleMcpRequest(req: any, res: any) {
  const userId = req.user.id; // From authentication middleware
  const mcpServerUrl = 'https://mcp.example.com';

  try {
    // Make authenticated request to MCP server
    const response = await mcpService.fetchForUser(
      userId,
      `${mcpServerUrl}/api/tools`,
      {
        method: 'GET',
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling MCP server:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Example: Logout endpoint
 */
async function handleLogout(req: any, res: any) {
  const userId = req.user.id;

  mcpService.handleUserLogout(userId);

  res.json({ success: true });
}

/**
 * Standalone example (not using Express)
 */
async function standaloneExample() {
  const service = new McpService();

  // Simulate user login
  const userId = 'user-123';
  const idToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  service.handleUserLogin(userId, idToken);

  try {
    // Make authenticated request to MCP server
    console.log('Fetching tools from MCP server...');
    const response = await service.fetchForUser(
      userId,
      'https://mcp.example.com/api/tools'
    );

    const tools = await response.json();
    console.log('Available tools:', tools);

    // Make another request (will use cached token)
    console.log('Fetching resources...');
    const resourcesResponse = await service.fetchForUser(
      userId,
      'https://mcp.example.com/api/resources'
    );

    const resources = await resourcesResponse.json();
    console.log('Available resources:', resources);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup
    service.handleUserLogout(userId);
  }
}

// Run standalone example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  standaloneExample().catch(console.error);
}

// Export for use in other modules
export { McpService, ServerTokenManager };
