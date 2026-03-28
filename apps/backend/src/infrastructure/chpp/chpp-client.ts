/**
 * CHPP API Client — Certified Hattrick Product Program
 *
 * Factory function that signs OAuth 1.0a requests, fetches from CHPP,
 * parses XML responses, and normalises errors into Result<T, AppError>.
 *
 * CHPP uses OAuth 1.0a (NOT 2.0). All calls go through the backend only.
 * Never call CHPP from the frontend.
 *
 * Docs: https://www.hattrick.org/Community/CHPP/NewDocs/
 */

import OAuth from 'oauth-1.0a';
import { createHmac } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import {
  type Result,
  type AppError,
  ok,
  err,
  chppError,
  chppRateLimitedError,
  internalError,
} from '@hattrictos-stats/shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHPP_BASE_URL = 'https://chpp.hattrick.org/chppxml.ashx';
const REQUEST_TOKEN_URL = 'https://chpp.hattrick.org/oauth/request_token.ashx';
const ACCESS_TOKEN_URL = 'https://chpp.hattrick.org/oauth/access_token.ashx';
const AUTHORIZE_URL = 'https://chpp.hattrick.org/oauth/authorize.aspx';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChppClientConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

/** Temporary token received in step 1 of the OAuth flow */
export interface OAuthRequestToken {
  token: string;
  tokenSecret: string;
}

/** Final token received after the admin authorises the app */
export interface OAuthAccessToken {
  token: string;
  tokenSecret: string;
  // NOTE: Hattrick's access_token.ashx does NOT return user info (user_id, login_name).
  // User details (UserID, Loginname) are available via the teamdetails CHPP endpoint instead.
}

/** Parameters for a CHPP API call */
export interface ChppRequestParams {
  file: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ChppClient {
  /**
   * Makes a signed GET request to the CHPP API and returns the parsed XML
   * as a plain object. Requires access token credentials to be set.
   */
  fetch(params: ChppRequestParams): Promise<Result<Record<string, unknown>, AppError>>;

  /**
   * Step 1 of OAuth flow: requests a temporary request token from CHPP.
   * Returns the request token + a URL to redirect the admin to for authorisation.
   */
  getRequestToken(
    callbackUrl: string,
  ): Promise<Result<{ requestToken: OAuthRequestToken; authorizeUrl: string }, AppError>>;

  /**
   * Step 3 of OAuth flow: exchanges the request token + verifier for the
   * final access token. Call this from the OAuth callback handler.
   */
  getAccessToken(
    requestToken: OAuthRequestToken,
    verifier: string,
  ): Promise<Result<OAuthAccessToken, AppError>>;
}

// ─── XML Parser ──────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
});

function parseXml(xml: string): Record<string, unknown> {
  return xmlParser.parse(xml) as Record<string, unknown>;
}

/**
 * CHPP can return HTTP 200 with an <Error> element inside the XML body.
 * Always check for this before processing the response.
 */
