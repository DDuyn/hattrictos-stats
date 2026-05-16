import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { usersTable } from '../../auth/infrastructure/auth.table';

export const pressNotesTable = sqliteTable(
  'press_notes',
  {
    id: text('id').primaryKey(),
    htTeamId: integer('ht_team_id').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('press_notes_ht_team_id_idx').on(t.htTeamId)],
);

export type PressNoteRow = typeof pressNotesTable.$inferSelect;
export type NewPressNoteRow = typeof pressNotesTable.$inferInsert;
