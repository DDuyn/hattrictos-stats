import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, notFoundError } from '@hattrictos-stats/shared';
import type { TournamentRepository, TopScorerRow } from '../infrastructure/tournaments.repository';
import type { TournamentRow, TournamentStandingRow, TournamentMatchRow } from '../infrastructure/tournaments.table';

export interface TournamentDetail {
  tournament: TournamentRow;
  standings: TournamentStandingRow[];
  matches: TournamentMatchRow[];
  topScorers: TopScorerRow[];
}

export type GetTournament = (id: string) => Promise<Result<TournamentDetail, AppError>>;

/**
 * Returns a tournament with its current standings, full match calendar, and top scorers.
 * Public — no auth required.
 */
export function createGetTournament(
  tournamentRepository: TournamentRepository,
): GetTournament {
  return async (id: string) => {
    const tournament = await tournamentRepository.findById(id);
    if (!tournament) {
      return err(notFoundError(`Tournament ${id} not found.`));
    }

    const [standings, matches, topScorers] = await Promise.all([
      tournamentRepository.getStandings(id),
      tournamentRepository.getMatches(id),
      tournamentRepository.getTopScorers(id, 10),
    ]);

    return ok({ tournament, standings, matches, topScorers });
  };
}
