import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { usersTable } from '../../auth/infrastructure/auth.table';

export const announcementsTable = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: text('author_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  pinned: integer('pinned').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type AnnouncementRow = typeof announcementsTable.$inferSelect;
export type NewAnnouncementRow = typeof announcementsTable.$inferInsert;
