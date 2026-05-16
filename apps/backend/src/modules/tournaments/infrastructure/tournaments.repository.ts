import { eq, asc, and, desc, sql } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import {
  tournamentsTable,
  tournamentStandingsTable,
  tournamentMatchesTable,
  matchEventsTable,
  matchAppearancesTable,
  matchBookingsTable,
  type TournamentRow,
  type TournamentStandingRow,
  type TournamentMatchRow,
  type MatchEventRow,
  type MatchAppearanceRow,
  type MatchBookingRow,
  type NewTournamentRow,
  type NewTournamentStandingRow,
  type NewTournamentMatchRow,
  type NewMatchEventRow,
  type NewMatchAppearanceRow,
  type NewMatchBookingRow,
} from './tournaments.table';
import { teamsTable } from '../../teams/infrastructure/teams.table';
import { playersTable } from '../../players/infrastructure/players.table';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Standing row augmented with team name resolved via JOIN */
export interface StandingWithTeam extends Omit<TournamentStandingRow, never> {
  teamName: string;
}

/** Match row augmented with team names resolved via JOIN */
export interface MatchWithTeams extends Omit<TournamentMatchRow, never> {
  homeTeamName: string;
  awayTeamName: string;
  /** Only populated when fetching a single match (getMatchById) */
  tournamentName?: string;
  /** Only populated when fetching a single match (getMatchById) */
  homeTeamLogo?: string | null;
  /** Only populated when fetching a single match (getMatchById) */
  awayTeamLogo?: string | null;
}

/** Match event row augmented with player names resolved via JOIN */
export interface MatchEventWithPlayers extends Omit<MatchEventRow, never> {
  subjectPlayerName: string | null;
  objectPlayerName: string | null;
}

/** Match appearance row augmented with player and team name resolved via JOIN */
export interface MatchAppearanceWithNames extends Omit<MatchAppearanceRow, never> {
  playerName: string;
  teamName: string;
}

/** Match booking row augmented with player and team name resolved via JOIN */
export interface MatchBookingWithPlayer extends Omit<MatchBookingRow, never> {
  playerName: string;
  teamName: string;
  /**
   * true when bookingType=2 AND the same player already has a bookingType=1
   * in the same match — i.e. this red was a second yellow, not a direct red.
   * Inferred client-side from the full booking list for the match.
   */
  isYellowRed: boolean;
}

export interface TopCardRow {
  htPlayerId: number;
  playerName: string;
  htTeamId: number;
  teamName: string;
  yellowCards: number;
  /** BookingType=2 where the player also had a BookingType=1 in the same match */
  yellowRedCards: number;
  /** BookingType=2 where the player had NO BookingType=1 in the same match */
  redCards: number;
  totalCards: number;
}

export interface TopScorerRow {
  htPlayerId: number;
  playerName: string;
  htTeamId: number;
  teamName: string;
  goals: number;
}

export interface TopMinutesRow {
  htPlayerId: number;
  playerName: string;
  htTeamId: number;
  teamName: string;
  minutes: number;
  appearances: number;
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

  /** Return all standings for a tournament with team names resolved via JOIN */
  getStandings(tournamentId: string): Promise<StandingWithTeam[]>;

  /** Return all matches for a tournament with team names resolved via JOIN */
  getMatches(tournamentId: string): Promise<MatchWithTeams[]>;

  /** Return a single match by internal ID with team names resolved via JOIN */
  getMatchById(matchId: string): Promise<MatchWithTeams | null>;

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

  /** Return events for a single match with player names resolved via JOIN */
  getMatchEvents(matchId: string): Promise<MatchEventWithPlayers[]>;

  /** Return appearances for a single match with player and team names resolved via JOIN */
  getMatchAppearances(matchId: string): Promise<MatchAppearanceWithNames[]>;

  /** Return top scorers for a tournament (goals = count of EventTypeID 100-199) */
  getTopScorers(tournamentId: string, limit?: number): Promise<TopScorerRow[]>;

  /** Return players ranked by total minutes played in the tournament */
  getTopMinutes(tournamentId: string, limit?: number): Promise<TopMinutesRow[]>;

  /**
   * Replace match bookings (cards) for a single match.
   * Deletes existing rows then inserts new ones.
   */
  replaceMatchBookings(matchId: string, rows: NewMatchBookingRow[]): Promise<void>;

  /** Return bookings for a single match with player and team names resolved via JOIN */
  getMatchBookings(matchId: string): Promise<MatchBookingWithPlayer[]>;

  /** Return players ranked by total cards in the tournament */
  getTopCards(tournamentId: string, limit?: number): Promise<TopCardRow[]>;

