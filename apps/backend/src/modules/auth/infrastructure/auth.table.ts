import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export type UserRole = 'owner' | 'co_owner' | 'admin';

export const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<UserRole>(),
  /** Hattrick team ID for which this user can write press notes (null = no team) */
  htTeamId: integer('ht_team_id'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
