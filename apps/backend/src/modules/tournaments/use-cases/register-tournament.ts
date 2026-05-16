import { randomUUID } from 'crypto';
import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, conflictError, notFoundError } from '@hattrictos-stats/shared';
import type { TournamentRepository } from '../infrastructure/tournaments.repository';
import type { ChppTokenRepository } from '../../admin/infrastructure/chpp-token.repository';
import type { TeamsRepository } from '../../teams/infrastructure/teams.repository';
import type { PlayersRepository } from '../../players/infrastructure/players.repository';
import type { CountriesRepository } from '../../players/infrastructure/countries.repository';
import { createChppClient } from '../../../infrastructure/chpp/chpp-client';
import { createSyncTournament } from './sync-tournament';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterTournamentInput {
  htTournamentId: number;
}

export interface RegisterTournamentOutput {
  id: string;
  htTournamentId: number;
  name: string;
}

export type RegisterTournament = (
  input: RegisterTournamentInput,
) => Promise<Result<RegisterTournamentOutput, AppError>>;

// ─── Use case ─────────────────────────────────────────────────────────────────

/**
 * Registers a Hattrick Arena tournament in our app.
 *
 * Steps:
 *  1. Check for duplicate (idempotent — rejects if already registered)
 *  2. Fetch tournamentdetails from CHPP to get the name
 *  3. Create the tournament row in BD
 *  4. Trigger an initial sync (standings + fixtures)
 */
export function createRegisterTournament(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
  tournamentRepository: TournamentRepository,
  teamsRepository: TeamsRepository,
  playersRepository: PlayersRepository,
  countriesRepository: CountriesRepository,
): RegisterTournament {
  return async ({ htTournamentId }) => {
    // 1. Duplicate check
    const exists = await tournamentRepository.existsByHtId(htTournamentId);
    if (exists) {
      return err(conflictError(`Tournament ${htTournamentId} is already registered.`));
    }

    // 2. Fetch tournament name from CHPP
    const activeToken = await tokenRepository.getActive();
    if (!activeToken) {
      return err(notFoundError('No active CHPP token. Please connect via /api/admin/chpp/connect.'));
    }

    const chpp = createChppClient({
      ...chppClientConfig,
      accessToken: activeToken.accessToken,
      accessTokenSecret: activeToken.accessTokenSecret,
    });

    const detailsResult = await chpp.fetch({
      file: 'tournamentdetails',
      tournamentID: htTournamentId,
    });
    if (!detailsResult.ok) return err(detailsResult.error);

    const raw = detailsResult.value as Record<string, unknown>;
    // fast-xml-parser wraps everything in the XML root element — HattrickData
    const htData = (raw['HattrickData'] ?? raw) as Record<string, unknown>;
    const td = (htData['Tournament'] ?? htData['tournament'] ?? htData) as Record<string, unknown>;

    const name =
      String(td['Name'] ?? td['name'] ?? '') || `Tournament ${htTournamentId}`;
    const season = Number(td['Season'] ?? td['season'] ?? 0) || null;
    const tournamentType = Number(td['TournamentType'] ?? td['tournamentType'] ?? 0);
    const numberOfTeams = Number(td['NumberOfTeams'] ?? td['numberOfTeams'] ?? 0) || null;

    // 3. Persist tournament
    const id = randomUUID();
    await tournamentRepository.create({
      id,
      htTournamentId,
      name,
      season: season ?? undefined,
      tournamentType,
      numberOfTeams: numberOfTeams ?? undefined,
    });

    // 4. Initial sync (standings + fixtures) — fire and don't fail the register if sync errors
    const sync = createSyncTournament(chppClientConfig, tokenRepository, tournamentRepository, teamsRepository, playersRepository, countriesRepository);
    await sync(id);

    return ok({ id, htTournamentId, name });
  };
}
