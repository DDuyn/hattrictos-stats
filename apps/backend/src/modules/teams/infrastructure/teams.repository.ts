import { asc, eq, sql, and, between } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../../infrastructure/db/client';
import {
  teamsTable,
  tournamentTeamSeasonsTable,
  type TeamRow,
  type TournamentTeamSeasonRow,
} from './teams.table';
import { tournamentsTable } from '../../tournaments/infrastructure/tournaments.table';
import {
  tournamentStandingsTable,
  matchEventsTable,
  matchAppearancesTable,
  matchBookingsTable,
} from '../../tournaments/infrastructure/tournaments.table';
import { playersTable } from '../../players/infrastructure/players.table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpsertTeamInput {
  htTeamId: number;
  name: string;
  shortName?: string;
}

export interface UpdateTeamDetailsInput {
  shortName?: string;
  managerLoginName?: string;
  leagueName?: string;
  arenaName?: string;
  foundedDate?: string;
}

/** Team with the list of tournaments it has participated in */
export interface TeamWithTournaments extends TeamRow {
  tournaments: { id: string; name: string; season: number | null }[];
}

/** Aggregated W/D/L stats across all tournaments */
export interface TeamGlobalStats {
  totalPlayed: number;
  totalWon: number;
  totalDrawn: number;
  totalLost: number;
  totalGoalsFor: number;
  totalGoalsAgainst: number;
}

/** Player entry for top scorers / minutes / cards rankings */
export interface PlayerStat {
  htPlayerId: number;
  firstName: string;
  lastName: string;
  value: number; // goals, minutes, or card count
  /** Only for cards: yellow card count */
  yellows?: number;
  /** Only for cards: red card count (direct + double-yellow) */
  reds?: number;
}

export interface TeamsRepository {
  /** Insert or update a team by htTeamId. Returns the team row. */
  upsertTeam(input: UpsertTeamInput): Promise<TeamRow>;

  /** Find a team by its Hattrick team ID. */
  findByHtId(htTeamId: number): Promise<TeamRow | null>;

  /** Replace all tournament_team_seasons for a given tournament (delete + insert). */
  replaceTeamSeasons(tournamentId: string, htTeamIds: number[]): Promise<void>;

  /** List all teams that participated in a tournament. */
  listByTournament(tournamentId: string): Promise<TournamentTeamSeasonRow[]>;

  /**
   * List all teams in the system, each with the tournaments they participate in.
   * Ordered by team name.
   */
  listAllWithTournaments(): Promise<TeamWithTournaments[]>;

  /** Update enriched details from CHPP teamdetails endpoint. */
  updateTeamDetails(htTeamId: number, input: UpdateTeamDetailsInput): Promise<void>;

  /** Update the players_synced_at timestamp for a team. */
  updatePlayersSyncedAt(htTeamId: number, syncedAt: Date): Promise<void>;

  /** Update or clear the logo URL for a team. Pass null to remove the logo. */
  updateLogoUrl(htTeamId: number, logoUrl: string | null): Promise<void>;

  /** Aggregate W/D/L stats for a team across all tournaments. */
  getGlobalStats(htTeamId: number): Promise<TeamGlobalStats>;

  /** Top N goal scorers for a team. Pass tournamentId to filter to a single competition. */
  getTopScorers(htTeamId: number, limit: number, tournamentId?: string): Promise<PlayerStat[]>;

  /** Top N players by minutes played for a team. Pass tournamentId to filter to a single competition. */
  getTopMinutes(htTeamId: number, limit: number, tournamentId?: string): Promise<PlayerStat[]>;

