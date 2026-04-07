import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, notFoundError } from '@hattrictos-stats/shared';
import type {
  TournamentRepository,
  TopScorerRow,
  TopMinutesRow,
  StandingWithTeam,
  MatchWithTeams,
} from '../infrastructure/tournaments.repository';
import type { TournamentRow } from '../infrastructure/tournaments.table';

export interface TournamentDetail {
  tournament: TournamentRow;
  standings: StandingWithTeam[];
  matches: MatchWithTeams[];
  topScorers: TopScorerRow[];
  topMinutes: TopMinutesRow[];
}

export type GetTournament = (id: string) => Promise<Result<TournamentDetail, AppError>>;

/**
 * Returns a tournament with its current standings, full match calendar, and top scorers.
 * Team and player names are resolved via JOIN — no denormalized name columns.
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

    const [standings, matches, topScorers, topMinutes] = await Promise.all([
      tournamentRepository.getStandings(id),
      tournamentRepository.getMatches(id),
      tournamentRepository.getTopScorers(id, 10),
      tournamentRepository.getTopMinutes(id, 25),
    ]);

    return ok({ tournament, standings, matches, topScorers, topMinutes });
  };
}
