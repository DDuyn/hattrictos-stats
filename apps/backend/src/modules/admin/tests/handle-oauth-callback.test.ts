import { describe, it, expect, beforeEach } from 'bun:test';
import { isOk, isErr } from '@hattrictos-stats/shared';
import { createHandleOAuthCallback } from '../use-cases/handle-oauth-callback';
import { oauthStateStore } from '../infrastructure/oauth-state-store';
import type { ChppClient, OAuthAccessToken } from '../../../infrastructure/chpp/chpp-client';
import type { ChppTokenRepository } from '../infrastructure/chpp-token.repository';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function createMockChppClient(overrides: Partial<ChppClient> = {}): ChppClient {
  return {
    fetch: async () => ({ ok: true, value: {} }),
    getRequestToken: async () => ({
      ok: true,
      value: {
        requestToken: { token: 'req-token', tokenSecret: 'req-secret' },
        authorizeUrl: 'https://chpp.hattrick.org/oauth/authorize.aspx?oauth_token=req-token',
      },
    }),
    getAccessToken: async () => ({
      ok: true,
      value: {
        token: 'access-token-789',
        tokenSecret: 'access-secret-abc',
      },
    }),
    ...overrides,
  };
}

function createMockTokenRepository(overrides: Partial<ChppTokenRepository> = {}): ChppTokenRepository {
  let stored: OAuthAccessToken | null = null;
  let revokedAt: Date | null = null;

  return {
    async getActive() {
      if (!stored || revokedAt) return null;
      return {
        accessToken: stored.token,
        accessTokenSecret: stored.tokenSecret,
        htUserId: null,
        htLoginName: null,
        createdAt: new Date(),
      };
    },
    async upsert(token) {
      stored = token;
      revokedAt = null;
    },
    async revoke() {
      revokedAt = new Date();
    },
    ...overrides,
  };
}

// ─── Setup helper: seed the state store ──────────────────────────────────────

function seedState(requestToken = 'req-token-123', requestTokenSecret = 'req-secret-456') {
  const state = crypto.randomUUID();
  oauthStateStore.set(state, { requestToken, requestTokenSecret });
  return state;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createHandleOAuthCallback', () => {
  beforeEach(() => {
    oauthStateStore.clear();
  });

  it('should store the access token and return success on callback', async () => {
    const state = seedState('req-token-123');
    const client = createMockChppClient({
      getAccessToken: async () => ({
        ok: true,
        value: { token: 'final-token', tokenSecret: 'final-secret' },
      }),
    });

    const upserted: OAuthAccessToken[] = [];
    const repo: ChppTokenRepository = {
      async getActive() { return null; },
      async upsert(token: OAuthAccessToken) { upserted.push(token); },
      async revoke() {},
    };

    const handleCallback = createHandleOAuthCallback(client, repo);
    const result = await handleCallback({
      state,
      oauthToken: 'req-token-123',
      oauthVerifier: 'verifier-xyz',
    });

    expect(isOk(result)).toBe(true);
    // htLoginName and htUserId are not available from the access token response —
    // they are read from teamdetails via /api/admin/chpp/verify
    if (result.ok) {
      expect(result.value.htLoginName).toBeNull();
      expect(result.value.htUserId).toBeNull();
    }
    expect(upserted[0]?.token).toBe('final-token');
  });

  it('should return UNAUTHORIZED when state is invalid', async () => {
    const client = createMockChppClient();
    const repo = createMockTokenRepository();
    const handleCallback = createHandleOAuthCallback(client, repo);

    const result = await handleCallback({
      state: 'non-existent-state',
      oauthToken: 'some-token',
      oauthVerifier: 'some-verifier',
    });

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
      expect(result.error.message).toContain('expired');
    }
  });

  it('should return UNAUTHORIZED when oauth_token does not match stored request token', async () => {
    const state = seedState('real-req-token');
    const client = createMockChppClient();
    const repo = createMockTokenRepository();
    const handleCallback = createHandleOAuthCallback(client, repo);

    const result = await handleCallback({
      state,
      oauthToken: 'different-token', // does NOT match 'real-req-token'
      oauthVerifier: 'verifier',
    });

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
      expect(result.error.message).toContain('mismatch');
    }
  });

  it('should consume the state (prevent replay)', async () => {
    const state = seedState('req-token-123');
    const client = createMockChppClient();
    const repo = createMockTokenRepository();
    const handleCallback = createHandleOAuthCallback(client, repo);

    // First call succeeds
    const first = await handleCallback({
      state,
      oauthToken: 'req-token-123',
      oauthVerifier: 'verifier-1',
    });
    expect(isOk(first)).toBe(true);

    // Second call with the same state fails (state was consumed)
    const second = await handleCallback({
      state,
      oauthToken: 'req-token-123',
      oauthVerifier: 'verifier-1',
    });
    expect(isErr(second)).toBe(true);
    if (!second.ok) {
      expect(second.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should propagate CHPP errors from getAccessToken', async () => {
    const state = seedState('req-token-123');
    const client = createMockChppClient({
      getAccessToken: async () => ({
        ok: false,
        error: { code: 'CHPP_ERROR', message: 'Invalid verifier' },
      }),
    });
    const repo = createMockTokenRepository();
    const handleCallback = createHandleOAuthCallback(client, repo);

    const result = await handleCallback({
      state,
      oauthToken: 'req-token-123',
      oauthVerifier: 'bad-verifier',
    });

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CHPP_ERROR');
    }
  });
});
