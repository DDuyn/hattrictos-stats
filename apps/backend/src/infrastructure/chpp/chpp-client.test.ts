import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { isOk, isErr } from '@hattrictos-stats/shared';
import { createChppClient } from './chpp-client';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_CONFIG = {
  consumerKey: 'test-consumer-key',
  consumerSecret: 'test-consumer-secret',
  accessToken: 'test-access-token',
  accessTokenSecret: 'test-access-token-secret',
};

/** Minimal XML for a successful teamdetails response */
const TEAM_DETAILS_XML = `<?xml version="1.0" encoding="utf-8"?>
<HattrickData>
  <Team>
    <TeamID>12345</TeamID>
    <TeamName>Test FC</TeamName>
    <ShortTeamName>TFC</ShortTeamName>
  </Team>
</HattrickData>`;

/** CHPP error embedded in a 200 response */
const CHPP_ERROR_XML = `<?xml version="1.0" encoding="utf-8"?>
<HattrickData>
  <Error>No team data found</Error>
</HattrickData>`;

const REQUEST_TOKEN_RESPONSE = 'oauth_token=req-token-123&oauth_token_secret=req-secret-456&oauth_callback_confirmed=true';
const ACCESS_TOKEN_RESPONSE = 'oauth_token=access-token-789&oauth_token_secret=access-secret-abc&user_id=99999&login_name=testadmin';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: string) {
  return mock(() =>
    Promise.resolve(
      new Response(body, {
        status,
        headers: { 'Content-Type': 'application/xml' },
      }),
    ),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createChppClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── fetch() ───────────────────────────────────────────────────────────────

  describe('fetch()', () => {
    it('should return parsed XML data on success', async () => {
      globalThis.fetch = mockFetch(200, TEAM_DETAILS_XML) as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.fetch({ file: 'teamdetails', teamID: '12345' });

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        const data = result.value as { HattrickData: { Team: { TeamID: number; TeamName: string } } };
        expect(data.HattrickData.Team.TeamName).toBe('Test FC');
        expect(data.HattrickData.Team.TeamID).toBe(12345);
      }
    });

    it('should return CHPP_ERROR when XML contains <Error> element in 200 response', async () => {
      globalThis.fetch = mockFetch(200, CHPP_ERROR_XML) as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.fetch({ file: 'teamdetails', teamID: '99' });

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_ERROR');
        expect(result.error.message).toContain('No team data found');
      }
    });

    it('should return CHPP_ERROR on HTTP 401 (revoked token)', async () => {
      globalThis.fetch = mockFetch(401, '') as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.fetch({ file: 'teamdetails' });

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_ERROR');
        expect(result.error.message).toContain('revoked');
      }
    });

    it('should return CHPP_RATE_LIMITED on HTTP 429', async () => {
      globalThis.fetch = mockFetch(429, '') as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.fetch({ file: 'teamdetails' });

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_RATE_LIMITED');
      }
    });

    it('should return INTERNAL_ERROR on HTTP 500', async () => {
      globalThis.fetch = mockFetch(500, '') as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.fetch({ file: 'teamdetails' });

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('should return CHPP_ERROR when access token is not configured', async () => {
      const client = createChppClient({
        consumerKey: 'key',
        consumerSecret: 'secret',
        // no accessToken / accessTokenSecret
      });

      const result = await client.fetch({ file: 'teamdetails' });

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_ERROR');
        expect(result.error.message).toContain('No CHPP access token');
      }
    });

    it('should return INTERNAL_ERROR on network failure', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.fetch({ file: 'teamdetails' });

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should include the OAuth Authorization header in the request', async () => {
      let capturedHeaders: HeadersInit | undefined;
      globalThis.fetch = mock((_url, init) => {
        capturedHeaders = init?.headers;
        return Promise.resolve(new Response(TEAM_DETAILS_XML, { status: 200 }));
      }) as unknown as typeof globalThis.fetch;

      const client = createChppClient(TEST_CONFIG);
      await client.fetch({ file: 'teamdetails' });

      expect(capturedHeaders).toBeDefined();
      const headers = capturedHeaders as Record<string, string>;
      expect(headers['Authorization']).toContain('OAuth');
      expect(headers['Authorization']).toContain('oauth_consumer_key');
      expect(headers['Authorization']).toContain('oauth_signature');
    });

    it('should not include undefined params in the request URL', async () => {
      let capturedUrl: string | undefined;
      globalThis.fetch = mock((url) => {
        capturedUrl = url as string;
        return Promise.resolve(new Response(TEAM_DETAILS_XML, { status: 200 }));
      }) as unknown as typeof globalThis.fetch;

      const client = createChppClient(TEST_CONFIG);
      await client.fetch({ file: 'teamdetails', teamID: undefined });

      expect(capturedUrl).toBeDefined();
      expect(capturedUrl).not.toContain('teamID');
      expect(capturedUrl).toContain('file=teamdetails');
    });
  });

  // ── getRequestToken() ─────────────────────────────────────────────────────

  describe('getRequestToken()', () => {
    it('should return request token and authorize URL on success', async () => {
      globalThis.fetch = mockFetch(200, REQUEST_TOKEN_RESPONSE) as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.getRequestToken('http://localhost:3000/api/admin/chpp/callback');

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.requestToken.token).toBe('req-token-123');
        expect(result.value.requestToken.tokenSecret).toBe('req-secret-456');
        expect(result.value.authorizeUrl).toContain('authorize.aspx');
        expect(result.value.authorizeUrl).toContain('req-token-123');
      }
    });

    it('should return CHPP_ERROR if response does not contain tokens', async () => {
      globalThis.fetch = mockFetch(200, 'error=invalid_callback') as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.getRequestToken('http://localhost:3000/callback');

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_ERROR');
      }
    });

    it('should return CHPP_ERROR on HTTP 401', async () => {
      globalThis.fetch = mockFetch(401, '') as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.getRequestToken('http://localhost:3000/callback');

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_ERROR');
      }
    });

    it('should use GET method with oauth_callback signed in header (not in URL)', async () => {
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      globalThis.fetch = mock((url, init) => {
        capturedUrl = url as string;
        capturedMethod = init?.method as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return Promise.resolve(new Response(REQUEST_TOKEN_RESPONSE, { status: 200 }));
      }) as unknown as typeof globalThis.fetch;

      const client = createChppClient(TEST_CONFIG);
      await client.getRequestToken('http://localhost:3000/api/admin/chpp/callback?state=abc');

      expect(capturedMethod).toBe('GET');
      // oauth_callback must NOT be in the URL — it corrupts the OAuth 1.0a signature
      expect(capturedUrl).not.toContain('oauth_callback');
      expect(capturedUrl).toContain('request_token.ashx');
      // Instead it must be in the signed Authorization header
      expect(capturedHeaders?.['Authorization']).toContain('oauth_signature');
    });
  });

  // ── getAccessToken() ──────────────────────────────────────────────────────

  describe('getAccessToken()', () => {
    it('should return access token on success (Hattrick does not return user info here)', async () => {
      globalThis.fetch = mockFetch(200, ACCESS_TOKEN_RESPONSE) as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const requestToken = { token: 'req-token-123', tokenSecret: 'req-secret-456' };
      const result = await client.getAccessToken(requestToken, 'verifier-xyz');

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.token).toBe('access-token-789');
        expect(result.value.tokenSecret).toBe('access-secret-abc');
        // Hattrick does NOT return user_id or login_name in the access token response
      }
    });

    it('should return CHPP_ERROR if response does not contain tokens', async () => {
      globalThis.fetch = mockFetch(200, 'error=invalid_verifier') as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.getAccessToken(
        { token: 'req-token', tokenSecret: 'req-secret' },
        'bad-verifier',
      );

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_ERROR');
      }
    });

    it('should return CHPP_RATE_LIMITED on HTTP 429', async () => {
      globalThis.fetch = mockFetch(429, '') as unknown as typeof globalThis.fetch;
      const client = createChppClient(TEST_CONFIG);

      const result = await client.getAccessToken(
        { token: 'req-token', tokenSecret: 'req-secret' },
        'verifier',
      );

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('CHPP_RATE_LIMITED');
      }
    });

    it('should use GET method with oauth_verifier signed in header (not in URL)', async () => {
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      globalThis.fetch = mock((url, init) => {
        capturedUrl = url as string;
        capturedMethod = init?.method as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return Promise.resolve(new Response(ACCESS_TOKEN_RESPONSE, { status: 200 }));
      }) as unknown as typeof globalThis.fetch;

      const client = createChppClient(TEST_CONFIG);
      await client.getAccessToken({ token: 'req-token', tokenSecret: 'req-secret' }, 'verifier-xyz');

      expect(capturedMethod).toBe('GET');
      // oauth_verifier must NOT be in the URL — it corrupts the OAuth 1.0a signature
      expect(capturedUrl).not.toContain('oauth_verifier');
      expect(capturedUrl).toContain('access_token.ashx');
      // Instead it must be in the signed Authorization header
      expect(capturedHeaders?.['Authorization']).toContain('oauth_signature');
    });
  });
});
