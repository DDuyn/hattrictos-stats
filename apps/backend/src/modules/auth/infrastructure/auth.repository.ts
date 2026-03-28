import { eq } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import { usersTable } from './auth.table';
import { User } from '../domain/user';

export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<void>;
}

export function createAuthRepository(db: DB): AuthRepository {
  return {
    async findByEmail(email: string) {
      const row = await db.select().from(usersTable).where(eq(usersTable.email, email)).get();
      if (!row) return null;
      return User.fromPersistence(row);
    },

    async findById(id: string) {
      const row = await db.select().from(usersTable).where(eq(usersTable.id, id)).get();
      if (!row) return null;
      return User.fromPersistence(row);
    },

    async create(user: User) {
      await db.insert(usersTable).values({
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt,
      });
    },
  };
}