  /** Top N players by card count for a team. Pass tournamentId to filter to a single competition. */
  getTopCards(htTeamId: number, limit: number, tournamentId?: string): Promise<PlayerStat[]>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createTeamsRepository(db: DB): TeamsRepository {
  return {
    async upsertTeam(input) {
      // Use INSERT OR IGNORE + UPDATE to avoid race conditions with parallel upserts
      const id = randomUUID();
      await db
        .insert(teamsTable)
        .values({ id, htTeamId: input.htTeamId, name: input.name, shortName: input.shortName ?? '' })
        .onConflictDoUpdate({
          target: teamsTable.htTeamId,
          set: { name: input.name, shortName: input.shortName ?? '' },
        });

      const row = await db
        .select()
        .from(teamsTable)
        .where(eq(teamsTable.htTeamId, input.htTeamId))
        .get();
      return row as TeamRow;
    },

    async findByHtId(htTeamId) {
      return (
        (await db.select().from(teamsTable).where(eq(teamsTable.htTeamId, htTeamId)).get()) ?? null
      );
    },

    async replaceTeamSeasons(tournamentId, htTeamIds) {
      // Delete existing seasons for this tournament
      await db
        .delete(tournamentTeamSeasonsTable)
        .where(eq(tournamentTeamSeasonsTable.tournamentId, tournamentId));

      if (htTeamIds.length === 0) return;

      // We need team UUIDs — fetch them
      const rows = await Promise.all(
        htTeamIds.map(async (htTeamId) => {
          const team = await db
            .select({ id: teamsTable.id })
            .from(teamsTable)
            .where(eq(teamsTable.htTeamId, htTeamId))
            .get();
          if (!team) return null;
          return {
            id: randomUUID(),
            tournamentId,
            teamId: team.id,
            htTeamId,
          };
        }),
      );

      const validRows = rows.filter((r) => r !== null);
      if (validRows.length > 0) {
        await db.insert(tournamentTeamSeasonsTable).values(validRows);
      }
    },

    async listByTournament(tournamentId) {
      return db
        .select()
        .from(tournamentTeamSeasonsTable)
        .where(eq(tournamentTeamSeasonsTable.tournamentId, tournamentId))
        .all();
    },

    async listAllWithTournaments() {
      // Fetch all teams ordered by name
      const teams = await db
        .select()
        .from(teamsTable)
        .orderBy(asc(teamsTable.name))
        .all();

      if (teams.length === 0) return [];

      // Fetch all tournament memberships with tournament details in one query
      const memberships = await db
        .select({
          htTeamId: tournamentTeamSeasonsTable.htTeamId,
          tournamentId: tournamentsTable.id,
          tournamentName: tournamentsTable.name,
          tournamentSeason: tournamentsTable.season,
        })
        .from(tournamentTeamSeasonsTable)
        .leftJoin(tournamentsTable, eq(tournamentTeamSeasonsTable.tournamentId, tournamentsTable.id))
        .orderBy(asc(sql`COALESCE(${tournamentsTable.season}, 0)`))
        .all();

      // Group memberships by htTeamId
      const membershipMap = new Map<number, { id: string; name: string; season: number | null }[]>();
      for (const m of memberships) {
        if (!m.tournamentId || !m.tournamentName) continue;
        const list = membershipMap.get(m.htTeamId) ?? [];
        list.push({ id: m.tournamentId, name: m.tournamentName, season: m.tournamentSeason ?? null });
        membershipMap.set(m.htTeamId, list);
      }

      return teams.map((team) => ({
        ...team,
        tournaments: membershipMap.get(team.htTeamId) ?? [],
      }));
    },

    async updateTeamDetails(htTeamId, input) {
      const set: Partial<typeof teamsTable.$inferInsert> = {};
      if (input.shortName !== undefined) set.shortName = input.shortName;
      if (input.managerLoginName !== undefined) set.managerLoginName = input.managerLoginName;
      if (input.leagueName !== undefined) set.leagueName = input.leagueName;
      if (input.arenaName !== undefined) set.arenaName = input.arenaName;
      if (input.foundedDate !== undefined) set.foundedDate = input.foundedDate;

      if (Object.keys(set).length === 0) return;

      await db.update(teamsTable).set(set).where(eq(teamsTable.htTeamId, htTeamId));
    },

    async updatePlayersSyncedAt(htTeamId, syncedAt) {
      await db
        .update(teamsTable)
        .set({ playersSyncedAt: syncedAt })
        .where(eq(teamsTable.htTeamId, htTeamId));
    },

    async updateLogoUrl(htTeamId, logoUrl) {
      await db
        .update(teamsTable)
        .set({ logoUrl })
        .where(eq(teamsTable.htTeamId, htTeamId));
    },

    async getGlobalStats(htTeamId) {
      const row = await db
        .select({
          totalPlayed: sql<number>`COALESCE(SUM(${tournamentStandingsTable.played}), 0)`,
          totalWon: sql<number>`COALESCE(SUM(${tournamentStandingsTable.won}), 0)`,
          totalDrawn: sql<number>`COALESCE(SUM(${tournamentStandingsTable.drawn}), 0)`,
          totalLost: sql<number>`COALESCE(SUM(${tournamentStandingsTable.lost}), 0)`,
          totalGoalsFor: sql<number>`COALESCE(SUM(${tournamentStandingsTable.goalsFor}), 0)`,
          totalGoalsAgainst: sql<number>`COALESCE(SUM(${tournamentStandingsTable.goalsAgainst}), 0)`,
        })
        .from(tournamentStandingsTable)
        .where(eq(tournamentStandingsTable.htTeamId, htTeamId))
        .get();

      return row ?? {
        totalPlayed: 0,
        totalWon: 0,
        totalDrawn: 0,
        totalLost: 0,
        totalGoalsFor: 0,
        totalGoalsAgainst: 0,
      };
    },

    async getTopScorers(htTeamId, limit, tournamentId?) {
      // Goals: eventTypeId 100–199, subjectTeamId = team
      const rows = await db
        .select({
          htPlayerId: matchEventsTable.subjectPlayerId,
          firstName: playersTable.firstName,
          lastName: playersTable.lastName,
          goals: sql<number>`COUNT(*)`,
        })
        .from(matchEventsTable)
        .leftJoin(playersTable, eq(matchEventsTable.subjectPlayerId, playersTable.htPlayerId))
        .where(
          and(
            eq(matchEventsTable.subjectTeamId, htTeamId),
            between(matchEventsTable.eventTypeId, 100, 199),
            tournamentId ? eq(matchEventsTable.tournamentId, tournamentId) : undefined,
          ),
        )
        .groupBy(matchEventsTable.subjectPlayerId)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(limit)
        .all();

      return rows
        .filter((r) => r.htPlayerId !== null)
        .map((r) => ({
          htPlayerId: r.htPlayerId as number,
          firstName: r.firstName ?? '?',
          lastName: r.lastName ?? `Jugador ${r.htPlayerId}`,
          value: r.goals,
        }));
    },

    async getTopMinutes(htTeamId, limit, tournamentId?) {
      const rows = await db
        .select({
          htPlayerId: matchAppearancesTable.htPlayerId,
          firstName: playersTable.firstName,
          lastName: playersTable.lastName,
          minutes: sql<number>`SUM(COALESCE(${matchAppearancesTable.minuteOut}, 90) - ${matchAppearancesTable.minuteIn})`,
        })
        .from(matchAppearancesTable)
        .leftJoin(playersTable, eq(matchAppearancesTable.htPlayerId, playersTable.htPlayerId))
        .where(
          and(
            eq(matchAppearancesTable.htTeamId, htTeamId),
            tournamentId ? eq(matchAppearancesTable.tournamentId, tournamentId) : undefined,
          ),
        )
        .groupBy(matchAppearancesTable.htPlayerId)
        .orderBy(sql`SUM(COALESCE(${matchAppearancesTable.minuteOut}, 90) - ${matchAppearancesTable.minuteIn}) DESC`)
        .limit(limit)
        .all();

      return rows.map((r) => ({
        htPlayerId: r.htPlayerId,
        firstName: r.firstName ?? '?',
        lastName: r.lastName ?? `Jugador ${r.htPlayerId}`,
        value: r.minutes,
      }));
    },

    async getTopCards(htTeamId, limit, tournamentId?) {
      // Count yellows (bookingType=1) and reds (bookingType=2) per player
      const rows = await db
        .select({
          htPlayerId: matchBookingsTable.htPlayerId,
          firstName: playersTable.firstName,
          lastName: playersTable.lastName,
          yellows: sql<number>`SUM(CASE WHEN ${matchBookingsTable.bookingType} = 1 THEN 1 ELSE 0 END)`,
          reds: sql<number>`SUM(CASE WHEN ${matchBookingsTable.bookingType} = 2 THEN 1 ELSE 0 END)`,
          total: sql<number>`COUNT(*)`,
        })
        .from(matchBookingsTable)
        .leftJoin(playersTable, eq(matchBookingsTable.htPlayerId, playersTable.htPlayerId))
        .where(
          and(
            eq(matchBookingsTable.htTeamId, htTeamId),
            tournamentId ? eq(matchBookingsTable.tournamentId, tournamentId) : undefined,
          ),
        )
        .groupBy(matchBookingsTable.htPlayerId)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(limit)
        .all();

      return rows.map((r) => ({
        htPlayerId: r.htPlayerId,
        firstName: r.firstName ?? '?',
        lastName: r.lastName ?? `Jugador ${r.htPlayerId}`,
        value: r.total,
        yellows: r.yellows,
        reds: r.reds,
      }));
    },
  };
}
