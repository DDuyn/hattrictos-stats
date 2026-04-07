import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─── tournaments ─────────────────────────────────────────────────────────────

/**
 * Registered tournaments — admin adds a Hattrick Arena tournament by its
 * tournamentId so the app can sync and display its data publicly.
 */
export const tournamentsTable = sqliteTable('tournaments', {
  id: text('id').primaryKey(),
  /** The Hattrick tournament ID (unique, external) */
  htTournamentId: integer('ht_tournament_id').notNull().unique(),
  /** Tournament name (populated from CHPP on first sync) */
  name: text('name').notNull(),
  /** Season number from Hattrick */
  season: integer('season'),
  /** 0 = league, 1 = cup */
  tournamentType: integer('tournament_type'),
  /** Number of teams participating */
  numberOfTeams: integer('number_of_teams'),
  /** Number of top positions that earn promotion (0 = not configured) */
  promotionSlots: integer('promotion_slots').notNull().default(0),
  /** Number of bottom positions that face relegation (0 = not configured) */
  relegationSlots: integer('relegation_slots').notNull().default(0),
  /** Last time data was fetched from CHPP */
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type TournamentRow = typeof tournamentsTable.$inferSelect;
export type NewTournamentRow = typeof tournamentsTable.$inferInsert;

// ─── tournament_standings ────────────────────────────────────────────────────

/**
 * League standings per team within a tournament group.
 * Overwritten entirely on each sync (delete-then-insert).
 */
export const tournamentStandingsTable = sqliteTable('tournament_standings', {
  id: text('id').primaryKey(),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: 'cascade' }),
  /** CHPP GroupId: 1 = A, 2 = B, etc. */
  groupId: integer('group_id').notNull(),
  htTeamId: integer('ht_team_id').notNull(),
  teamName: text('team_name').notNull(),
  /** Position in the standings (1-based) */
  position: integer('position').notNull(),
  played: integer('played').notNull().default(0),
  won: integer('won').notNull().default(0),
  drawn: integer('drawn').notNull().default(0),
  lost: integer('lost').notNull().default(0),
  goalsFor: integer('goals_for').notNull().default(0),
  goalsAgainst: integer('goals_against').notNull().default(0),
  points: integer('points').notNull().default(0),
});

export type TournamentStandingRow = typeof tournamentStandingsTable.$inferSelect;
export type NewTournamentStandingRow = typeof tournamentStandingsTable.$inferInsert;

// ─── tournament_matches ──────────────────────────────────────────────────────

/**
 * Match calendar/results for a tournament.
 * Updated on each sync — upsert by ht_match_id.
 */
export const tournamentMatchesTable = sqliteTable('tournament_matches', {
  id: text('id').primaryKey(),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: 'cascade' }),
  htMatchId: integer('ht_match_id').notNull(),
  /** Round/matchday number */
  round: integer('round').notNull(),
  matchDate: text('match_date').notNull(),
  homeTeamId: integer('home_team_id').notNull(),
  homeTeamName: text('home_team_name').notNull(),
  awayTeamId: integer('away_team_id').notNull(),
  awayTeamName: text('away_team_name').notNull(),
  /** null = not yet played */
  homeGoals: integer('home_goals'),
  awayGoals: integer('away_goals'),
  /** "Finished", "Upcoming", etc. */
  status: text('status').notNull().default('Upcoming'),
});

export type TournamentMatchRow = typeof tournamentMatchesTable.$inferSelect;
export type NewTournamentMatchRow = typeof tournamentMatchesTable.$inferInsert;