  /**
   * Return the most recent matches for a team (by htTeamId) across all tournaments,
   * with team names and tournament name resolved via JOIN.
   */
  getRecentMatchesByTeam(htTeamId: number, limit?: number): Promise<MatchWithTeams[]>;
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
      // Alias teams table for the JOIN
      const teamAlias = teamsTable;

      const rows = await db
        .select({
          id: tournamentStandingsTable.id,
          tournamentId: tournamentStandingsTable.tournamentId,
          groupId: tournamentStandingsTable.groupId,
          htTeamId: tournamentStandingsTable.htTeamId,
          teamName: sql<string>`COALESCE(${teamAlias.name}, 'Team ' || ${tournamentStandingsTable.htTeamId})`,
          position: tournamentStandingsTable.position,
          played: tournamentStandingsTable.played,
          won: tournamentStandingsTable.won,
          drawn: tournamentStandingsTable.drawn,
          lost: tournamentStandingsTable.lost,
          goalsFor: tournamentStandingsTable.goalsFor,
          goalsAgainst: tournamentStandingsTable.goalsAgainst,
          points: tournamentStandingsTable.points,
        })
        .from(tournamentStandingsTable)
        .leftJoin(teamAlias, eq(tournamentStandingsTable.htTeamId, teamAlias.htTeamId))
        .where(eq(tournamentStandingsTable.tournamentId, tournamentId))
        .orderBy(
          asc(tournamentStandingsTable.groupId),
          asc(tournamentStandingsTable.position),
        )
        .all();

