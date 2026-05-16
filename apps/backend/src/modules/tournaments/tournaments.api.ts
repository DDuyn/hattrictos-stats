import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../infrastructure/db/client';
import { env } from '../../config/env';
import { staffGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import type { LoggerEnv } from '../../middleware/logger';
import type { JwtPayload } from '@hattrictos-stats/shared';
import { createChppEncryption } from '../../infrastructure/chpp/chpp-encryption';
import { createChppTokenRepository } from '../admin/infrastructure/chpp-token.repository';
import { createTournamentRepository } from './infrastructure/tournaments.repository';
import { createRegisterTournament } from './use-cases/register-tournament';
import { createSyncTournament } from './use-cases/sync-tournament';
import { createListTournaments } from './use-cases/list-tournaments';
import { createGetTournament } from './use-cases/get-tournament';
import { createGetMatchDetail } from './use-cases/get-match-detail';
import { createTeamsRepository } from '../teams/infrastructure/teams.repository';
import { createPlayersRepository } from '../players/infrastructure/players.repository';
import { createCountriesRepository } from '../players/infrastructure/countries.repository';

type Env = { Variables: { jwtPayload: JwtPayload } } & LoggerEnv;

const tournamentsApi = new Hono<Env>();

// ─── Dependency helpers ───────────────────────────────────────────────────────

function getChppConfig() {
  if (!env.CHPP_CONSUMER_KEY || !env.CHPP_CONSUMER_SECRET) {
    throw new Error('CHPP_CONSUMER_KEY and CHPP_CONSUMER_SECRET must be set.');
  }
  return { consumerKey: env.CHPP_CONSUMER_KEY, consumerSecret: env.CHPP_CONSUMER_SECRET };
}

function getEncryption() {
  if (!env.CHPP_ENCRYPTION_KEY) {
    throw new Error('CHPP_ENCRYPTION_KEY must be set.');
  }
  return createChppEncryption(env.CHPP_ENCRYPTION_KEY);
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const registerInputSchema = z.object({
  htTournamentId: z.number({ required_error: 'htTournamentId is required' }).int().positive(),
});

// ─── Admin routes (require staff JWT) ────────────────────────────────────────

/**
 * POST /api/admin/tournaments
 *
 * Registers a new Hattrick Arena tournament by its CHPP tournament ID.
 * Fetches name from CHPP and performs an initial sync (standings + fixtures).
 * Requires owner, co_owner, or admin JWT.
 */
tournamentsApi.post('/', staffGuard, async (c) => {
  const log = c.var.log;

  const body = await c.req.json();
  const parsed = registerInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const tournamentRepository = createTournamentRepository(db);
  const teamsRepository = createTeamsRepository(db);
  const playersRepository = createPlayersRepository(db);
  const registerTournament = createRegisterTournament(chppConfig, tokenRepository, tournamentRepository, teamsRepository, playersRepository, createCountriesRepository(db));

  const result = await registerTournament({ htTournamentId: parsed.data.htTournamentId });
  if (!result.ok) {
    log?.warn('tournament_register_failed', { error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('tournament_registered', { id: result.value.id, name: result.value.name });
  return c.json(result.value, 201);
});

/**
 * POST /api/admin/tournaments/:id/sync
 *
 * Forces a data refresh for the given tournament from CHPP.
 * Updates standings and match results.
 * Requires owner, co_owner, or admin JWT.
 */
tournamentsApi.post('/:id/sync', staffGuard, async (c) => {
  const log = c.var.log;
  const id = c.req.param('id');

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const tournamentRepository = createTournamentRepository(db);

  // Verify tournament exists before firing sync
  const tournament = await tournamentRepository.findById(id);
  if (!tournament) {
    return c.json({ code: 'NOT_FOUND', message: `Tournament ${id} not found.` }, 404);
  }

  const teamsRepository = createTeamsRepository(db);
  const playersRepository = createPlayersRepository(db);
  const countriesRepository = createCountriesRepository(db);
  const syncTournament = createSyncTournament(chppConfig, tokenRepository, tournamentRepository, teamsRepository, playersRepository, countriesRepository);

  // Fire-and-forget: respond immediately, sync runs in background
  syncTournament(id).then((result) => {
    if (!result.ok) {
      log?.warn('tournament_sync_failed', { id, error: result.error });
    } else {
      log?.info('tournament_synced', { id, matchesSynced: result.value.matchesSynced });
    }
  }).catch((err) => {
    log?.error('tournament_sync_error', { id, error: String(err) });
  });

  return c.json({ synced: true, background: true }, 202);
});

/**
 * PATCH /api/admin/tournaments/:id/config
 *
 * Updates promotion/relegation slot configuration for a tournament.
 * Requires owner, co_owner, or admin JWT.
 */
const configInputSchema = z.object({
  promotionSlots: z.number().int().min(0).optional(),
  relegationSlots: z.number().int().min(0).optional(),
});

tournamentsApi.patch('/:id/config', staffGuard, async (c) => {
  const log = c.var.log;
  const id = c.req.param('id');

  const body = await c.req.json();
  const parsed = configInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const tournamentRepository = createTournamentRepository(db);
  const tournament = await tournamentRepository.findById(id);
  if (!tournament) {
    return c.json({ code: 'NOT_FOUND', message: `Tournament ${id} not found.` }, 404);
  }

  await tournamentRepository.updateConfig(id, parsed.data);

  log?.info('tournament_config_updated', { id, config: parsed.data });
  return c.json({ updated: true });
});

// ─── Public routes (no auth required) ────────────────────────────────────────

/**
 * GET /api/tournaments
 *
 * Lists all registered tournaments. Public — no auth required.
 */
tournamentsApi.get('/', async (c) => {
  const tournamentRepository = createTournamentRepository(db);
  const listTournaments = createListTournaments(tournamentRepository);

  const result = await listTournaments();
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }

  return c.json(result.value);
});

/**
 * GET /api/tournaments/:id/matches/:matchId
 *
 * Returns full match detail: result, goal events, and both lineups.
 * Only returns useful data for matches with detailsSynced=1.
 * Public — no auth required.
 */
tournamentsApi.get('/:id/matches/:matchId', async (c) => {
  const tournamentId = c.req.param('id');
  const matchId = c.req.param('matchId');
  const tournamentRepository = createTournamentRepository(db);
  const getMatchDetail = createGetMatchDetail(tournamentRepository);

  const result = await getMatchDetail(tournamentId, matchId);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }

  return c.json(result.value);
});

/**
 * GET /api/tournaments/:id
 *
 * Returns a tournament with its current standings and full match calendar.
 * Public — no auth required.
 */
tournamentsApi.get('/:id', async (c) => {
  const id = c.req.param('id');
  const tournamentRepository = createTournamentRepository(db);
  const getTournament = createGetTournament(tournamentRepository);

  const result = await getTournament(id);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }

  return c.json(result.value);
});

export { tournamentsApi };
