import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../../infrastructure/db/client';
import { announcementsTable, type AnnouncementRow } from './announcements.table';

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  authorId: string;
  pinned: boolean;
}

export interface AnnouncementsRepository {
  list(): Promise<AnnouncementRow[]>;
  create(input: CreateAnnouncementInput): Promise<AnnouncementRow>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<AnnouncementRow | null>;
}

export function createAnnouncementsRepository(db: DB): AnnouncementsRepository {
  return {
    async list() {
      return db
        .select()
        .from(announcementsTable)
        .orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt))
        .all();
    },

    async create(input) {
      const now = new Date();
      const id = randomUUID();
      await db.insert(announcementsTable).values({
        id,
        title: input.title,
        content: input.content,
        authorId: input.authorId,
        pinned: input.pinned ? 1 : 0,
        createdAt: now,
      });
      return (await db
        .select()
        .from(announcementsTable)
        .where(eq(announcementsTable.id, id))
        .get()) as AnnouncementRow;
    },

    async delete(id) {
      await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    },

    async findById(id) {
      return (
        (await db
          .select()
          .from(announcementsTable)
          .where(eq(announcementsTable.id, id))
          .get()) ?? null
      );
    },
  };
}
