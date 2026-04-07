import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─── players ──────────────────────────────────────────────────────────────────

export const playersTable = sqliteTable('players', {
  id: text('id').primaryKey(),
  htPlayerId: integer('ht_player_id').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  /** ID del equipo en el que fue visto por última vez */
  currentHtTeamId: integer('current_ht_team_id'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type PlayerRow = typeof playersTable.$inferSelect;
export type NewPlayerRow = typeof playersTable.$inferInsert;

// ─── player_team_history ──────────────────────────────────────────────────────

export const playerTeamHistoryTable = sqliteTable('player_team_history', {
  id: text('id').primaryKey(),
  htPlayerId: integer('ht_player_id').notNull(),
  /** Hattrick team ID — JOIN with teams.ht_team_id to resolve name */
  htTeamId: integer('ht_team_id').notNull(),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
});

export type PlayerTeamHistoryRow = typeof playerTeamHistoryTable.$inferSelect;
export type NewPlayerTeamHistoryRow = typeof playerTeamHistoryTable.$inferInsert;
