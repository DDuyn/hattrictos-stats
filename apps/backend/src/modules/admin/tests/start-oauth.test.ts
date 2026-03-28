import { describe, it, expect, beforeEach } from 'bun:test';
import { isOk, isErr } from '@hattrictos-stats/shared';
import { createStartOAuth } from '../use-cases/start-oauth';
import { oauthStateStore } from '../infrastructure/oauth-state-store';
import type { ChppClient } from '../../../infrastructure/chpp/chpp-client';

// ─── Mock CHPP client ─────────────────────────────────────────────────────────

function createMockChppClient(overrides: Partial<ChppClient> = {}): ChppClient {
  return {
    fetch: async () => ({ ok: true, value: {} }),
    getRequestToken: async () => ({
      ok: true,
      value: {
        requestToken: { token: 'req-token-123', tokenSecret: 'req-secret-456' },
        authorizeUrl: 'https://chpp.hattrick.org/oauth/authorize.aspx?oauth_token=req-token-123',
      },
    }),
    getAccessToken: async () => ({
      ok: true,
      value: {
        token: 'access-token-789',
        tokenSecret: 'access-secret-abc',
        userId: '99999',
        loginName: 'testadmin',
      },
    }),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createStartOAuth', () => {
  beforeEach(() => {
    oauthStateStore.clear();
  });

  it('should return an authorizeUrl on success', async () => {
    const client = createMockChppClient();
    const startOAuth = createStartOAuth(client);

    const result = await startOAuth('http://localhost:3000');

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.authorizeUrl).toContain('authorize.aspx');
      expect(result.value.authorizeUrl).toContain('req-token-123');
    }
  });

  it('should include a state parameter in the callback URL passed to CHPP', async () => {
    let capturedCallbackUrl: string | undefined;

    const client = createMockChppClient({
      getRequestToken: async (callbackUrl) => {
        capturedCallbackUrl = callbackUrl;
        return {
          ok: true,
          value: {
            requestToken: { token: 'req-token', tokenSecret: 'req-secret' },
            authorizeUrl: 'https://chpp.hattrick.org/oauth/authorize.aspx?oauth_token=req-token',
          },
        };
      },
    });

    const startOAuth = createStartOAuth(client);
    await startOAuth('http://localhost:3000');

    expect(capturedCallbackUrl).toContain('/api/admin/chpp/callback');
    expect(capturedCallbackUrl).toContain('state=');
  });

  it('should store the request token secret in the oauth state store', async () => {
    let capturedCallbackUrl: string | undefined;

    const client = createMockChppClient({
      getRequestToken: async (callbackUrl) => {
        capturedCallbackUrl = callbackUrl;
        return {
          ok: true,
          value: {
            requestToken: { token: 'stored-req-token', tokenSecret: 'stored-req-secret' },
            authorizeUrl: 'https://chpp.hattrick.org/oauth/authorize.aspx?oauth_token=stored-req-token',
          },
        };
      },
    });

    const startOAuth = createStartOAuth(client);
    await startOAuth('http://localhost:3000');

    // Extract the state from the callback URL
    const url = new URL(capturedCallbackUrl!);
    const state = url.searchParams.get('state')!;

    const stored = oauthStateStore.get(state);
    expect(stored).not.toBeNull();
    expect(stored?.requestToken).toBe('stored-req-token');
    expect(stored?.requestTokenSecret).toBe('stored-req-secret');
  });

  it('should propagate CHPP errors from getRequestToken', async () => {
    const client = createMockChppClient({
      getRequestToken: async () => ({
        ok: false,
        error: { code: 'CHPP_ERROR', message: 'CHPP unavailable' },
      }),
    });

    const startOAuth = createStartOAuth(client);
    const result = await startOAuth('http://localhost:3000');

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CHPP_ERROR');
    }
  });

  it('should generate a different state on each call (no collisions)', async () => {
    const states = new Set<string>();
    const client = createMockChppClient();
    const startOAuth = createStartOAuth(client);

    for (let i = 0; i < 20; i++) {
      let capturedState: string | undefined;
      const c = createMockChppClient({
        getRequestToken: async (callbackUrl) => {
          capturedState = new URL(callbackUrl).searchParams.get('state') ?? undefined;
          return {
            ok: true,
            value: {
              requestToken: { token: `req-${i}`, tokenSecret: `secret-${i}` },
              authorizeUrl: `https://chpp.hattrick.org/oauth/authorize.aspx?oauth_token=req-${i}`,
            },
          };
        },
      });
      await createStartOAuth(c)('http://localhost:3000');
      if (capturedState) states.add(capturedState);
    }

    expect(states.size).toBe(20);
  });
});
