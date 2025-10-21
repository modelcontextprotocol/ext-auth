/**
 * Web application example with token management
 *
 * This example demonstrates how to integrate the middleware with a web application
 * that handles user authentication and token storage.
 */

import { createCrossAppAccessFetch } from '@modelcontextprotocol/cross-app-access-middleware';

/**
 * Token manager that stores tokens in localStorage
 */
class WebTokenManager {
  private readonly ID_TOKEN_KEY = 'enterprise_id_token';
  private readonly ACCESS_TOKEN_PREFIX = 'mcp_access_token_';

  /**
   * Get the current user's ID Token from localStorage
   */
  async getIdToken(): Promise<string> {
    const token = localStorage.getItem(this.ID_TOKEN_KEY);
    if (!token) {
      throw new Error('User not logged in - no ID Token found');
    }
    return token;
  }

  /**
   * Get a cached access token for a specific MCP server
   */
  async getCachedAccessToken(resourceUrl: string): Promise<string | null> {
    const key = this.ACCESS_TOKEN_PREFIX + this.hashResourceUrl(resourceUrl);
    const cached = localStorage.getItem(key);

    if (!cached) {
      return null;
    }

    try {
      const { token, expiresAt } = JSON.parse(cached);

      // Check if token is still valid (with 1 minute buffer)
      if (Date.now() < expiresAt - 60000) {
        return token;
      }

      // Token expired, remove it
      localStorage.removeItem(key);
      return null;
    } catch {
      // Invalid cached data
      localStorage.removeItem(key);
      return null;
    }
  }

  /**
   * Store an access token when received
   */
  async onAccessTokenReceived(
    resourceUrl: string,
    token: string,
    expiresIn: number = 3600
  ): Promise<void> {
    const key = this.ACCESS_TOKEN_PREFIX + this.hashResourceUrl(resourceUrl);
    const expiresAt = Date.now() + expiresIn * 1000;

    localStorage.setItem(
      key,
      JSON.stringify({
        token,
        expiresAt,
      })
    );
  }

  /**
   * Clear all tokens (on logout)
   */
  clearAllTokens(): void {
    localStorage.removeItem(this.ID_TOKEN_KEY);

    // Clear all access tokens
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.ACCESS_TOKEN_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * Simple hash function for resource URLs
   */
  private hashResourceUrl(url: string): string {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
  }
}

/**
 * MCP Client that uses the middleware
 */
class McpClient {
  private fetch: typeof fetch;
  private tokenManager: WebTokenManager;

  constructor(private serverUrl: string) {
    this.tokenManager = new WebTokenManager();

    // Create authenticated fetch
    this.fetch = createCrossAppAccessFetch({
      idpIssuerUrl: import.meta.env.VITE_IDP_ISSUER_URL,
      idpClientId: import.meta.env.VITE_IDP_CLIENT_ID,
      mcpClientId: import.meta.env.VITE_MCP_CLIENT_ID,

      getIdToken: () => this.tokenManager.getIdToken(),
      getCachedAccessToken: (resourceUrl) =>
        this.tokenManager.getCachedAccessToken(resourceUrl),
      onAccessTokenReceived: (tokenResponse) =>
        this.tokenManager.onAccessTokenReceived(
          this.serverUrl,
          tokenResponse.access_token,
          tokenResponse.expires_in
        ),
    });
  }

  /**
   * List available tools from the MCP server
   */
  async listTools() {
    const response = await this.fetch(`${this.serverUrl}/api/tools`);
    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName: string, params: any) {
    const response = await this.fetch(`${this.serverUrl}/api/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to call tool: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Logout and clear all tokens
   */
  logout() {
    this.tokenManager.clearAllTokens();
  }
}

/**
 * Example usage in a React component or vanilla JS
 */
async function main() {
  const mcpClient = new McpClient('https://mcp.example.com');

  try {
    // List available tools
    console.log('Fetching available tools...');
    const tools = await mcpClient.listTools();
    console.log('Available tools:', tools);

    // Call a tool
    console.log('Calling calculator tool...');
    const result = await mcpClient.callTool('calculator', {
      operation: 'add',
      a: 5,
      b: 3,
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);

    if (error instanceof Error && error.message.includes('not logged in')) {
      // Redirect to login page
      window.location.href = '/login';
    }
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// Export for use in other modules
export { McpClient, WebTokenManager };
