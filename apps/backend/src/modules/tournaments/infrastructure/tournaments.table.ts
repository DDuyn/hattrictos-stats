import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
  /** Hattrick team ID — JOIN with teams.ht_team_id to resolve name */
  htTeamId: integer('ht_team_id').notNull(),
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
  /** Hattrick team ID — JOIN with teams.ht_team_id to resolve name */
  homeTeamId: integer('home_team_id').notNull(),
  /** Hattrick team ID — JOIN with teams.ht_team_id to resolve name */
  awayTeamId: integer('away_team_id').notNull(),
  /** null = not yet played */
  homeGoals: integer('home_goals'),
  awayGoals: integer('away_goals'),
  /** "Finished", "Upcoming", etc. */
  status: text('status').notNull().default('Upcoming'),
  /**
   * 1 = matchdetails + matchlineup synced, 0 = pending.
   * Only set to 1 for Finished matches after fetching goals + appearances.
   */
  detailsSynced: integer('details_synced').notNull().default(0),
});

export type TournamentMatchRow = typeof tournamentMatchesTable.$inferSelect;
export type NewTournamentMatchRow = typeof tournamentMatchesTable.$inferInsert;

// ─── match_events ─────────────────────────────────────────────────────────────

/**
 * Relevant match events — primarily goals (EventTypeID 100-199).
 * Populated from matchdetails CHPP endpoint (version 3.1, sourceSystem=HTOIntegrated).
 * Deleted and re-inserted if the match is re-synced (should not happen normally).
 *
 * For goals:
 *   subjectPlayerId/Name = scorer
 *   objectPlayerId/Name  = assist provider
 */
export const matchEventsTable = sqliteTable('match_events', {
  id: text('id').primaryKey(),
  matchId: text('match_id')
    .notNull()
    .references(() => tournamentMatchesTable.id, { onDelete: 'cascade' }),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: 'cascade' }),
  /** CHPP EventTypeID — 100-199 = goals */
  eventTypeId: integer('event_type_id').notNull(),
  minute: integer('minute').notNull(),
  /** Hattrick player ID of the scorer — JOIN with players.ht_player_id */
  subjectPlayerId: integer('subject_player_id'),
  /** Hattrick team ID of the scorer */
  subjectTeamId: integer('subject_team_id'),
  /** Hattrick player ID of the assist provider — JOIN with players.ht_player_id */
  objectPlayerId: integer('object_player_id'),
});

export type MatchEventRow = typeof matchEventsTable.$inferSelect;
export type NewMatchEventRow = typeof matchEventsTable.$inferInsert;

// ─── match_appearances ────────────────────────────────────────────────────────

/**
 * Player appearances per match — starters and substitutes.
 * Populated from matchlineup CHPP endpoint (version 2.1, sourceSystem=HTOIntegrated).
 *
 * minuteIn:  0 for starters, substitution minute for subs
 * minuteOut: substitution minute if replaced, null if played until end
 * ratingStars: player rating for that match (from Lineup section)
 */
export const matchAppearancesTable = sqliteTable('match_appearances', {
  id: text('id').primaryKey(),
  matchId: text('match_id')
    .notNull()
    .references(() => tournamentMatchesTable.id, { onDelete: 'cascade' }),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: 'cascade' }),
  /** Hattrick player ID — JOIN with players.ht_player_id to resolve name */
  htPlayerId: integer('ht_player_id').notNull(),
  /** Hattrick team ID — JOIN with teams.ht_team_id to resolve name */
  htTeamId: integer('ht_team_id').notNull(),
  /** CHPP RoleID: 100=GK, 101-113=field positions, 114-118=substitutes */
  roleId: integer('role_id').notNull(),
  /** CHPP BehaviourID: 0=Normal, 1=Offensive, 2=Defensive, 3=ToMiddle, 4=ToWing */
  behaviour: integer('behaviour').notNull().default(0),
  minuteIn: integer('minute_in').notNull().default(0),
  /** null = played until full time */
  minuteOut: integer('minute_out'),
  ratingStars: real('rating_stars'),
});

export type MatchAppearanceRow = typeof matchAppearancesTable.$inferSelect;
export type NewMatchAppearanceRow = typeof matchAppearancesTable.$inferInsert;
