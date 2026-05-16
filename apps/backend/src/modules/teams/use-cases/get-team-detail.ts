import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, notFoundError } from '@hattrictos-stats/shared';
import type { TeamsRepository, TeamGlobalStats, PlayerStat } from '../infrastructure/teams.repository';
import type { PlayersRepository, PlayerWithCountry } from '../../players/infrastructure/players.repository';
import type {
  TournamentRepository,
  MatchWithTeams,
} from '../../tournaments/infrastructure/tournaments.repository';
import type { TeamRow } from '../infrastructure/teams.table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamTournamentStat {
  tournamentId: string;
  tournamentName: string;
  season: number | null;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface TeamSeasonStats {
  /** The tournament used as "current season" (highest season number the team participates in) */
  tournamentId: string;
  tournamentName: string;
  season: number | null;
  topScorers: PlayerStat[];
  topMinutes: PlayerStat[];
  topCards: PlayerStat[];
}

export interface TeamDetail {
  team: TeamRow;
  tournaments: TeamTournamentStat[];
  roster: PlayerWithCountry[];
  matches: MatchWithTeams[];
  globalStats: TeamGlobalStats;
  /** Cross-tournament all-time rankings */
  topScorers: PlayerStat[];
  topMinutes: PlayerStat[];
  topCards: PlayerStat[];
  /** Rankings for the current season (tournament with highest season number) */
  currentSeason: TeamSeasonStats | null;
}

export type GetTeamDetail = (htTeamId: number) => Promise<Result<TeamDetail, AppError>>;

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGetTeamDetail(
  teamsRepository: TeamsRepository,
  playersRepository: PlayersRepository,
  tournamentRepository: TournamentRepository,
): GetTeamDetail {
  return async (htTeamId) => {
    const team = await teamsRepository.findByHtId(htTeamId);
    if (!team) {
      return err(notFoundError(`Team with htTeamId ${htTeamId} not found.`));
    }

    // Fetch in parallel: roster, matches, team's tournament memberships, and all-time stats
    const [roster, matches, teamWithTournaments, globalStats, topScorers, topMinutes, topCards] =
      await Promise.all([
        playersRepository.listByCurrentTeamWithCountry(htTeamId),
        tournamentRepository.getRecentMatchesByTeam(htTeamId, 200),
        teamsRepository.listAllWithTournaments().then((all) =>
          all.find((t) => t.htTeamId === htTeamId) ?? null,
        ),
        teamsRepository.getGlobalStats(htTeamId),
        teamsRepository.getTopScorers(htTeamId, 10),
        teamsRepository.getTopMinutes(htTeamId, 10),
        teamsRepository.getTopCards(htTeamId, 10),
      ]);

    // Build tournament stats by fetching standings for each tournament the team participates in
    const tournamentList = teamWithTournaments?.tournaments ?? [];
    const standingsPerTournament = await Promise.all(
      tournamentList.map(async (t) => {
        const standings = await tournamentRepository.getStandings(t.id);
        const row = standings.find((s) => s.htTeamId === htTeamId);
        if (!row) return null;
        return {
          tournamentId: t.id,
          tournamentName: t.name,
          season: t.season,
          position: row.position,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          points: row.points,
        } satisfies TeamTournamentStat;
      }),
    );

    const tournaments = standingsPerTournament.filter((s): s is TeamTournamentStat => s !== null);

    // Determine "current season": tournament with highest season number the team participates in
    const currentTournament = tournamentList.reduce<{ id: string; name: string; season: number | null } | null>(
      (best, t) => {
        if (!best) return t;
        const bestSeason = best.season ?? -1;
        const tSeason = t.season ?? -1;
        return tSeason > bestSeason ? t : best;
      },
      null,
    );

    let currentSeason: TeamSeasonStats | null = null;
    if (currentTournament) {
      const [seasonScorers, seasonMinutes, seasonCards] = await Promise.all([
        teamsRepository.getTopScorers(htTeamId, 10, currentTournament.id),
        teamsRepository.getTopMinutes(htTeamId, 10, currentTournament.id),
        teamsRepository.getTopCards(htTeamId, 10, currentTournament.id),
      ]);
      currentSeason = {
        tournamentId: currentTournament.id,
        tournamentName: currentTournament.name,
        season: currentTournament.season,
        topScorers: seasonScorers,
        topMinutes: seasonMinutes,
        topCards: seasonCards,
      };
    }

    return ok({
      team,
      tournaments,
      roster,
      matches,
      globalStats,
      topScorers,
      topMinutes,
      topCards,
      currentSeason,
    });
  };
}
