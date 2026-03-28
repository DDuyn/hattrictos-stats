import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { usersTable } from '../../auth/infrastructure/auth.table';

export const itemsTable = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('inactive'),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
