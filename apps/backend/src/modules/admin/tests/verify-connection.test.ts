import { describe, it, expect, afterEach } from 'bun:test';
import { isOk, isErr } from '@hattrictos-stats/shared';
import { createVerifyConnection } from '../use-cases/verify-connection';
import type { ChppTokenRepository, ActiveChppToken } from '../infrastructure/chpp-token.repository';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function createMockTokenRepository(active: ActiveChppToken | null): ChppTokenRepository {
  return {
    async getActive() { return active; },
    async upsert() {},
    async revoke() {},
  };
}

const TEAM_DETAILS_XML_RESPONSE = {
  HattrickData: {
    Team: {
      TeamID: 12345,
      TeamName: 'Test FC',
    },
  },
};

const ACTIVE_TOKEN: ActiveChppToken = {
  accessToken: 'test-access-token',
  accessTokenSecret: 'test-access-token-secret',
  htUserId: '99999',
  htLoginName: 'testadmin',
  createdAt: new Date(),
};

const CHPP_CONFIG = { consumerKey: 'key', consumerSecret: 'secret' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createVerifyConnection', () => {
  let originalFetch: typeof globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return team info when token is valid', async () => {
    originalFetch = globalThis.fetch;

    const TEAM_XML = `<?xml version="1.0" encoding="utf-8"?>
<HattrickData>
  <UserID>99999</UserID>
  <User>
    <UserID>99999</UserID>
    <Loginname>testadmin</Loginname>
  </User>
  <Team>
    <TeamID>12345</TeamID>
    <TeamName>Test FC</TeamName>
  </Team>
</HattrickData>`;

    globalThis.fetch = (() =>
      Promise.resolve(new Response(TEAM_XML, { status: 200 }))) as unknown as typeof globalThis.fetch;

    const repo = createMockTokenRepository(ACTIVE_TOKEN);
    const verifyConnection = createVerifyConnection(CHPP_CONFIG, repo);

    const result = await verifyConnection();

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.teamId).toBe(12345);
      expect(result.value.teamName).toBe('Test FC');
      expect(result.value.htLoginName).toBe('testadmin');
      expect(result.value.htUserId).toBe('99999');
    }
  });

  it('should return NOT_FOUND when no active token exists in DB', async () => {
    originalFetch = globalThis.fetch;
    const repo = createMockTokenRepository(null);
    const verifyConnection = createVerifyConnection(CHPP_CONFIG, repo);

    const result = await verifyConnection();

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toContain('No active CHPP token');
    }
  });

  it('should return CHPP_ERROR when token is revoked (HTTP 401)', async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(new Response('', { status: 401 }))) as unknown as typeof globalThis.fetch;

    const repo = createMockTokenRepository(ACTIVE_TOKEN);
    const verifyConnection = createVerifyConnection(CHPP_CONFIG, repo);

    const result = await verifyConnection();

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CHPP_ERROR');
    }
  });
});