function extractChppError(parsed: Record<string, unknown>): string | null {
  // Top-level <HattrickData><Error>message</Error></HattrickData>
  const root = parsed['HattrickData'] as Record<string, unknown> | undefined;
  if (root && typeof root['Error'] === 'string' && root['Error']) {
    return root['Error'];
  }
  // Some endpoints return error at root level
  if (typeof parsed['Error'] === 'string' && parsed['Error']) {
    return parsed['Error'];
  }
  return null;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createChppClient(config: ChppClientConfig): ChppClient {
  const oauth = new OAuth({
    consumer: {
      key: config.consumerKey,
      secret: config.consumerSecret,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return createHmac('sha1', key).update(base_string).digest('base64');
    },
  });

  /** Signs a request and returns the Authorization header value */
  function buildAuthHeader(
    url: string,
    method: 'GET' | 'POST',
    token?: OAuth.Token,
    extraData?: Record<string, string>,
  ): Record<string, string> {
    const requestData: OAuth.RequestOptions = { url, method };
    if (extraData) requestData.data = extraData;
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
    return { Authorization: authHeader.Authorization };
  }

  /** Handles HTTP-level errors common to all CHPP requests */
  function handleHttpError(status: number, context: string): AppError {
    if (status === 401) {
      return chppError(
        'CHPP token revoked or invalid. The admin must re-authorise the application.',
      );
    }
    if (status === 429) {
      return chppRateLimitedError('CHPP rate limit exceeded. Retry later.');
    }
    return internalError(`CHPP request failed (${context}): HTTP ${status}`);
  }

  return {
    async fetch(params: ChppRequestParams): Promise<Result<Record<string, unknown>, AppError>> {
      if (!config.accessToken || !config.accessTokenSecret) {
        return err(
          chppError(
            'No CHPP access token configured. Complete the OAuth flow at /api/admin/chpp/connect.',
          ),
        );
      }

      // Build URL with query params — filter out undefined values
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          query.set(key, String(value));
        }
      }
      const url = `${CHPP_BASE_URL}?${query.toString()}`;

      const token: OAuth.Token = {
        key: config.accessToken,
        secret: config.accessTokenSecret,
      };

      let response: Response;
      try {
        response = await globalThis.fetch(url, {
          method: 'GET',
          headers: {
            ...buildAuthHeader(url, 'GET', token),
            Accept: 'application/xml',
          },
        });
      } catch (e) {
        return err(internalError(`CHPP network error: ${e instanceof Error ? e.message : String(e)}`));
      }

      if (!response.ok) {
        return err(handleHttpError(response.status, `file=${params.file}`));
      }

      const xml = await response.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = parseXml(xml);
      } catch (e) {
        return err(internalError(`Failed to parse CHPP XML response: ${e instanceof Error ? e.message : String(e)}`));
      }

      const chppErr = extractChppError(parsed);
      if (chppErr) {
        return err(chppError(`CHPP API error: ${chppErr}`));
      }

      return ok(parsed);
    },

    async getRequestToken(
      callbackUrl: string,
    ): Promise<Result<{ requestToken: OAuthRequestToken; authorizeUrl: string }, AppError>> {
      // Hattrick requires GET for all OAuth requests.
      // oauth_callback must be signed in the Authorization header data.
      // The URL must NOT include oauth_callback as a query param — that corrupts the signature.
      const headers = buildAuthHeader(REQUEST_TOKEN_URL, 'GET', undefined, {
        oauth_callback: callbackUrl,
      });

      let response: Response;
      try {
        response = await globalThis.fetch(REQUEST_TOKEN_URL, {
          method: 'GET',
          headers,
        });
      } catch (e) {
        return err(internalError(`CHPP network error (request token): ${e instanceof Error ? e.message : String(e)}`));
      }

      if (!response.ok) {
        return err(handleHttpError(response.status, 'request_token'));
      }

      const body = await response.text();
      const params = new URLSearchParams(body);
      const token = params.get('oauth_token');
      const tokenSecret = params.get('oauth_token_secret');

      if (!token || !tokenSecret) {
        return err(chppError(`CHPP did not return a valid request token. Response: ${body}`));
      }

      const authorizeUrl = `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(token)}`;

      return ok({
        requestToken: { token, tokenSecret },
        authorizeUrl,
      });
    },

    async getAccessToken(
      requestToken: OAuthRequestToken,
      verifier: string,
    ): Promise<Result<OAuthAccessToken, AppError>> {
      // Hattrick requires GET for all OAuth requests.
      // oauth_verifier must be signed into the Authorization header data.
      // The URL must NOT include oauth_verifier as a query param — that corrupts the signature.
      const token: OAuth.Token = {
        key: requestToken.token,
        secret: requestToken.tokenSecret,
      };

      const requestData: OAuth.RequestOptions = {
        url: ACCESS_TOKEN_URL,
        method: 'GET',
        data: { oauth_verifier: verifier },
      };
      const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

      let response: Response;
      try {
        response = await globalThis.fetch(ACCESS_TOKEN_URL, {
          method: 'GET',
          headers: {
            Authorization: authHeader.Authorization,
          },
        });
      } catch (e) {
        return err(internalError(`CHPP network error (access token): ${e instanceof Error ? e.message : String(e)}`));
      }

      if (!response.ok) {
        return err(handleHttpError(response.status, 'access_token'));
      }

      const body = await response.text();
      const params = new URLSearchParams(body);
      const accessToken = params.get('oauth_token');
      const accessTokenSecret = params.get('oauth_token_secret');

      if (!accessToken || !accessTokenSecret) {
        return err(chppError(`CHPP did not return a valid access token. Response: ${body}`));
      }

      // NOTE: Hattrick does NOT return user_id or login_name in the access token response.
      // Use the teamdetails endpoint to obtain UserID and Loginname after storing the token.
      return ok({
        token: accessToken,
        tokenSecret: accessTokenSecret,
      });
    },
  };
}
