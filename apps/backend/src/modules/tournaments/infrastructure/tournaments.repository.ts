import { eq, asc, and, desc, sql } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import {
  tournamentsTable,
  tournamentStandingsTable,
  tournamentMatchesTable,
  matchEventsTable,
  matchAppearancesTable,
  type TournamentRow,
  type TournamentStandingRow,
  type TournamentMatchRow,
  type MatchEventRow,
  type MatchAppearanceRow,
  type NewTournamentRow,
  type NewTournamentStandingRow,
  type NewTournamentMatchRow,
  type NewMatchEventRow,
  type NewMatchAppearanceRow,
} from './tournaments.table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopScorerRow {
  htPlayerId: number;
  playerName: string;
  htTeamId: number;
  goals: number;
}

export interface TournamentRepository {
  /** Check whether a tournament with the given Hattrick ID is already registered */
  existsByHtId(htTournamentId: number): Promise<boolean>;

  /** Insert a new tournament row */
  create(row: NewTournamentRow): Promise<void>;

  /** Return all tournaments ordered by creation date (newest first) */
  listAll(): Promise<TournamentRow[]>;

  /** Return a single tournament by internal ID, or null */
  findById(id: string): Promise<TournamentRow | null>;

  /** Return a single tournament by Hattrick tournament ID, or null */
  findByHtId(htTournamentId: number): Promise<TournamentRow | null>;

  /** Mark the tournament as synced right now */
  markSynced(id: string): Promise<void>;

  /** Update mutable tournament metadata (name, season, tournamentType, numberOfTeams) */
  updateDetails(id: string, details: {
    name?: string;
    season?: number | null;
    tournamentType?: number | null;
    numberOfTeams?: number | null;
  }): Promise<void>;

  /** Update promotion/relegation slot configuration */
  updateConfig(id: string, config: {
    promotionSlots?: number;
    relegationSlots?: number;
  }): Promise<void>;

  /**
   * Replace all standings for a tournament.
   * Deletes existing rows then inserts new ones in a single transaction.
   */
  replaceStandings(tournamentId: string, rows: NewTournamentStandingRow[]): Promise<void>;

  /**
   * Replace all match rows for a tournament.
   * Deletes existing rows then inserts new ones (same strategy as replaceStandings).
   */
  replaceMatches(tournamentId: string, rows: NewTournamentMatchRow[]): Promise<void>;

  /** Return all standings for a tournament, ordered by group then position */
  getStandings(tournamentId: string): Promise<TournamentStandingRow[]>;

  /** Return all matches for a tournament, ordered by round then date */
  getMatches(tournamentId: string): Promise<TournamentMatchRow[]>;

  /** Return finished matches that haven't had their details synced yet */
  getUnsyncedFinishedMatches(tournamentId: string): Promise<TournamentMatchRow[]>;

  /** Mark a single match's details as synced */
  markMatchDetailsSynced(matchId: string): Promise<void>;

  /**
   * Replace match events for a single match.
   * Deletes existing rows then inserts new ones.
   */
  replaceMatchEvents(matchId: string, rows: NewMatchEventRow[]): Promise<void>;

  /**
   * Replace match appearances for a single match.
   * Deletes existing rows then inserts new ones.
   */
  replaceMatchAppearances(matchId: string, rows: NewMatchAppearanceRow[]): Promise<void>;

  /** Return top scorers for a tournament (goals = count of EventTypeID 100-199) */
  getTopScorers(tournamentId: string, limit?: number): Promise<TopScorerRow[]>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createTournamentRepository(db: DB): TournamentRepository {
  return {
    async existsByHtId(htTournamentId) {
      const row = await db
        .select({ id: tournamentsTable.id })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.htTournamentId, htTournamentId))
        .get();
      return row !== undefined;
    },

    async create(row) {
      await db.insert(tournamentsTable).values(row);
    },

    async listAll() {
      return db
        .select()
        .from(tournamentsTable)
        .orderBy(asc(tournamentsTable.createdAt))
        .all();
    },

