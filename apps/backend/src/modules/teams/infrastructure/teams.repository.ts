import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../../infrastructure/db/client';
import {
  teamsTable,
  tournamentTeamSeasonsTable,
  type TeamRow,
  type TournamentTeamSeasonRow,
} from './teams.table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpsertTeamInput {
  htTeamId: number;
  name: string;
  shortName?: string;
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
  };
}
