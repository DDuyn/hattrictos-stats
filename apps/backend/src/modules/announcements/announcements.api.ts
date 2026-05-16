import { Hono } from 'hono';
import { z } from 'zod';
import { type JwtPayload } from '@hattrictos-stats/shared';
import { db } from '../../infrastructure/db/client';
import { ownerOrCoOwnerGuard, jwtGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import type { LoggerEnv } from '../../middleware/logger';
import { createAnnouncementsRepository } from './infrastructure/announcements.repository';
import { notFoundError, unauthorizedError } from '@hattrictos-stats/shared';

type Env = { Variables: { jwtPayload: JwtPayload } } & LoggerEnv;

const app = new Hono<Env>();
const repo = createAnnouncementsRepository(db);

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  pinned: z.boolean().optional().default(false),
});

/**
 * GET /api/announcements
 * Public — returns all announcements, pinned first then newest.
 */
app.get('/', async (c) => {
  const rows = await repo.list();
  return c.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      authorId: r.authorId,
      pinned: r.pinned === 1,
      createdAt: r.createdAt,
    })),
  );
});

/**
 * POST /api/announcements
 * Requires owner or co_owner.
 */
app.post('/', ownerOrCoOwnerGuard, async (c) => {
  const body = await c.req.json();
  const parsed = createAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const { userId } = c.get('jwtPayload');
  const row = await repo.create({
    title: parsed.data.title,
    content: parsed.data.content,
    authorId: userId,
    pinned: parsed.data.pinned,
  });

  return c.json(
    {
      id: row.id,
      title: row.title,
      content: row.content,
      authorId: row.authorId,
      pinned: row.pinned === 1,
      createdAt: row.createdAt,
    },
    201,
  );
});

/**
 * DELETE /api/announcements/:id
 * Requires owner or co_owner.
 */
app.delete('/:id', ownerOrCoOwnerGuard, async (c) => {
  const { id } = c.req.param();
  const existing = await repo.findById(id);
  if (!existing) {
    const e = notFoundError('Announcement not found');
    return c.json(e, errorToStatus(e.code));
  }
  await repo.delete(id);
  return c.body(null, 204);
});

export { app as announcementsApi };
