import { Hono } from 'hono';
import { unlink } from 'node:fs/promises';
import { db } from '../../infrastructure/db/client';
import { errorToStatus } from '../../middleware/error-handler';
import type { LoggerEnv } from '../../middleware/logger';
import { staffGuard } from '../../middleware/jwt';
import { createPlayersRepository } from './infrastructure/players.repository';
import { createGetPlayerDetail } from './use-cases/get-player-detail';

type Env = LoggerEnv;

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const MAX_FILE_SIZE = 500 * 1024; // 500 KB

const playersApi = new Hono<Env>();

/**
 * POST /api/players/:htPlayerId/avatar
 *
 * Sube un avatar para un jugador. Acepta PNG, JPG o SVG (máx. 500 KB).
 * Requiere rol staff (owner, co_owner o admin).
 */
playersApi.post('/:htPlayerId/avatar', staffGuard, async (c) => {
  const htPlayerId = Number(c.req.param('htPlayerId'));
  if (!Number.isInteger(htPlayerId) || htPlayerId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'htPlayerId must be a positive integer' }, 400);
  }

  const playersRepository = createPlayersRepository(db);
  const player = await playersRepository.findByHtId(htPlayerId);
  if (!player) {
    return c.json({ code: 'NOT_FOUND', message: `Player ${htPlayerId} not found` }, 404);
  }

  const body = await c.req.parseBody();
  const file = body['avatar'];

  if (!file || !(file instanceof File)) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Missing or invalid "avatar" field' }, 400);
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Only PNG, JPG and SVG images are allowed' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'File exceeds maximum size of 500 KB' }, 400);
  }

  const extMap: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };
  const ext = extMap[file.type];
  const filename = `${htPlayerId}.${ext}`;
  const filepath = `./public/avatars/${filename}`;

  await Bun.write(filepath, file);

  const avatarUrl = `/avatars/${filename}`;
  await playersRepository.updateAvatarUrl(htPlayerId, avatarUrl);

  return c.json({ avatarUrl });
});

/**
 * DELETE /api/players/:htPlayerId/avatar
 *
 * Elimina el avatar de un jugador del disco y borra la referencia en BD.
 * Requiere rol staff (owner, co_owner o admin).
 */
playersApi.delete('/:htPlayerId/avatar', staffGuard, async (c) => {
  const htPlayerId = Number(c.req.param('htPlayerId'));
  if (!Number.isInteger(htPlayerId) || htPlayerId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'htPlayerId must be a positive integer' }, 400);
  }

  const playersRepository = createPlayersRepository(db);
  const player = await playersRepository.findByHtIdWithCountry(htPlayerId);
  if (!player) {
    return c.json({ code: 'NOT_FOUND', message: `Player ${htPlayerId} not found` }, 404);
  }

  if (player.avatarUrl) {
    const filepath = `./public${player.avatarUrl}`;
    try { await unlink(filepath); } catch { /* archivo ya borrado, ignorar */ }
  }

  await playersRepository.updateAvatarUrl(htPlayerId, null);
  return c.body(null, 204);
});

/**
 * GET /api/players/:htPlayerId
 *
 * Returns full detail for a player: info, team history, per-match stats and career totals.
 * Public — no auth required.
 */
playersApi.get('/:htPlayerId', async (c) => {
  const raw = c.req.param('htPlayerId');
  const htPlayerId = Number(raw);
  if (!Number.isInteger(htPlayerId) || htPlayerId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'htPlayerId must be a positive integer' }, 400);
  }

  const playersRepository = createPlayersRepository(db);
  const getPlayerDetail = createGetPlayerDetail(playersRepository);

  const result = await getPlayerDetail(htPlayerId);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }

  return c.json(result.value);
});

export { playersApi };
