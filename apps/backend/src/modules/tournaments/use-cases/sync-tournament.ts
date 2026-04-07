import { randomUUID } from 'crypto';
import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, notFoundError, chppError } from '@hattrictos-stats/shared';
import type { TournamentRepository } from '../infrastructure/tournaments.repository';
import type { NewTournamentStandingRow, NewTournamentMatchRow } from '../infrastructure/tournaments.table';
import { createChppClient } from '../../../infrastructure/chpp/chpp-client';
import type { ChppTokenRepository } from '../../admin/infrastructure/chpp-token.repository';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncTournament = (
  tournamentId: string,
) => Promise<Result<{ synced: true }, AppError>>;

// ─── CHPP data parsers ────────────────────────────────────────────────────────

function getNum(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return Number(v);
  }
  return NaN;
}

function getStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v !== '') return v;
  }
  return '';
}

/**
 * Parses the `tournamentleaguetables` CHPP response into standings rows.
 *
 * Shape (simplified):
 * {
 *   TournamentLeagueTables: {
 *     TournamentLeagueTable: TournamentLeagueTable | TournamentLeagueTable[]
 *   }
 * }
 * Each TournamentLeagueTable has: GroupId, Teams: { Team: Team | Team[] }
 * Each Team has: TeamID, TeamName, Position, GamesPlayed, Won, Drawn, Lost,
 *               GoalsFor, GoalsAgainst, Points
 */
export function parseStandings(
  tournamentId: string,
  raw: unknown,
): NewTournamentStandingRow[] {
  const root = raw as Record<string, unknown>;
  // fast-xml-parser wraps everything under the XML root element (HattrickData)
  const htData = (root['HattrickData'] ?? root) as Record<string, unknown>;
  const wrapper =
    (htData['TournamentLeagueTables'] ?? htData['tournamentLeagueTables'] ?? htData) as Record<string, unknown>;
  const rawTables =
    wrapper['TournamentLeagueTable'] ?? wrapper['tournamentLeagueTable'];

  if (!rawTables) return [];

  const tables: Record<string, unknown>[] = Array.isArray(rawTables)
    ? rawTables
    : [rawTables as Record<string, unknown>];

  const rows: NewTournamentStandingRow[] = [];

  for (const table of tables) {
    const groupId = getNum(table, 'GroupId', 'groupId') || 1;
    const teamsWrapper = (table['Teams'] ?? table['teams']) as Record<string, unknown> | undefined;
    if (!teamsWrapper) continue;

    const rawTeams = teamsWrapper['Team'] ?? teamsWrapper['team'];
    if (!rawTeams) continue;

    const teams: Record<string, unknown>[] = Array.isArray(rawTeams)
      ? rawTeams
      : [rawTeams as Record<string, unknown>];

    for (const team of teams) {
      const htTeamId = getNum(team, 'TeamID', 'teamID', 'teamId');
      if (isNaN(htTeamId)) continue;

      rows.push({
        id: randomUUID(),
        tournamentId,
        groupId,
        htTeamId,
        teamName: getStr(team, 'TeamName', 'teamName') || `Team ${htTeamId}`,
        position: getNum(team, 'Position', 'position') || rows.length + 1,
        played: getNum(team, 'GamesPlayed', 'gamesPlayed', 'Matches', 'matches') || 0,
        won: getNum(team, 'Won', 'won') || 0,
        drawn: getNum(team, 'Drawn', 'drawn') || 0,
        lost: getNum(team, 'Lost', 'lost') || 0,
        goalsFor: getNum(team, 'GoalsFor', 'goalsFor') || 0,
        goalsAgainst: getNum(team, 'GoalsAgainst', 'goalsAgainst') || 0,
        points: getNum(team, 'Points', 'points') || 0,
      });
    }
  }

  return rows;
}

/**
 * Parses the `tournamentfixtures` CHPP response into match rows.
 *
 * Real shape confirmed via DevTools:
 * {
 *   HattrickData: {
 *     Matches: {
 *       Match: Match | Match[]
 *     }
 *   }
 * }
 * Each Match has: MatchId, HomeTeamId, HomeTeamName, AwayTeamId, AwayTeamName,
 *                 MatchDate, MatchRound, Group, Status (0=upcoming, 1=finished),
 *                 HomeGoals, AwayGoals
 */
