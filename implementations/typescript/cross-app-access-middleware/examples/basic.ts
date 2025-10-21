/**
 * Basic usage example of Cross-App Access Middleware
 *
 * This example demonstrates the simplest way to use the middleware
 * with minimal configuration.
 */

import { createCrossAppAccessFetch } from '@modelcontextprotocol/cross-app-access-middleware';

// In a real application, you would obtain this from your SSO login flow
let currentIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// Create an authenticated fetch function
const authenticatedFetch = createCrossAppAccessFetch({
  // Enterprise IdP configuration
  idpIssuerUrl: 'https://idp.example.com',
  idpClientId: 'your-idp-client-id',
  idpClientSecret: 'your-idp-client-secret', // Only if required by your IdP

  // MCP Server configuration
  mcpClientId: 'your-mcp-client-id',
  mcpClientSecret: 'your-mcp-client-secret', // Only if required

  // Provide the ID Token
  getIdToken: async () => currentIdToken,

  // Optional: Get notified when access tokens are received
  onAccessTokenReceived: (tokenResponse) => {
    console.log('Received access token:', {
      expiresIn: tokenResponse.expires_in,
      scope: tokenResponse.scope,
    });
  },
});

// Example: Call an MCP server API
async function callMcpServer() {
  try {
    // The first request will:
    // 1. Get a 401 response
    // 2. Automatically exchange the ID Token for an ID-JAG
    // 3. Exchange the ID-JAG for an access token
    // 4. Retry the request with the access token
    const response = await authenticatedFetch('https://mcp.example.com/api/tools');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const tools = await response.json();
    console.log('Available tools:', tools);

    // Subsequent requests will use the cached access token
    const resourcesResponse = await authenticatedFetch('https://mcp.example.com/api/resources');
    const resources = await resourcesResponse.json();
    console.log('Available resources:', resources);
  } catch (error) {
    console.error('Error calling MCP server:', error);
  }
}

// Run the example
callMcpServer();
