import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok } from '@hattrictos-stats/shared';
import type { TournamentRepository } from '../infrastructure/tournaments.repository';
import type { TournamentRow } from '../infrastructure/tournaments.table';

export type ListTournaments = () => Promise<Result<TournamentRow[], AppError>>;

/**
 * Returns all registered tournaments ordered by creation date.
 * Public — no auth required.
 */
export function createListTournaments(
  tournamentRepository: TournamentRepository,
): ListTournaments {
  return async () => {
    const tournaments = await tournamentRepository.listAll();
    return ok(tournaments);
  };
}
