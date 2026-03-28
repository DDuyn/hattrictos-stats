import { eq } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import { chppTokensTable } from './chpp-token.table';
import type { ChppEncryption } from '../../../infrastructure/chpp/chpp-encryption';
import type { OAuthAccessToken } from '../../../infrastructure/chpp/chpp-client';

export interface ActiveChppToken {
  accessToken: string;
  accessTokenSecret: string;
  htUserId: string | null;
  htLoginName: string | null;
  createdAt: Date;
}

export interface ChppTokenRepository {
  /**
   * Returns the active (non-revoked) CHPP token, or null if none exists.
   * Decrypts the token before returning.
   */
  getActive(): Promise<ActiveChppToken | null>;

  /**
   * Stores or replaces the admin CHPP token (upsert on id='admin').
   * Encrypts the token before persisting.
   */
  upsert(token: OAuthAccessToken): Promise<void>;

  /**
   * Marks the current token as revoked (e.g. after receiving HTTP 401 from CHPP).
   */
  revoke(): Promise<void>;
}

export function createChppTokenRepository(db: DB, encryption: ChppEncryption): ChppTokenRepository {
  return {
    async getActive(): Promise<ActiveChppToken | null> {
      const row = await db
        .select()
        .from(chppTokensTable)
        .where(eq(chppTokensTable.id, 'admin'))
        .get();

      if (!row || row.revokedAt !== null) return null;

      return {
        accessToken: encryption.decrypt(row.accessTokenEncrypted),
        accessTokenSecret: encryption.decrypt(row.accessTokenSecretEncrypted),
        htUserId: row.htUserId,
        htLoginName: row.htLoginName,
        createdAt: row.createdAt,
      };
    },

    async upsert(token: OAuthAccessToken): Promise<void> {
      const accessTokenEncrypted = encryption.encrypt(token.token);
      const accessTokenSecretEncrypted = encryption.encrypt(token.tokenSecret);

      await db
        .insert(chppTokensTable)
        .values({
          id: 'admin',
          accessTokenEncrypted,
          accessTokenSecretEncrypted,
          htUserId: null,
          htLoginName: null,
          createdAt: new Date(),
          revokedAt: null,
        })
        .onConflictDoUpdate({
          target: chppTokensTable.id,
          set: {
            accessTokenEncrypted,
            accessTokenSecretEncrypted,
            htUserId: null,
            htLoginName: null,
            createdAt: new Date(),
            revokedAt: null,
          },
        });
    },

    async revoke(): Promise<void> {
      await db
        .update(chppTokensTable)
        .set({ revokedAt: new Date() })
        .where(eq(chppTokensTable.id, 'admin'));
    },
  };
}
