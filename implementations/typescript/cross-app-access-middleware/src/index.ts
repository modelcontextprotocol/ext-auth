/**
 * Cross-App Access Middleware for MCP
 *
 * A TypeScript fetch middleware that implements Enterprise-Managed Authorization
 * for the Model Context Protocol (MCP).
 *
 * @packageDocumentation
 */

export { CrossAppAccessMiddleware, createCrossAppAccessFetch } from './middleware.js';

export type {
  CrossAppAccessConfig,
  ProtectedResourceMetadata,
  AuthorizationServerMetadata,
  TokenExchangeRequest,
  TokenExchangeResponse,
  JwtBearerGrantRequest,
  AccessTokenResponse,
  OAuthErrorResponse,
  WwwAuthenticateChallenge,
} from './types.js';

export {
  parseWwwAuthenticate,
  buildFormData,
  discoverAuthorizationServerMetadata,
  getResourceUrl,
  cloneRequestWithAuth,
  isUnauthorized,
  extractOAuthError,
} from './utils.js';
