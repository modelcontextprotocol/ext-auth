/**
 * Utility functions for Cross-App Access Middleware
 */

import type { WwwAuthenticateChallenge } from './types.js';

/**
 * Parse WWW-Authenticate header from a 401 response
 * Supports Bearer token challenges as defined in RFC 6750
 *
 * @param headerValue - The WWW-Authenticate header value
 * @returns Parsed challenge parameters
 */
export function parseWwwAuthenticate(headerValue: string): WwwAuthenticateChallenge {
  const challenge: WwwAuthenticateChallenge = {
    scheme: '',
  };

  // Extract the auth scheme (e.g., "Bearer")
  const schemeMatch = headerValue.match(/^(\w+)/);
  if (schemeMatch) {
    challenge.scheme = schemeMatch[1];
  }

  // Extract parameters (key="value" or key=value)
  const paramRegex = /(\w+)=(?:"([^"]*)"|([^\s,]*))/g;
  let match;

  while ((match = paramRegex.exec(headerValue)) !== null) {
    const key = match[1];
    const value = match[2] || match[3];

    switch (key) {
      case 'realm':
        challenge.realm = value;
        break;
      case 'scope':
        challenge.scope = value;
        break;
      case 'error':
        challenge.error = value;
        break;
      case 'error_description':
        challenge.error_description = value;
        break;
      case 'resource_metadata':
        challenge.resource_metadata = value;
        break;
    }
  }

  return challenge;
}

/**
 * Build URL-encoded form data from an object
 *
 * @param data - Object to encode
 * @returns URL-encoded string
 */
export function buildFormData(data: Record<string, string | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      params.append(key, value);
    }
  }

  return params.toString();
}

/**
 * Discover authorization server metadata
 * Tries both OAuth 2.0 and OpenID Connect discovery endpoints
 *
 * @param issuerUrl - The authorization server issuer URL
 * @param fetchFn - Fetch function to use
 * @returns Authorization server metadata
 */
export async function discoverAuthorizationServerMetadata(
  issuerUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<any> {
  // Remove trailing slash
  const baseUrl = issuerUrl.replace(/\/$/, '');

  // Try OAuth 2.0 discovery first (RFC 8414)
  const oauth2MetadataUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

  try {
    const response = await fetchFn(oauth2MetadataUrl);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // Ignore and try next
  }

  // Try OpenID Connect discovery (if the AS also supports OIDC)
  const oidcMetadataUrl = `${baseUrl}/.well-known/openid-configuration`;

  try {
    const response = await fetchFn(oidcMetadataUrl);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // Ignore
  }

  throw new Error(`Failed to discover authorization server metadata for ${issuerUrl}`);
}

/**
 * Extract the resource URL from a request
 *
 * @param request - The request object
 * @returns The resource URL (origin)
 */
export function getResourceUrl(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}

/**
 * Clone a request with a new Authorization header
 *
 * @param request - The original request
 * @param accessToken - The access token to add
 * @returns A new request with the Authorization header
 */
export function cloneRequestWithAuth(request: Request, accessToken: string): Request {
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    integrity: request.integrity,
  });
}

/**
 * Check if a response is a 401 Unauthorized
 *
 * @param response - The response to check
 * @returns True if the response is a 401
 */
export function isUnauthorized(response: Response): boolean {
  return response.status === 401;
}

/**
 * Extract error information from an OAuth error response
 *
 * @param response - The error response
 * @returns Error message
 */
export async function extractOAuthError(response: Response): Promise<string> {
  try {
    const errorData = await response.json();
    if (errorData.error) {
      return errorData.error_description || errorData.error;
    }
  } catch {
    // Not a JSON response
  }

  return `HTTP ${response.status} ${response.statusText}`;
}
