import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { tournamentsTable } from '../../tournaments/infrastructure/tournaments.table';

// ─── teams ────────────────────────────────────────────────────────────────────

export const teamsTable = sqliteTable('teams', {
  id: text('id').primaryKey(),
  htTeamId: integer('ht_team_id').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull().default(''),
  managerLoginName: text('manager_login_name').notNull().default(''),
  leagueName: text('league_name').notNull().default(''),
  arenaName: text('arena_name').notNull().default(''),
  foundedDate: text('founded_date').notNull().default(''),
  /** Timestamp del último sync de file=players para este equipo */
  playersSyncedAt: integer('players_synced_at', { mode: 'timestamp' }),
  /** Ruta relativa al logo del equipo (e.g. /logos/12345.png). Null si no tiene logo. */
  logoUrl: text('logo_url'),
});

export type TeamRow = typeof teamsTable.$inferSelect;
export type NewTeamRow = typeof teamsTable.$inferInsert;

// ─── tournament_team_seasons ──────────────────────────────────────────────────

export const tournamentTeamSeasonsTable = sqliteTable('tournament_team_seasons', {
  id: text('id').primaryKey(),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: 'cascade' }),
  teamId: text('team_id')
    .notNull()
    .references(() => teamsTable.id, { onDelete: 'cascade' }),
  htTeamId: integer('ht_team_id').notNull(),
});

export type TournamentTeamSeasonRow = typeof tournamentTeamSeasonsTable.$inferSelect;
export type NewTournamentTeamSeasonRow = typeof tournamentTeamSeasonsTable.$inferInsert;