export function parseMatches(
  tournamentId: string,
  raw: unknown,
): NewTournamentMatchRow[] {
  const root = raw as Record<string, unknown>;
  // fast-xml-parser wraps everything under the XML root element (HattrickData)
  const htData = (root['HattrickData'] ?? root) as Record<string, unknown>;
  const matchesWrapper = (htData['Matches'] ?? htData['matches']) as Record<string, unknown> | undefined;
  if (!matchesWrapper) return [];

  const rawMatches = matchesWrapper['Match'] ?? matchesWrapper['match'];
  if (!rawMatches) return [];

  const matches: Record<string, unknown>[] = Array.isArray(rawMatches)
    ? rawMatches
    : [rawMatches as Record<string, unknown>];

  const rows: NewTournamentMatchRow[] = [];

  for (const m of matches) {
    const htMatchId = getNum(m, 'MatchId', 'MatchID', 'matchId');
    const homeTeamId = getNum(m, 'HomeTeamId', 'HomeTeamID', 'homeTeamId');
    const awayTeamId = getNum(m, 'AwayTeamId', 'AwayTeamID', 'awayTeamId');
    if (isNaN(htMatchId) || isNaN(homeTeamId) || isNaN(awayTeamId)) continue;

    // Status in CHPP tournamentfixtures: 0 = upcoming, 2 = finished
    const statusVal = getNum(m, 'Status', 'status');
    const statusStr = getStr(m, 'Status', 'status').toLowerCase();
    const isFinished = statusVal === 2 || statusStr === 'finished' || statusStr === 'finalizado';
    const status = isFinished ? 'Finished' : 'Upcoming';

    const rawHomeGoals = getNum(m, 'HomeGoals', 'homeGoals');
    const rawAwayGoals = getNum(m, 'AwayGoals', 'awayGoals');

    rows.push({
      id: randomUUID(),
      tournamentId,
      htMatchId,
      round: getNum(m, 'MatchRound', 'matchRound') || 0,
      matchDate: getStr(m, 'MatchDate', 'matchDate') || '',
      homeTeamId,
      homeTeamName: getStr(m, 'HomeTeamName', 'homeTeamName') || `Team ${homeTeamId}`,
      awayTeamId,
      awayTeamName: getStr(m, 'AwayTeamName', 'awayTeamName') || `Team ${awayTeamId}`,
      homeGoals: isFinished && !isNaN(rawHomeGoals) ? rawHomeGoals : null,
      awayGoals: isFinished && !isNaN(rawAwayGoals) ? rawAwayGoals : null,
      status,
    });
  }

  return rows;
}

// ─── Use case ─────────────────────────────────────────────────────────────────

/**
 * Syncs a registered tournament's data from CHPP:
 *  1. Fetches tournamentleaguetables → replaces all standings rows
 *  2. Fetches tournamentfixtures → upserts all match rows
 *  3. Marks lastSyncedAt = now
 *
 * Requires a valid active CHPP token in the DB.
 */
export function createSyncTournament(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
  tournamentRepository: TournamentRepository,
): SyncTournament {
  return async (tournamentId: string) => {
    const tournament = await tournamentRepository.findById(tournamentId);
    if (!tournament) {
      return err(notFoundError(`Tournament ${tournamentId} not found.`));
    }

    const activeToken = await tokenRepository.getActive();
    if (!activeToken) {
      return err(notFoundError('No active CHPP token. Please connect via /api/admin/chpp/connect.'));
    }

    const chpp = createChppClient({
      ...chppClientConfig,
      accessToken: activeToken.accessToken,
      accessTokenSecret: activeToken.accessTokenSecret,
    });

    // Fetch in parallel: details (for name refresh) + standings + fixtures
    const [detailsResult, tableResult, fixturesResult] = await Promise.all([
      chpp.fetch({ file: 'tournamentdetails', tournamentID: tournament.htTournamentId }),
      chpp.fetch({ file: 'tournamentleaguetables', tournamentID: tournament.htTournamentId }),
      chpp.fetch({ file: 'tournamentfixtures', tournamentID: tournament.htTournamentId }),
    ]);

    if (!tableResult.ok) return err(tableResult.error);
    if (!fixturesResult.ok) return err(fixturesResult.error);

    // Refresh tournament metadata if details fetch succeeded
    if (detailsResult.ok) {
      const raw = detailsResult.value as Record<string, unknown>;
      const htData = (raw['HattrickData'] ?? raw) as Record<string, unknown>;
      const td = (htData['Tournament'] ?? htData['tournament'] ?? htData) as Record<string, unknown>;
      const name = String(td['Name'] ?? td['name'] ?? '') || undefined;
      const season = Number(td['Season'] ?? td['season'] ?? 0) || null;
      const tournamentType = Number(td['TournamentType'] ?? td['tournamentType'] ?? 0) || null;
      const numberOfTeams = Number(td['NumberOfTeams'] ?? td['numberOfTeams'] ?? 0) || null;

      await tournamentRepository.updateDetails(tournamentId, {
        name,
        season,
        tournamentType,
        numberOfTeams,
      });
    }

    const standingRows = parseStandings(tournamentId, tableResult.value);
    const matchRows = parseMatches(tournamentId, fixturesResult.value);

    await Promise.all([
      tournamentRepository.replaceStandings(tournamentId, standingRows),
      tournamentRepository.replaceMatches(tournamentId, matchRows),
    ]);

    await tournamentRepository.markSynced(tournamentId);

    return ok({ synced: true as const });
  };
}