      return rows as StandingWithTeam[];
    },

    async getMatches(tournamentId) {
      // We need two JOINs for home and away teams — use aliased tables via SQL
      const rows = await db
        .select({
          id: tournamentMatchesTable.id,
          tournamentId: tournamentMatchesTable.tournamentId,
          htMatchId: tournamentMatchesTable.htMatchId,
          round: tournamentMatchesTable.round,
          matchDate: tournamentMatchesTable.matchDate,
          homeTeamId: tournamentMatchesTable.homeTeamId,
          homeTeamName: sql<string>`COALESCE(home_team.name, 'Team ' || ${tournamentMatchesTable.homeTeamId})`,
          awayTeamId: tournamentMatchesTable.awayTeamId,
          awayTeamName: sql<string>`COALESCE(away_team.name, 'Team ' || ${tournamentMatchesTable.awayTeamId})`,
          homeGoals: tournamentMatchesTable.homeGoals,
          awayGoals: tournamentMatchesTable.awayGoals,
          status: tournamentMatchesTable.status,
          detailsSynced: tournamentMatchesTable.detailsSynced,
        })
        .from(tournamentMatchesTable)
        .leftJoin(
          sql`${teamsTable} AS home_team`,
          sql`${tournamentMatchesTable.homeTeamId} = home_team.ht_team_id`,
        )
        .leftJoin(
          sql`${teamsTable} AS away_team`,
          sql`${tournamentMatchesTable.awayTeamId} = away_team.ht_team_id`,
        )
        .where(eq(tournamentMatchesTable.tournamentId, tournamentId))
        .orderBy(
          asc(tournamentMatchesTable.round),
          asc(tournamentMatchesTable.matchDate),
        )
        .all();

      return rows as MatchWithTeams[];
    },

    async getMatchById(matchId) {
      const rows = await db
        .select({
          id: tournamentMatchesTable.id,
          tournamentId: tournamentMatchesTable.tournamentId,
          htMatchId: tournamentMatchesTable.htMatchId,
          round: tournamentMatchesTable.round,
          matchDate: tournamentMatchesTable.matchDate,
          homeTeamId: tournamentMatchesTable.homeTeamId,
          homeTeamName: sql<string>`COALESCE(home_team.name, 'Team ' || ${tournamentMatchesTable.homeTeamId})`,
          homeTeamLogo: sql<string | null>`home_team.logo_url`,
          awayTeamId: tournamentMatchesTable.awayTeamId,
          awayTeamName: sql<string>`COALESCE(away_team.name, 'Team ' || ${tournamentMatchesTable.awayTeamId})`,
          awayTeamLogo: sql<string | null>`away_team.logo_url`,
          homeGoals: tournamentMatchesTable.homeGoals,
          awayGoals: tournamentMatchesTable.awayGoals,
          status: tournamentMatchesTable.status,
          detailsSynced: tournamentMatchesTable.detailsSynced,
          tournamentName: sql<string>`COALESCE(${tournamentsTable.name}, '')`,
        })
        .from(tournamentMatchesTable)
        .leftJoin(
          sql`${teamsTable} AS home_team`,
          sql`${tournamentMatchesTable.homeTeamId} = home_team.ht_team_id`,
        )
        .leftJoin(
          sql`${teamsTable} AS away_team`,
          sql`${tournamentMatchesTable.awayTeamId} = away_team.ht_team_id`,
        )
        .leftJoin(tournamentsTable, eq(tournamentMatchesTable.tournamentId, tournamentsTable.id))
        .where(eq(tournamentMatchesTable.id, matchId))
        .get();

      return rows ? (rows as MatchWithTeams) : null;
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

    async getMatchEvents(matchId) {
      const subjectPlayer = playersTable;
      const rows = await db
        .select({
          id: matchEventsTable.id,
          matchId: matchEventsTable.matchId,
          tournamentId: matchEventsTable.tournamentId,
          eventTypeId: matchEventsTable.eventTypeId,
          minute: matchEventsTable.minute,
          subjectPlayerId: matchEventsTable.subjectPlayerId,
          subjectTeamId: matchEventsTable.subjectTeamId,
          objectPlayerId: matchEventsTable.objectPlayerId,
          subjectPlayerName: sql<string | null>`subject_player.first_name || ' ' || subject_player.last_name`,
          objectPlayerName: sql<string | null>`object_player.first_name || ' ' || object_player.last_name`,
        })
        .from(matchEventsTable)
        .leftJoin(
          sql`${subjectPlayer} AS subject_player`,
          sql`${matchEventsTable.subjectPlayerId} = subject_player.ht_player_id`,
        )
        .leftJoin(
          sql`${subjectPlayer} AS object_player`,
          sql`${matchEventsTable.objectPlayerId} = object_player.ht_player_id`,
        )
        .where(eq(matchEventsTable.matchId, matchId))
        .orderBy(asc(matchEventsTable.minute))
        .all();

      return rows as MatchEventWithPlayers[];
    },

    async getMatchAppearances(matchId) {
      const rows = await db
        .select({
          id: matchAppearancesTable.id,
          matchId: matchAppearancesTable.matchId,
          tournamentId: matchAppearancesTable.tournamentId,
          htPlayerId: matchAppearancesTable.htPlayerId,
          htTeamId: matchAppearancesTable.htTeamId,
          roleId: matchAppearancesTable.roleId,
          behaviour: matchAppearancesTable.behaviour,
          minuteIn: matchAppearancesTable.minuteIn,
          minuteOut: matchAppearancesTable.minuteOut,
          ratingStars: matchAppearancesTable.ratingStars,
          playerName: sql<string>`COALESCE(${playersTable.firstName} || ' ' || ${playersTable.lastName}, 'Player ' || ${matchAppearancesTable.htPlayerId})`,
          teamName: sql<string>`COALESCE(${teamsTable.name}, 'Team ' || ${matchAppearancesTable.htTeamId})`,
        })
        .from(matchAppearancesTable)
        .leftJoin(playersTable, eq(matchAppearancesTable.htPlayerId, playersTable.htPlayerId))
        .leftJoin(teamsTable, eq(matchAppearancesTable.htTeamId, teamsTable.htTeamId))
        .where(eq(matchAppearancesTable.matchId, matchId))
        .orderBy(asc(matchAppearancesTable.htTeamId), asc(matchAppearancesTable.minuteIn), asc(matchAppearancesTable.roleId))
        .all();

      return rows as MatchAppearanceWithNames[];
    },

    async getTopScorers(tournamentId, limit = 10) {
      // Goals = match_events where eventTypeId between 100 and 199
      const rows = await db
        .select({
          htPlayerId: matchEventsTable.subjectPlayerId,
          playerName: sql<string>`COALESCE(${playersTable.firstName} || ' ' || ${playersTable.lastName}, 'Desconocido')`,
          htTeamId: matchEventsTable.subjectTeamId,
          teamName: sql<string>`COALESCE(${teamsTable.name}, 'Team ' || ${matchEventsTable.subjectTeamId})`,
          goals: sql<number>`count(*)`,
        })
        .from(matchEventsTable)
        .leftJoin(playersTable, eq(matchEventsTable.subjectPlayerId, playersTable.htPlayerId))
        .leftJoin(teamsTable, eq(matchEventsTable.subjectTeamId, teamsTable.htTeamId))
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
          matchEventsTable.subjectTeamId,
          playersTable.firstName,
          playersTable.lastName,
          teamsTable.name,
        )
        .orderBy(desc(sql`count(*)`))
        .limit(limit)
        .all();

      return rows
        .filter((r) => r.htPlayerId !== null)
        .map((r) => ({
          htPlayerId: r.htPlayerId!,
          playerName: r.playerName,
          htTeamId: r.htTeamId ?? 0,
          teamName: r.teamName,
          goals: r.goals,
        }));
    },

    async getTopMinutes(tournamentId, limit = 25) {
      // Minutes = SUM(COALESCE(minute_out, 90) - minute_in) per player
      // Joined across all matches of the tournament via tournamentId column
      const rows = await db
        .select({
          htPlayerId: matchAppearancesTable.htPlayerId,
          playerName: sql<string>`COALESCE(${playersTable.firstName} || ' ' || ${playersTable.lastName}, 'Desconocido')`,
          htTeamId: matchAppearancesTable.htTeamId,
          teamName: sql<string>`COALESCE(${teamsTable.name}, 'Team ' || ${matchAppearancesTable.htTeamId})`,
          minutes: sql<number>`SUM(COALESCE(${matchAppearancesTable.minuteOut}, 90) - ${matchAppearancesTable.minuteIn})`,
          appearances: sql<number>`COUNT(DISTINCT ${matchAppearancesTable.matchId})`,
        })
        .from(matchAppearancesTable)
        .leftJoin(playersTable, eq(matchAppearancesTable.htPlayerId, playersTable.htPlayerId))
        .leftJoin(teamsTable, eq(matchAppearancesTable.htTeamId, teamsTable.htTeamId))
        .where(eq(matchAppearancesTable.tournamentId, tournamentId))
        .groupBy(
          matchAppearancesTable.htPlayerId,
          matchAppearancesTable.htTeamId,
          playersTable.firstName,
          playersTable.lastName,
          teamsTable.name,
        )
        .orderBy(desc(sql`SUM(COALESCE(${matchAppearancesTable.minuteOut}, 90) - ${matchAppearancesTable.minuteIn})`))
        .limit(limit)
        .all();

      return rows.map((r) => ({
        htPlayerId: r.htPlayerId,
        playerName: r.playerName,
        htTeamId: r.htTeamId,
        teamName: r.teamName,
        minutes: r.minutes,
        appearances: r.appearances,
      }));
    },

    async replaceMatchBookings(matchId, rows) {
      await db.delete(matchBookingsTable).where(eq(matchBookingsTable.matchId, matchId));
      if (rows.length > 0) {
        await db.insert(matchBookingsTable).values(rows);
      }
    },

    async getMatchBookings(matchId) {
      const rows = await db
        .select({
          id: matchBookingsTable.id,
          matchId: matchBookingsTable.matchId,
          tournamentId: matchBookingsTable.tournamentId,
          htPlayerId: matchBookingsTable.htPlayerId,
          htTeamId: matchBookingsTable.htTeamId,
          bookingType: matchBookingsTable.bookingType,
          minute: matchBookingsTable.minute,
          playerName: sql<string>`COALESCE(${playersTable.firstName} || ' ' || ${playersTable.lastName}, 'Desconocido')`,
          teamName: sql<string>`COALESCE(${teamsTable.name}, 'Team ' || ${matchBookingsTable.htTeamId})`,
        })
        .from(matchBookingsTable)
        .leftJoin(playersTable, eq(matchBookingsTable.htPlayerId, playersTable.htPlayerId))
        .leftJoin(teamsTable, eq(matchBookingsTable.htTeamId, teamsTable.htTeamId))
        .where(eq(matchBookingsTable.matchId, matchId))
        .orderBy(asc(matchBookingsTable.minute))
        .all();

      // Players who received a yellow (type 1) in this match
      const hadYellow = new Set(
        rows.filter((r) => r.bookingType === 1).map((r) => r.htPlayerId),
      );

      return rows.map((r) => ({
        ...r,
        // A type-2 booking is yellow-red if the player also got a type-1 in the same match
        isYellowRed: r.bookingType === 2 && hadYellow.has(r.htPlayerId),
      }));
    },

    async getTopCards(tournamentId, limit = 25) {
      // BookingType (Hattrick Arena): 1 = yellow, 2 = red (direct OR 2nd yellow)
      // A type-2 is a yellow-red if the same player also received a type-1 in the same match.
      // We detect this with a correlated EXISTS subquery.
      const rows = await db
        .select({
          htPlayerId: matchBookingsTable.htPlayerId,
          playerName: sql<string>`COALESCE(${playersTable.firstName} || ' ' || ${playersTable.lastName}, 'Desconocido')`,
          htTeamId: matchBookingsTable.htTeamId,
          teamName: sql<string>`COALESCE(${teamsTable.name}, 'Team ' || ${matchBookingsTable.htTeamId})`,
          yellowCards: sql<number>`SUM(CASE WHEN ${matchBookingsTable.bookingType} = 1 THEN 1 ELSE 0 END)`,
          yellowRedCards: sql<number>`SUM(
            CASE WHEN ${matchBookingsTable.bookingType} = 2
              AND EXISTS (
                SELECT 1 FROM match_bookings b2
                WHERE b2.match_id = ${matchBookingsTable.matchId}
                  AND b2.ht_player_id = ${matchBookingsTable.htPlayerId}
                  AND b2.booking_type = 1
              )
            THEN 1 ELSE 0 END
          )`,
          redCards: sql<number>`SUM(
            CASE WHEN ${matchBookingsTable.bookingType} = 2
              AND NOT EXISTS (
                SELECT 1 FROM match_bookings b2
                WHERE b2.match_id = ${matchBookingsTable.matchId}
                  AND b2.ht_player_id = ${matchBookingsTable.htPlayerId}
                  AND b2.booking_type = 1
              )
            THEN 1 ELSE 0 END
          )`,
          totalCards: sql<number>`COUNT(*)`,
        })
        .from(matchBookingsTable)
        .leftJoin(playersTable, eq(matchBookingsTable.htPlayerId, playersTable.htPlayerId))
        .leftJoin(teamsTable, eq(matchBookingsTable.htTeamId, teamsTable.htTeamId))
        .where(eq(matchBookingsTable.tournamentId, tournamentId))
        .groupBy(
          matchBookingsTable.htPlayerId,
          matchBookingsTable.htTeamId,
          playersTable.firstName,
          playersTable.lastName,
          teamsTable.name,
        )
        .orderBy(desc(sql`COUNT(*)`))
        .limit(limit)
        .all();

      return rows.map((r) => ({
        htPlayerId: r.htPlayerId,
        playerName: r.playerName,
        htTeamId: r.htTeamId,
        teamName: r.teamName,
        yellowCards: r.yellowCards,
        yellowRedCards: r.yellowRedCards,
        redCards: r.redCards,
        totalCards: r.totalCards,
      }));
    },

    async getRecentMatchesByTeam(htTeamId, limit = 10) {
      const rows = await db
        .select({
          id: tournamentMatchesTable.id,
          tournamentId: tournamentMatchesTable.tournamentId,
          htMatchId: tournamentMatchesTable.htMatchId,
          round: tournamentMatchesTable.round,
          matchDate: tournamentMatchesTable.matchDate,
          homeTeamId: tournamentMatchesTable.homeTeamId,
          homeTeamName: sql<string>`COALESCE(home_team.name, 'Team ' || ${tournamentMatchesTable.homeTeamId})`,
          awayTeamId: tournamentMatchesTable.awayTeamId,
          awayTeamName: sql<string>`COALESCE(away_team.name, 'Team ' || ${tournamentMatchesTable.awayTeamId})`,
          homeGoals: tournamentMatchesTable.homeGoals,
          awayGoals: tournamentMatchesTable.awayGoals,
          status: tournamentMatchesTable.status,
          detailsSynced: tournamentMatchesTable.detailsSynced,
          tournamentName: sql<string>`COALESCE(${tournamentsTable.name}, '')`,
        })
        .from(tournamentMatchesTable)
        .leftJoin(
          sql`${teamsTable} AS home_team`,
          sql`${tournamentMatchesTable.homeTeamId} = home_team.ht_team_id`,
        )
        .leftJoin(
          sql`${teamsTable} AS away_team`,
          sql`${tournamentMatchesTable.awayTeamId} = away_team.ht_team_id`,
        )
        .leftJoin(tournamentsTable, eq(tournamentMatchesTable.tournamentId, tournamentsTable.id))
        .where(
          sql`${tournamentMatchesTable.homeTeamId} = ${htTeamId} OR ${tournamentMatchesTable.awayTeamId} = ${htTeamId}`,
        )
        .orderBy(
          // Finished matches first (most recent on top), Upcoming matches last (soonest first)
          sql`CASE WHEN ${tournamentMatchesTable.status} = 'Finished' THEN 0 ELSE 1 END ASC`,
          sql`CASE WHEN ${tournamentMatchesTable.status} = 'Finished' THEN ${tournamentMatchesTable.matchDate} END DESC`,
          sql`CASE WHEN ${tournamentMatchesTable.status} != 'Finished' THEN ${tournamentMatchesTable.matchDate} END ASC`,
        )
        .limit(limit)
        .all();

      return rows as MatchWithTeams[];
    },
  };
}
