import { Hono } from 'hono';
import { unlink } from 'node:fs/promises';
import { db } from '../../infrastructure/db/client';
import { errorToStatus } from '../../middleware/error-handler';
import type { LoggerEnv } from '../../middleware/logger';
import { staffGuard } from '../../middleware/jwt';
import { createTeamsRepository } from './infrastructure/teams.repository';
import { createPlayersRepository } from '../players/infrastructure/players.repository';
import { createTournamentRepository } from '../tournaments/infrastructure/tournaments.repository';
import { createListTeams } from './use-cases/list-teams';
import { createGetTeamDetail } from './use-cases/get-team-detail';

type Env = LoggerEnv;

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const MAX_FILE_SIZE = 500 * 1024; // 500 KB

const teamsApi = new Hono<Env>();

/**
 * GET /api/teams
 *
 * Lists all teams in the system, each with the tournaments they participate in.
 * Public — no auth required.
 */
teamsApi.get('/', async (c) => {
  const teamsRepository = createTeamsRepository(db);
  const listTeams = createListTeams(teamsRepository);

  const result = await listTeams();
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }

  return c.json(result.value);
});

/**
 * POST /api/teams/:htTeamId/logo
 *
 * Sube un logo para un equipo. Acepta PNG, JPG o SVG (máx. 500 KB).
 * Requiere rol staff (owner, co_owner o admin).
 */
teamsApi.post('/:htTeamId/logo', staffGuard, async (c) => {
  const htTeamId = Number(c.req.param('htTeamId'));
  if (!Number.isInteger(htTeamId) || htTeamId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'htTeamId must be a positive integer' }, 400);
  }

  const teamsRepository = createTeamsRepository(db);
  const team = await teamsRepository.findByHtId(htTeamId);
  if (!team) {
    return c.json({ code: 'NOT_FOUND', message: `Team ${htTeamId} not found` }, 404);
  }

  const body = await c.req.parseBody();
  const file = body['logo'];

  if (!file || !(file instanceof File)) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Missing or invalid "logo" field' }, 400);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Only PNG, JPG and SVG images are allowed' },
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'File exceeds maximum size of 500 KB' }, 400);
  }

  // Determinar extensión a partir del MIME type
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
  };
  const ext = extMap[file.type];
  const filename = `${htTeamId}.${ext}`;
  const filepath = `./public/logos/${filename}`;

  // Guardar en disco
  await Bun.write(filepath, file);

  const logoUrl = `/logos/${filename}`;
  await teamsRepository.updateLogoUrl(htTeamId, logoUrl);

  return c.json({ logoUrl });
});

/**
 * DELETE /api/teams/:htTeamId/logo
 *
 * Elimina el logo de un equipo del disco y borra la referencia en BD.
 * Requiere rol staff (owner, co_owner o admin).
 */
teamsApi.delete('/:htTeamId/logo', staffGuard, async (c) => {
  const htTeamId = Number(c.req.param('htTeamId'));
  if (!Number.isInteger(htTeamId) || htTeamId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'htTeamId must be a positive integer' }, 400);
  }

  const teamsRepository = createTeamsRepository(db);
  const team = await teamsRepository.findByHtId(htTeamId);
  if (!team) {
    return c.json({ code: 'NOT_FOUND', message: `Team ${htTeamId} not found` }, 404);
  }

  // Intentar borrar el archivo si existe
  if (team.logoUrl) {
    const filepath = `./public${team.logoUrl}`;
    try {
      await unlink(filepath);
    } catch {
      // Si no existe el archivo, ignorar el error
    }
  }

  await teamsRepository.updateLogoUrl(htTeamId, null);

  return c.body(null, 204);
});

/**
 * GET /api/teams/:htTeamId
 *
 * Returns full detail for a team: info, tournament standings, current roster, and recent matches.
 * Public — no auth required.
 */
teamsApi.get('/:htTeamId', async (c) => {
  const raw = c.req.param('htTeamId');
  const htTeamId = Number(raw);
  if (!Number.isInteger(htTeamId) || htTeamId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'htTeamId must be a positive integer' }, 400);
  }

  const teamsRepository = createTeamsRepository(db);
  const playersRepository = createPlayersRepository(db);
  const tournamentRepository = createTournamentRepository(db);
  const getTeamDetail = createGetTeamDetail(teamsRepository, playersRepository, tournamentRepository);

  const result = await getTeamDetail(htTeamId);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }

  return c.json(result.value);
});

export { teamsApi };