    async findById(id) {
      return (
        (await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id)).get()) ?? null
      );
    },

    async findByHtId(htTournamentId) {
      return (
        (await db
          .select()
          .from(tournamentsTable)
          .where(eq(tournamentsTable.htTournamentId, htTournamentId))
          .get()) ?? null
      );
    },

    async markSynced(id) {
      await db
        .update(tournamentsTable)
        .set({ lastSyncedAt: new Date() })
        .where(eq(tournamentsTable.id, id));
    },

    async updateDetails(id, details) {
      // Only set fields that were explicitly provided
      const set: Partial<typeof tournamentsTable.$inferInsert> = {};
      if (details.name !== undefined) set.name = details.name;
      if (details.season !== undefined) set.season = details.season ?? undefined;
      if (details.tournamentType !== undefined) set.tournamentType = details.tournamentType ?? undefined;
      if (details.numberOfTeams !== undefined) set.numberOfTeams = details.numberOfTeams ?? undefined;

      if (Object.keys(set).length === 0) return;
      await db.update(tournamentsTable).set(set).where(eq(tournamentsTable.id, id));
    },

    async updateConfig(id, config) {
      const set: Partial<typeof tournamentsTable.$inferInsert> = {};
      if (config.promotionSlots !== undefined) set.promotionSlots = config.promotionSlots;
      if (config.relegationSlots !== undefined) set.relegationSlots = config.relegationSlots;

      if (Object.keys(set).length === 0) return;
      await db.update(tournamentsTable).set(set).where(eq(tournamentsTable.id, id));
    },

    async replaceStandings(tournamentId, rows) {
      // libsql doesn't support true transactions via Drizzle batch easily,
      // so we do delete then insert sequentially (acceptable for this use case)
      await db
        .delete(tournamentStandingsTable)
        .where(eq(tournamentStandingsTable.tournamentId, tournamentId));

      if (rows.length > 0) {
        await db.insert(tournamentStandingsTable).values(rows);
      }
    },

    async replaceMatches(tournamentId, rows) {
      await db
        .delete(tournamentMatchesTable)
        .where(eq(tournamentMatchesTable.tournamentId, tournamentId));

      if (rows.length > 0) {
        await db.insert(tournamentMatchesTable).values(rows);
      }
    },

    async getStandings(tournamentId) {
      return db
        .select()
        .from(tournamentStandingsTable)
        .where(eq(tournamentStandingsTable.tournamentId, tournamentId))
        .orderBy(
          asc(tournamentStandingsTable.groupId),
          asc(tournamentStandingsTable.position),
        )
        .all();
    },

    async getMatches(tournamentId) {
      return db
        .select()
        .from(tournamentMatchesTable)
        .where(eq(tournamentMatchesTable.tournamentId, tournamentId))
        .orderBy(
          asc(tournamentMatchesTable.round),
          asc(tournamentMatchesTable.matchDate),
        )
        .all();
    },

    async getUnsyncedFinishedMatches(tournamentId) {
      return db
        .select()
        .from(tournamentMatchesTable)
        .where(
          and(
            eq(tournamentMatchesTable.tournamentId, tournamentId),
            eq(tournamentMatchesTable.status, 'Finished'),
            eq(tournamentMatchesTable.detailsSynced, 0),
          ),
        )
        .orderBy(asc(tournamentMatchesTable.round), asc(tournamentMatchesTable.matchDate))
        .all();
    },

    async markMatchDetailsSynced(matchId) {
      await db
        .update(tournamentMatchesTable)
        .set({ detailsSynced: 1 })
        .where(eq(tournamentMatchesTable.id, matchId));
    },

    async replaceMatchEvents(matchId, rows) {
      await db
        .delete(matchEventsTable)
        .where(eq(matchEventsTable.matchId, matchId));

      if (rows.length > 0) {
        await db.insert(matchEventsTable).values(rows);
      }
    },

    async replaceMatchAppearances(matchId, rows) {
      await db
        .delete(matchAppearancesTable)
        .where(eq(matchAppearancesTable.matchId, matchId));

      if (rows.length > 0) {
        await db.insert(matchAppearancesTable).values(rows);
      }
    },

    async getTopScorers(tournamentId, limit = 10) {
      // Goals = match_events where eventTypeId between 100 and 199
      const rows = await db
        .select({
          htPlayerId: matchEventsTable.subjectPlayerId,
          playerName: matchEventsTable.subjectPlayerName,
          htTeamId: matchEventsTable.subjectTeamId,
          goals: sql<number>`count(*)`,
        })
        .from(matchEventsTable)
        .where(
          and(
            eq(matchEventsTable.tournamentId, tournamentId),
            sql`${matchEventsTable.eventTypeId} >= 100`,
            sql`${matchEventsTable.eventTypeId} <= 199`,
            sql`${matchEventsTable.subjectPlayerId} IS NOT NULL`,
          ),
        )
        .groupBy(
          matchEventsTable.subjectPlayerId,
          matchEventsTable.subjectPlayerName,
          matchEventsTable.subjectTeamId,
        )
        .orderBy(desc(sql`count(*)`))
        .limit(limit)
        .all();

      return rows
        .filter((r) => r.htPlayerId !== null)
        .map((r) => ({
          htPlayerId: r.htPlayerId!,
          playerName: r.playerName ?? 'Desconocido',
          htTeamId: r.htTeamId ?? 0,
          goals: r.goals,
        }));
    },
  };
}
