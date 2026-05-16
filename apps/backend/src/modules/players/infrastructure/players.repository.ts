import { asc, desc, eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../../infrastructure/db/client';
import {
  playersTable,
  playerTeamHistoryTable,
  type PlayerRow,
} from './players.table';
import { countriesTable } from './countries.table';
import { teamsTable } from '../../teams/infrastructure/teams.table';
import {
  matchEventsTable,
  matchAppearancesTable,
  matchBookingsTable,
  tournamentMatchesTable,
} from '../../tournaments/infrastructure/tournaments.table';
import { tournamentsTable } from '../../tournaments/infrastructure/tournaments.table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerTeamHistoryEntry {
  htTeamId: number;
  teamName: string;
  logoUrl: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface PlayerMatchStat {
  tournamentId: string;
  tournamentName: string;
  matchId: string;
  htMatchId: number | null;
  round: number | null;
  matchDate: string | null;
  htTeamId: number;
  teamName: string;
  opponentHtTeamId: number | null;
  opponentTeamName: string;
  isHome: boolean;
  roleId: number;
  minuteIn: number;
  minuteOut: number | null;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ratingStars: number | null;
}

export interface UpsertPlayerInput {
  htPlayerId: number;
  firstName: string;
  lastName: string;
  /** When provided, updates currentHtTeamId and player_team_history.
   *  Omit when upserting from match lineups to avoid polluting the roster. */
  htTeamId?: number;
}

export interface UpdatePlayerDetailsInput {
  age: number | null;
  ageDays: number | null;
  countryId: number | null;
}

/** PlayerRow enriquecido con el código ISO del país (resuelto via JOIN con countries) */
export interface PlayerWithCountry extends PlayerRow {
  countryCode: string | null;
  countryName: string | null;
}

export interface PlayersRepository {
  /**
   * Insert or update a player. If the team has changed, records it in
   * player_team_history. Returns the updated player row.
   */
  upsertPlayer(input: UpsertPlayerInput): Promise<PlayerRow>;

  /** Find a player by Hattrick player ID. */
  findByHtId(htPlayerId: number): Promise<PlayerRow | null>;

  /** Find a player by Hattrick player ID, joined with country info. */
  findByHtIdWithCountry(htPlayerId: number): Promise<PlayerWithCountry | null>;

  /** List all players whose current team is the given htTeamId, ordered by last name. */
  listByCurrentTeam(htTeamId: number): Promise<PlayerRow[]>;

  /**
   * List players for a team, joined with countries to resolve countryCode.
   * Ordered by last name, first name.
   */
  listByCurrentTeamWithCountry(htTeamId: number): Promise<PlayerWithCountry[]>;

  /**
   * Update enriched fields (age, ageDays, countryId) for an existing player.
   * Used after calling file=players from CHPP.
   */
  updatePlayerDetails(htPlayerId: number, input: UpdatePlayerDetailsInput): Promise<void>;

  /**
   * Clear the current team for a player (set currentHtTeamId to null).
   * Called when a player is no longer in the CHPP roster for a team.
   */
  clearCurrentTeam(htPlayerId: number): Promise<void>;

  /** Set or clear the player avatar URL. */
  updateAvatarUrl(htPlayerId: number, url: string | null): Promise<void>;

  /**
   * Returns team history for a player, ordered by firstSeenAt desc.
   * Joined with teams to resolve team name and logo.
   */
  getTeamHistory(htPlayerId: number): Promise<PlayerTeamHistoryEntry[]>;

  /**
   * Returns per-match stats for a player across all tournaments.
   * Ordered by match_date desc (most recent first).
   */
  getMatchStats(htPlayerId: number): Promise<PlayerMatchStat[]>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createPlayersRepository(db: DB): PlayersRepository {
  return {
    async upsertPlayer(input) {
      const now = new Date();
      const id = randomUUID();

      // INSERT OR UPDATE atómico — evita race conditions con Promise.all
      await db
        .insert(playersTable)
        .values({
          id,
          htPlayerId: input.htPlayerId,
          firstName: input.firstName,
          lastName: input.lastName,
          // Only set currentHtTeamId when a team is explicitly provided
          // (Phase 4 / CHPP roster). Phase 3 (lineups) omits htTeamId.
          ...(input.htTeamId !== undefined ? { currentHtTeamId: input.htTeamId } : {}),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: playersTable.htPlayerId,
          set: {
            firstName: input.firstName,
            lastName: input.lastName,
            ...(input.htTeamId !== undefined ? { currentHtTeamId: input.htTeamId } : {}),
            updatedAt: now,
          },
        });

      if (input.htTeamId !== undefined) {
        await upsertTeamHistory(db, input.htPlayerId, input.htTeamId, now);
      }

      const row = await db
        .select()
        .from(playersTable)
        .where(eq(playersTable.htPlayerId, input.htPlayerId))
        .get();
      return row as PlayerRow;
    },

    async findByHtId(htPlayerId) {
      return (
        (await db.select().from(playersTable).where(eq(playersTable.htPlayerId, htPlayerId)).get()) ?? null
      );
    },

    async listByCurrentTeam(htTeamId) {
      return db
        .select()
        .from(playersTable)
        .where(eq(playersTable.currentHtTeamId, htTeamId))
        .orderBy(asc(playersTable.lastName), asc(playersTable.firstName))
        .all();
    },

    async listByCurrentTeamWithCountry(htTeamId) {
      const rows = await db
        .select({
          // Player fields
          id: playersTable.id,
          htPlayerId: playersTable.htPlayerId,
          firstName: playersTable.firstName,
          lastName: playersTable.lastName,
          currentHtTeamId: playersTable.currentHtTeamId,
          age: playersTable.age,
          ageDays: playersTable.ageDays,
          countryId: playersTable.countryId,
          createdAt: playersTable.createdAt,
          updatedAt: playersTable.updatedAt,
          avatarUrl: playersTable.avatarUrl,
          // Country fields
          countryCode: countriesTable.countryCode,
          countryName: countriesTable.name,
        })
        .from(playersTable)
        .leftJoin(
          countriesTable,
          eq(playersTable.countryId, countriesTable.countryId),
        )
        .where(eq(playersTable.currentHtTeamId, htTeamId))
        .orderBy(asc(playersTable.lastName), asc(playersTable.firstName))
        .all();

      return rows.map((r) => ({
        ...r,
        countryCode: r.countryCode ?? null,
        countryName: r.countryName ?? null,
      }));
    },

    async updatePlayerDetails(htPlayerId, input) {
      await db
        .update(playersTable)
        .set({
          age: input.age,
          ageDays: input.ageDays,
          countryId: input.countryId,
          updatedAt: new Date(),
        })
        .where(eq(playersTable.htPlayerId, htPlayerId));
    },

    async clearCurrentTeam(htPlayerId) {
      await db
        .update(playersTable)
        .set({ currentHtTeamId: null, updatedAt: new Date() })
        .where(eq(playersTable.htPlayerId, htPlayerId));
    },

    async updateAvatarUrl(htPlayerId, url) {
      await db
        .update(playersTable)
        .set({ avatarUrl: url, updatedAt: new Date() })
        .where(eq(playersTable.htPlayerId, htPlayerId));
    },

    async findByHtIdWithCountry(htPlayerId) {
      const row = await db
        .select({
          id: playersTable.id,
          htPlayerId: playersTable.htPlayerId,
          firstName: playersTable.firstName,
          lastName: playersTable.lastName,
          currentHtTeamId: playersTable.currentHtTeamId,
          age: playersTable.age,
          ageDays: playersTable.ageDays,
          countryId: playersTable.countryId,
          createdAt: playersTable.createdAt,
          updatedAt: playersTable.updatedAt,
          avatarUrl: playersTable.avatarUrl,
          countryCode: countriesTable.countryCode,
          countryName: countriesTable.name,
        })
        .from(playersTable)
        .leftJoin(countriesTable, eq(playersTable.countryId, countriesTable.countryId))
        .where(eq(playersTable.htPlayerId, htPlayerId))
        .get();

      if (!row) return null;
      return { ...row, avatarUrl: row.avatarUrl ?? null, countryCode: row.countryCode ?? null, countryName: row.countryName ?? null };
    },

    async getTeamHistory(htPlayerId) {
      const rows = await db
        .select({
          htTeamId: playerTeamHistoryTable.htTeamId,
          teamName: sql<string>`COALESCE(${teamsTable.name}, 'Team ' || ${playerTeamHistoryTable.htTeamId})`,
          logoUrl: teamsTable.logoUrl,
          firstSeenAt: playerTeamHistoryTable.firstSeenAt,
          lastSeenAt: playerTeamHistoryTable.lastSeenAt,
        })
        .from(playerTeamHistoryTable)
        .leftJoin(teamsTable, eq(playerTeamHistoryTable.htTeamId, teamsTable.htTeamId))
        .where(eq(playerTeamHistoryTable.htPlayerId, htPlayerId))
        .orderBy(desc(playerTeamHistoryTable.firstSeenAt))
        .all();

      return rows.map((r) => ({
        htTeamId: r.htTeamId,
        teamName: r.teamName,
        logoUrl: r.logoUrl ?? null,
        firstSeenAt: r.firstSeenAt,
        lastSeenAt: r.lastSeenAt,
      }));
    },

    async getMatchStats(htPlayerId) {
      // For each match where the player appeared, aggregate goals, assists, cards, minutes.
      // Uses raw SQL aliases for home_team / away_team / opponent_team to resolve names.
      const rows = await db
        .select({
          tournamentId: matchAppearancesTable.tournamentId,
          tournamentName: sql<string>`COALESCE(${tournamentsTable.name}, '')`,
          matchId: matchAppearancesTable.matchId,
          htMatchId: tournamentMatchesTable.htMatchId,
          round: tournamentMatchesTable.round,
          matchDate: tournamentMatchesTable.matchDate,
          htTeamId: matchAppearancesTable.htTeamId,
          teamName: sql<string>`COALESCE(player_team.name, 'Team ' || ${matchAppearancesTable.htTeamId})`,
          homeTeamId: tournamentMatchesTable.homeTeamId,
          awayTeamId: tournamentMatchesTable.awayTeamId,
          opponentTeamName: sql<string>`COALESCE(opponent_team.name,
            'Team ' || CASE
              WHEN ${tournamentMatchesTable.homeTeamId} = ${matchAppearancesTable.htTeamId}
              THEN ${tournamentMatchesTable.awayTeamId}
              ELSE ${tournamentMatchesTable.homeTeamId}
            END)`,
          roleId: matchAppearancesTable.roleId,
          minuteIn: matchAppearancesTable.minuteIn,
          minuteOut: matchAppearancesTable.minuteOut,
          ratingStars: matchAppearancesTable.ratingStars,
          goals: sql<number>`(
            SELECT COUNT(*) FROM match_events me
            WHERE me.match_id = ${matchAppearancesTable.matchId}
              AND me.subject_player_id = ${htPlayerId}
              AND me.event_type_id >= 100 AND me.event_type_id <= 199
          )`,
          assists: sql<number>`(
            SELECT COUNT(*) FROM match_events me
            WHERE me.match_id = ${matchAppearancesTable.matchId}
              AND me.object_player_id = ${htPlayerId}
              AND me.event_type_id >= 100 AND me.event_type_id <= 199
          )`,
          yellowCards: sql<number>`(
            SELECT COUNT(*) FROM match_bookings mb
            WHERE mb.match_id = ${matchAppearancesTable.matchId}
              AND mb.ht_player_id = ${htPlayerId}
              AND mb.booking_type = 1
          )`,
          redCards: sql<number>`(
            SELECT COUNT(*) FROM match_bookings mb
            WHERE mb.match_id = ${matchAppearancesTable.matchId}
              AND mb.ht_player_id = ${htPlayerId}
              AND mb.booking_type = 2
          )`,
        })
        .from(matchAppearancesTable)
        .leftJoin(tournamentMatchesTable, eq(matchAppearancesTable.matchId, tournamentMatchesTable.id))
        .leftJoin(tournamentsTable, eq(matchAppearancesTable.tournamentId, tournamentsTable.id))
        .leftJoin(
          sql`${teamsTable} AS player_team`,
          sql`player_team.ht_team_id = ${matchAppearancesTable.htTeamId}`,
        )
        .leftJoin(
          sql`${teamsTable} AS opponent_team`,
          sql`opponent_team.ht_team_id = CASE
            WHEN ${tournamentMatchesTable.homeTeamId} = ${matchAppearancesTable.htTeamId}
            THEN ${tournamentMatchesTable.awayTeamId}
            ELSE ${tournamentMatchesTable.homeTeamId}
          END`,
        )
        .where(eq(matchAppearancesTable.htPlayerId, htPlayerId))
        .orderBy(desc(tournamentMatchesTable.matchDate))
        .all();

      return rows.map((r) => {
        const isHome = r.homeTeamId === r.htTeamId;
        const opponentHtTeamId = isHome ? r.awayTeamId : r.homeTeamId;
        const minutesPlayed = (r.minuteOut ?? 90) - r.minuteIn;
        return {
          tournamentId: r.tournamentId,
          tournamentName: r.tournamentName,
          matchId: r.matchId,
          htMatchId: r.htMatchId,
          round: r.round,
          matchDate: r.matchDate,
          htTeamId: r.htTeamId,
          teamName: r.teamName,
          opponentHtTeamId,
          opponentTeamName: r.opponentTeamName,
          isHome,
          roleId: r.roleId,
          minuteIn: r.minuteIn,
          minuteOut: r.minuteOut,
          minutesPlayed,
          goals: r.goals,
          assists: r.assists,
          yellowCards: r.yellowCards,
          redCards: r.redCards,
          ratingStars: r.ratingStars,
        };
      });
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Upsert a player_team_history entry.
 * If a row already exists for (htPlayerId, htTeamId), update lastSeenAt.
 * Otherwise insert a new entry.
 * Team name is resolved via JOIN when reading — not stored here.
 */
async function upsertTeamHistory(
  db: DB,
  htPlayerId: number,
  htTeamId: number,
  now: Date,
): Promise<void> {
  const existing = await db
    .select()
    .from(playerTeamHistoryTable)
    .where(
      and(
        eq(playerTeamHistoryTable.htPlayerId, htPlayerId),
        eq(playerTeamHistoryTable.htTeamId, htTeamId),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(playerTeamHistoryTable)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(playerTeamHistoryTable.htPlayerId, htPlayerId),
          eq(playerTeamHistoryTable.htTeamId, htTeamId),
        ),
      );
  } else {
    await db.insert(playerTeamHistoryTable).values({
      id: randomUUID(),
      htPlayerId,
      htTeamId,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }
}
