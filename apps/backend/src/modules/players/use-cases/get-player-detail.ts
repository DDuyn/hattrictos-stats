import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, notFoundError } from '@hattrictos-stats/shared';
import type {
  PlayersRepository,
  PlayerWithCountry,
  PlayerTeamHistoryEntry,
  PlayerMatchStat,
} from '../infrastructure/players.repository';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerCareerTotals {
  matches: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  /** Media de minutos por partido */
  avgMinutes: number;
  /** Media de valoración (solo partidos con ratingStars != null) */
  avgRating: number | null;
  /** Mejor valoración individual */
  bestRating: number | null;
}

export interface PlayerDetail {
  player: PlayerWithCountry;
  teamHistory: PlayerTeamHistoryEntry[];
  matchStats: PlayerMatchStat[];
  totals: PlayerCareerTotals;
}

export type GetPlayerDetail = (htPlayerId: number) => Promise<Result<PlayerDetail, AppError>>;

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGetPlayerDetail(playersRepository: PlayersRepository): GetPlayerDetail {
  return async (htPlayerId) => {
    const player = await playersRepository.findByHtIdWithCountry(htPlayerId);
    if (!player) {
      return err(notFoundError(`Player with htPlayerId ${htPlayerId} not found.`));
    }

    const [teamHistory, matchStats] = await Promise.all([
      playersRepository.getTeamHistory(htPlayerId),
      playersRepository.getMatchStats(htPlayerId),
    ]);

    const base = matchStats.reduce(
      (acc, m) => ({
        matches: acc.matches + 1,
        minutesPlayed: acc.minutesPlayed + m.minutesPlayed,
        goals: acc.goals + m.goals,
        assists: acc.assists + m.assists,
        yellowCards: acc.yellowCards + m.yellowCards,
        redCards: acc.redCards + m.redCards,
      }),
      { matches: 0, minutesPlayed: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
    );

    const ratedMatches = matchStats.filter((m) => m.ratingStars !== null);
    const avgRating =
      ratedMatches.length > 0
        ? ratedMatches.reduce((s, m) => s + m.ratingStars!, 0) / ratedMatches.length
        : null;
    const bestRating =
      ratedMatches.length > 0
        ? Math.max(...ratedMatches.map((m) => m.ratingStars!))
        : null;

    const totals: PlayerCareerTotals = {
      ...base,
      avgMinutes: base.matches > 0 ? Math.round(base.minutesPlayed / base.matches) : 0,
      avgRating,
      bestRating,
    };

    return ok({ player, teamHistory, matchStats, totals });
  };
}
