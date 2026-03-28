import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Stores the CHPP OAuth access token for the admin account.
 *
 * This table holds a single row (id = 'admin'). The access_token and
 * access_token_secret are stored encrypted with AES-256-GCM using the
 * CHPP_ENCRYPTION_KEY env var. This protects the tokens at rest even if
 * the database file is extracted.
 *
 * The token is valid until the admin revokes it on Hattrick's website.
 * If revoked, revoked_at is set and the row must be replaced via a new
 * OAuth flow.
 */
export const chppTokensTable = sqliteTable('chpp_tokens', {
  /** Fixed identifier — this table holds a single admin token row */
  id: text('id').primaryKey().$default(() => 'admin'),
  /** AES-256-GCM encrypted CHPP access token (format: iv:authTag:ciphertext) */
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  /** AES-256-GCM encrypted CHPP access token secret */
  accessTokenSecretEncrypted: text('access_token_secret_encrypted').notNull(),
  /** Hattrick user ID of the admin who authorised the app */
  htUserId: text('ht_user_id'),
  /** Hattrick login name of the admin who authorised the app */
  htLoginName: text('ht_login_name'),
  /** When this token was stored (UTC) */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  /** Set when the token is known to be revoked (401 from CHPP) */
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
});

export type ChppTokenRow = typeof chppTokensTable.$inferSelect;
export type NewChppTokenRow = typeof chppTokensTable.$inferInsert;
