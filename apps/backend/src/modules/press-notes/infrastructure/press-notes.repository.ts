import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../../infrastructure/db/client';
import { pressNotesTable, type PressNoteRow } from './press-notes.table';
import { teamsTable } from '../../teams/infrastructure/teams.table';

export interface CreatePressNoteInput {
  htTeamId: number;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
}

export interface LatestPressNote {
  id: string;
  htTeamId: number;
  teamName: string | null;
  teamLogo: string | null;
  authorName: string;
  title: string;
  createdAt: Date;
}

export interface PressNotesRepository {
  listByTeam(htTeamId: number): Promise<PressNoteRow[]>;
  listLatest(limit: number): Promise<LatestPressNote[]>;
  create(input: CreatePressNoteInput): Promise<PressNoteRow>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<PressNoteRow | null>;
}

export function createPressNotesRepository(db: DB): PressNotesRepository {
  return {
    async listByTeam(htTeamId) {
      return db
        .select()
        .from(pressNotesTable)
        .where(eq(pressNotesTable.htTeamId, htTeamId))
        .orderBy(desc(pressNotesTable.createdAt))
        .all();
    },

    async listLatest(limit) {
      const rows = await db
        .select({
          id: pressNotesTable.id,
          htTeamId: pressNotesTable.htTeamId,
          teamName: teamsTable.name,
          teamLogo: teamsTable.logoUrl,
          authorName: pressNotesTable.authorName,
          title: pressNotesTable.title,
          createdAt: pressNotesTable.createdAt,
        })
        .from(pressNotesTable)
        .leftJoin(teamsTable, eq(pressNotesTable.htTeamId, teamsTable.htTeamId))
        .orderBy(desc(pressNotesTable.createdAt))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        htTeamId: r.htTeamId,
        teamName: r.teamName ?? null,
        teamLogo: r.teamLogo ?? null,
        authorName: r.authorName,
        title: r.title,
        createdAt: r.createdAt,
      }));
    },

    async create(input) {
      const now = new Date();
      const id = randomUUID();
      await db.insert(pressNotesTable).values({
        id,
        htTeamId: input.htTeamId,
        authorId: input.authorId,
        authorName: input.authorName,
        title: input.title,
        content: input.content,
        createdAt: now,
      });
      return (await db
        .select()
        .from(pressNotesTable)
        .where(eq(pressNotesTable.id, id))
        .get()) as PressNoteRow;
    },

    async delete(id) {
      await db.delete(pressNotesTable).where(eq(pressNotesTable.id, id));
    },

    async findById(id) {
      return (
        (await db.select().from(pressNotesTable).where(eq(pressNotesTable.id, id)).get()) ?? null
      );
    },
  };
}
