import { Hono } from 'hono';
import { z } from 'zod';
import { type JwtPayload } from '@hattrictos-stats/shared';
import { db } from '../../infrastructure/db/client';
import { jwtGuard, ownerOrCoOwnerGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import type { LoggerEnv } from '../../middleware/logger';
import { createPressNotesRepository } from './infrastructure/press-notes.repository';
import { createAuthRepository } from '../auth/infrastructure/auth.repository';
import { notFoundError, unauthorizedError } from '@hattrictos-stats/shared';

type Env = { Variables: { jwtPayload: JwtPayload } } & LoggerEnv;

const app = new Hono<Env>();
const pressNotesRepo = createPressNotesRepository(db);
const authRepo = createAuthRepository(db);

const createPressNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/teams/:htTeamId/press-notes
 * Public — returns all press notes for a team, newest first.
 */
app.get('/', async (c) => {
  const htTeamId = Number(c.req.param('htTeamId'));
  if (isNaN(htTeamId)) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Invalid team ID' }, 400);
  }
  const rows = await pressNotesRepo.listByTeam(htTeamId);
  return c.json(
    rows.map((r) => ({
      id: r.id,
      htTeamId: r.htTeamId,
      authorId: r.authorId,
      authorName: r.authorName,
      title: r.title,
      content: r.content,
      createdAt: r.createdAt,
    })),
  );
});

/**
 * POST /api/teams/:htTeamId/press-notes
 * Requires JWT. User must be owner/co_owner, OR have htTeamId matching the team.
 */
app.post('/', jwtGuard, async (c) => {
  const htTeamId = Number(c.req.param('htTeamId'));
  if (isNaN(htTeamId)) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Invalid team ID' }, 400);
  }

  const { userId, role } = c.get('jwtPayload');
  const isStaff = role === 'owner' || role === 'co_owner';

  if (!isStaff) {
    // Check if the user is the editor of this team
    const user = await authRepo.findById(userId);
    if (!user || user.htTeamId !== htTeamId) {
      const e = unauthorizedError('No tienes permiso para escribir notas de prensa de este equipo');
      return c.json(e, errorToStatus(e.code));
    }
  }

  const body = await c.req.json();
  const parsed = createPressNoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const user = await authRepo.findById(userId);
  const authorName = user?.name ?? 'Redactor';

  const row = await pressNotesRepo.create({
    htTeamId,
    authorId: userId,
    authorName,
    title: parsed.data.title,
    content: parsed.data.content,
  });

  return c.json(
    {
      id: row.id,
      htTeamId: row.htTeamId,
      authorId: row.authorId,
      authorName: row.authorName,
      title: row.title,
      content: row.content,
      createdAt: row.createdAt,
    },
    201,
  );
});

/**
 * DELETE /api/teams/:htTeamId/press-notes/:noteId
 * Author can delete their own note. Owner/co_owner can delete any.
 */
app.delete('/:noteId', jwtGuard, async (c) => {
  const htTeamId = Number(c.req.param('htTeamId'));
  const { noteId } = c.req.param();
  const { userId, role } = c.get('jwtPayload');

  const note = await pressNotesRepo.findById(noteId);
  if (!note || note.htTeamId !== htTeamId) {
    const e = notFoundError('Nota de prensa no encontrada');
    return c.json(e, errorToStatus(e.code));
  }

  const isStaff = role === 'owner' || role === 'co_owner';
  const isAuthor = note.authorId === userId;

  if (!isStaff && !isAuthor) {
    const e = unauthorizedError('No tienes permiso para borrar esta nota');
    return c.json(e, errorToStatus(e.code));
  }

  await pressNotesRepo.delete(noteId);
  return c.body(null, 204);
});

export { app as pressNotesApi };
