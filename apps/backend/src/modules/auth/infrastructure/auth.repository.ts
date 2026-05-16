import { eq, asc } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import { usersTable } from './auth.table';
import { User } from '../domain/user';
import type { UserRole } from '@hattrictos-stats/shared';

export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(user: User): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  update(id: string, fields: { role?: UserRole | null; htTeamId?: number | null }): Promise<void>;
}

function rowToUser(row: typeof usersTable.$inferSelect): User {
  return User.fromPersistence({
    ...row,
    role: row.role ?? null,
    htTeamId: row.htTeamId ?? null,
  });
}

export function createAuthRepository(db: DB): AuthRepository {
  return {
    async findByEmail(email: string) {
      const row = await db.select().from(usersTable).where(eq(usersTable.email, email)).get();
      if (!row) return null;
      return rowToUser(row);
    },

    async findById(id: string) {
      const row = await db.select().from(usersTable).where(eq(usersTable.id, id)).get();
      if (!row) return null;
      return rowToUser(row);
    },

    async create(user: User) {
      await db.insert(usersTable).values({
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        role: user.role ?? undefined,
        htTeamId: user.htTeamId ?? undefined,
        createdAt: user.createdAt,
      });
    },

    async updatePasswordHash(id: string, passwordHash: string) {
      await db
        .update(usersTable)
        .set({ passwordHash })
        .where(eq(usersTable.id, id));
    },

    async findAll() {
      const rows = await db
        .select()
        .from(usersTable)
        .orderBy(asc(usersTable.createdAt))
        .all();
      return rows.map(rowToUser);
    },

    async update(id, fields) {
      const set: Partial<typeof usersTable.$inferInsert> = {};
      if ('role' in fields) set.role = fields.role ?? undefined;
      if ('htTeamId' in fields) set.htTeamId = fields.htTeamId ?? undefined;
      if (Object.keys(set).length === 0) return;
      await db.update(usersTable).set(set).where(eq(usersTable.id, id));
    },
  };
}
