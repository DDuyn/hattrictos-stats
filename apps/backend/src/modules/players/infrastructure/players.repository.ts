import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../../infrastructure/db/client';
import {
  playersTable,
  playerTeamHistoryTable,
  type PlayerRow,
} from './players.table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpsertPlayerInput {
  htPlayerId: number;
  firstName: string;
  lastName: string;
  htTeamId: number;
}

export interface PlayersRepository {
  /**
   * Insert or update a player. If the team has changed, records it in
   * player_team_history. Returns the updated player row.
   */
  upsertPlayer(input: UpsertPlayerInput): Promise<PlayerRow>;

  /** Find a player by Hattrick player ID. */
  findByHtId(htPlayerId: number): Promise<PlayerRow | null>;
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
          currentHtTeamId: input.htTeamId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: playersTable.htPlayerId,
          set: {
            firstName: input.firstName,
            lastName: input.lastName,
            currentHtTeamId: input.htTeamId,
            updatedAt: now,
          },
        });

      await upsertTeamHistory(db, input.htPlayerId, input.htTeamId, now);

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
