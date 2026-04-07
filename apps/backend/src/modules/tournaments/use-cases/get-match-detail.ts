import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, notFoundError } from '@hattrictos-stats/shared';
import type {
  TournamentRepository,
  MatchWithTeams,
  MatchEventWithPlayers,
  MatchAppearanceWithNames,
} from '../infrastructure/tournaments.repository';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchDetail {
  match: MatchWithTeams;
  events: MatchEventWithPlayers[];
  /** Home team appearances, sorted by minuteIn then roleId */
  homeAppearances: MatchAppearanceWithNames[];
  /** Away team appearances, sorted by minuteIn then roleId */
  awayAppearances: MatchAppearanceWithNames[];
}

export type GetMatchDetail = (
  tournamentId: string,
  matchId: string,
) => Promise<Result<MatchDetail, AppError>>;

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns full match detail: result, events (goals), and both lineups.
 * Public — no auth required.
 */
export function createGetMatchDetail(
  tournamentRepository: TournamentRepository,
): GetMatchDetail {
  return async (tournamentId: string, matchId: string) => {
    const match = await tournamentRepository.getMatchById(matchId);
    if (!match || match.tournamentId !== tournamentId) {
      return err(notFoundError(`Match ${matchId} not found in tournament ${tournamentId}.`));
    }

    const [events, appearances] = await Promise.all([
      tournamentRepository.getMatchEvents(matchId),
      tournamentRepository.getMatchAppearances(matchId),
    ]);

    const homeAppearances = appearances.filter((a) => a.htTeamId === match.homeTeamId);
    const awayAppearances = appearances.filter((a) => a.htTeamId === match.awayTeamId);

    return ok({ match, events, homeAppearances, awayAppearances });
  };
}
