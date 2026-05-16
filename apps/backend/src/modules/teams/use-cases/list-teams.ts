import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok } from '@hattrictos-stats/shared';
import type { TeamsRepository, TeamWithTournaments } from '../infrastructure/teams.repository';

export type ListTeams = () => Promise<Result<TeamWithTournaments[], AppError>>;

/**
 * Returns all teams in the system, each with the list of tournaments they participate in.
 * Ordered by team name. Public — no auth required.
 */
export function createListTeams(teamsRepository: TeamsRepository): ListTeams {
  return async () => {
    const teams = await teamsRepository.listAllWithTournaments();
    return ok(teams);
  };
}
