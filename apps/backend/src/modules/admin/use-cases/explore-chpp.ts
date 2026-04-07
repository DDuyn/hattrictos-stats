import {
  type Result,
  type AppError,
  ok,
  err,
  notFoundError,
} from '@hattrictos-stats/shared';
import type { ChppTokenRepository } from '../infrastructure/chpp-token.repository';
import { createChppClient } from '../../../infrastructure/chpp/chpp-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FetchMatchDetails = (
  matchId: number,
) => Promise<Result<Record<string, unknown>, AppError>>;

export type FetchTournamentDetails = (
  tournamentId: number,
) => Promise<Result<Record<string, unknown>, AppError>>;

export type FetchTournamentFixtures = (
  tournamentId: number,
) => Promise<Result<Record<string, unknown>, AppError>>;

export type FetchTournamentLeagueTable = (
  tournamentId: number,
) => Promise<Result<Record<string, unknown>, AppError>>;

export type FetchRaw = (
  file: string,
  params: Record<string, string | number | boolean>,
) => Promise<Result<Record<string, unknown>, AppError>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getActiveClient(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
) {
  const activeToken = await tokenRepository.getActive();
  if (!activeToken) {
    return err(
      notFoundError(
        'No active CHPP token found. Please connect via /api/admin/chpp/connect.',
      ),
    );
  }
  return ok(
    createChppClient({
      ...chppClientConfig,
      accessToken: activeToken.accessToken,
      accessTokenSecret: activeToken.accessTokenSecret,
    }),
  );
}

// ─── Use cases ───────────────────────────────────────────────────────────────

/**
 * Fetches raw match details from the CHPP API for a given matchId.
 * Includes all goal scorers and match events.
 *
 * This is an exploration endpoint — it returns the raw parsed XML as JSON
 * so we can inspect the actual data structure before building sync logic.
 *
 * Docs: file=matchdetails, matchID=<id>, matchEvents=true
 */
export function createFetchMatchDetails(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
): FetchMatchDetails {
  return async (matchId: number): Promise<Result<Record<string, unknown>, AppError>> => {
    const clientResult = await getActiveClient(chppClientConfig, tokenRepository);
    if (!clientResult.ok) return clientResult;

    return clientResult.value.fetch({
      file: 'matchdetails',
      matchID: matchId,
      matchEvents: true,
    });
  };
}

/**
 * Fetches raw tournament details from the CHPP API for a given tournamentId.
 * Returns the tournament structure including all participating teams.
 *
 * This is an exploration endpoint — it returns the raw parsed XML as JSON
 * so we can inspect the actual data structure before building sync logic.
 *
 * Docs: file=tournamentdetails, tournamentID=<id>
 */
export function createFetchTournamentDetails(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
): FetchTournamentDetails {
  return async (tournamentId: number): Promise<Result<Record<string, unknown>, AppError>> => {
    const clientResult = await getActiveClient(chppClientConfig, tokenRepository);
    if (!clientResult.ok) return clientResult;

    return clientResult.value.fetch({
      file: 'tournamentdetails',
      tournamentID: tournamentId,
    });
  };
}

/**
 * Fetches the full fixture list (calendar + results) for a tournament.
 *
 * Docs: file=tournamentfixtures, tournamentID=<id>
 */
export function createFetchTournamentFixtures(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
): FetchTournamentFixtures {
  return async (tournamentId: number): Promise<Result<Record<string, unknown>, AppError>> => {
    const clientResult = await getActiveClient(chppClientConfig, tokenRepository);
    if (!clientResult.ok) return clientResult;

    return clientResult.value.fetch({
      file: 'tournamentfixtures',
      tournamentID: tournamentId,
    });
  };
}

/**
 * Fetches the league standings table for a tournament from the CHPP API.
 *
 * Available for the current season and up to 2 seasons after the tournament
 * finished (non-restarted tournaments only).
 *
 * Docs: file=tournamentleaguetables, tournamentID=<id>
 */
export function createFetchTournamentLeagueTable(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
): FetchTournamentLeagueTable {
  return async (tournamentId: number): Promise<Result<Record<string, unknown>, AppError>> => {
    const clientResult = await getActiveClient(chppClientConfig, tokenRepository);
    if (!clientResult.ok) return clientResult;

    return clientResult.value.fetch({
      file: 'tournamentleaguetables',
      tournamentID: tournamentId,
    });
  };
}

/**
 * Fetches any CHPP endpoint with arbitrary parameters.
 *
 * Exploration endpoint — lets us probe undocumented or new endpoints
 * without code changes. Pass `file` and any extra key-value params.
 *
 * Example: file=tournamentmatchdetails, matchID=123456789
 */
export function createFetchRaw(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
): FetchRaw {
  return async (
    file: string,
    params: Record<string, string | number | boolean>,
  ): Promise<Result<Record<string, unknown>, AppError>> => {
    const clientResult = await getActiveClient(chppClientConfig, tokenRepository);
    if (!clientResult.ok) return clientResult;

    return clientResult.value.fetch({ file, ...params });
  };
}
