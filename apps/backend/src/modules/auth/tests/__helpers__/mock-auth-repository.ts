import { User } from '../../domain/user';
import type { AuthRepository } from '../../infrastructure/auth.repository';

/**
 * Creates an in-memory AuthRepository for unit tests.
 * Supports lookup by both email and id.
 */
export function createMockAuthRepository(users: User[] = []): AuthRepository {
  const byEmail = new Map<string, User>();
  const byId = new Map<string, User>();

  for (const u of users) {
    byEmail.set(u.email, u);
    byId.set(u.id, u);
  }

  return {
    async findByEmail(email) {
      return byEmail.get(email) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async create(user) {
      byEmail.set(user.email, user);
      byId.set(user.id, user);
    },
    async updatePasswordHash(_id, _hash) {
      // no-op stub for unit tests
    },
    async findAll() {
      return Array.from(byId.values());
    },
    async update(id, fields) {
      const user = byId.get(id);
      if (!user) return;
      // Reconstruct user with updated fields via fromPersistence
      const updated = User.fromPersistence({
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        role: 'role' in fields ? (fields.role ?? null) : user.role,
        htTeamId: 'htTeamId' in fields ? (fields.htTeamId ?? null) : user.htTeamId,
        createdAt: user.createdAt,
      });
      byEmail.set(updated.email, updated);
      byId.set(updated.id, updated);
    },
  };
}
