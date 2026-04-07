import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { tournamentsTable } from '../../tournaments/infrastructure/tournaments.table';

// ─── teams ────────────────────────────────────────────────────────────────────

export const teamsTable = sqliteTable('teams', {
  id: text('id').primaryKey(),
  htTeamId: integer('ht_team_id').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull().default(''),
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
