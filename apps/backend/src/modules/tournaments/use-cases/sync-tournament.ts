import { randomUUID } from 'crypto';
import type { Result, AppError } from '@hattrictos-stats/shared';
import { ok, err, notFoundError } from '@hattrictos-stats/shared';
import type { TournamentRepository } from '../infrastructure/tournaments.repository';
import type {
  NewTournamentStandingRow,
  NewTournamentMatchRow,
  NewMatchEventRow,
  NewMatchAppearanceRow,
  NewMatchBookingRow,
} from '../infrastructure/tournaments.table';
import { createChppClient } from '../../../infrastructure/chpp/chpp-client';
import type { ChppTokenRepository } from '../../admin/infrastructure/chpp-token.repository';
import type { TeamsRepository } from '../../teams/infrastructure/teams.repository';
import type { PlayersRepository } from '../../players/infrastructure/players.repository';
import type { CountriesRepository } from '../../players/infrastructure/countries.repository';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncTournament = (
  tournamentId: string,
) => Promise<Result<{ synced: true; matchesSynced: number }, AppError>>;

// ─── Generic helpers ──────────────────────────────────────────────────────────

function getNum(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return Number(v);
  }
  return NaN;
}

function withFallback(value: number, fallback: number): number {
  return Number.isNaN(value) ? fallback : value;
}

function getStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v !== '') return v;
  }
  return '';
}

function toArray<T>(val: unknown): T[] {
  if (!val) return [];
  return Array.isArray(val) ? (val as T[]) : [val as T];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Standings parser ─────────────────────────────────────────────────────────

/**
 * Parses the `tournamentleaguetables` CHPP response into standings rows.
 * Also returns a teamNames map (htTeamId → name) for use in Phase 2 team upserts.
 */
export function parseStandings(
  tournamentId: string,
  raw: unknown,
): { rows: NewTournamentStandingRow[]; teamNames: Map<number, string> } {
  const root = raw as Record<string, unknown>;
  const htData = (root['HattrickData'] ?? root) as Record<string, unknown>;
  const wrapper =
    (htData['TournamentLeagueTables'] ?? htData['tournamentLeagueTables'] ?? htData) as Record<string, unknown>;
  const rawTables =
    wrapper['TournamentLeagueTable'] ?? wrapper['tournamentLeagueTable'];

  if (!rawTables) return { rows: [], teamNames: new Map() };

  const tables = toArray<Record<string, unknown>>(rawTables);
  const rows: NewTournamentStandingRow[] = [];
  const teamNames = new Map<number, string>();

  for (const table of tables) {
    const groupId = getNum(table, 'GroupId', 'groupId') || 1;
    const teamsWrapper = (table['Teams'] ?? table['teams']) as Record<string, unknown> | undefined;
    if (!teamsWrapper) continue;

    const rawTeams = teamsWrapper['Team'] ?? teamsWrapper['team'];
    if (!rawTeams) continue;

    const teams = toArray<Record<string, unknown>>(rawTeams);

    for (const team of teams) {
      const htTeamId = getNum(team, 'TeamID', 'teamID', 'teamId');
      if (isNaN(htTeamId)) continue;

      const name = getStr(team, 'TeamName', 'teamName') || `Team ${htTeamId}`;
      teamNames.set(htTeamId, name);

      const played = getNum(team, 'GamesPlayed', 'gamesPlayed', 'Matches', 'matches');
      const won = getNum(team, 'Won', 'won');
      const lost = getNum(team, 'Lost', 'lost');
      const rawDrawn = getNum(team, 'Drawn', 'drawn', 'Draws', 'draws');
      const derivedDrawn = !isNaN(played) && !isNaN(won) && !isNaN(lost)
        ? Math.max(0, played - won - lost)
        : 0;

      rows.push({
        id: randomUUID(),
        tournamentId,
        groupId,
        htTeamId,
        position: getNum(team, 'Position', 'position') || rows.length + 1,
        played: withFallback(played, 0),
        won: withFallback(won, 0),
        drawn: withFallback(rawDrawn, derivedDrawn),
        lost: withFallback(lost, 0),
        goalsFor: getNum(team, 'GoalsFor', 'goalsFor') || 0,
        goalsAgainst: getNum(team, 'GoalsAgainst', 'goalsAgainst') || 0,
        points: getNum(team, 'Points', 'points') || 0,
      });
    }
  }

  return { rows, teamNames };
}

// ─── Matches parser ───────────────────────────────────────────────────────────

/**
 * Parses the `tournamentfixtures` CHPP response into match rows.
 * Status in CHPP tournamentfixtures: 0 = upcoming, 2 = finished.
 */
export function parseMatches(
  tournamentId: string,
  raw: unknown,
): NewTournamentMatchRow[] {
  const root = raw as Record<string, unknown>;
  const htData = (root['HattrickData'] ?? root) as Record<string, unknown>;
  const matchesWrapper = (htData['Matches'] ?? htData['matches']) as Record<string, unknown> | undefined;
  if (!matchesWrapper) return [];

  const rawMatches = matchesWrapper['Match'] ?? matchesWrapper['match'];
  if (!rawMatches) return [];

  const matches = toArray<Record<string, unknown>>(rawMatches);
  const rows: NewTournamentMatchRow[] = [];

  for (const m of matches) {
    const htMatchId = getNum(m, 'MatchId', 'MatchID', 'matchId');
    const homeTeamId = getNum(m, 'HomeTeamId', 'HomeTeamID', 'homeTeamId');
    const awayTeamId = getNum(m, 'AwayTeamId', 'AwayTeamID', 'awayTeamId');
    if (isNaN(htMatchId) || isNaN(homeTeamId) || isNaN(awayTeamId)) continue;

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
      awayTeamId,
      homeGoals: isFinished && !isNaN(rawHomeGoals) ? rawHomeGoals : null,
      awayGoals: isFinished && !isNaN(rawAwayGoals) ? rawAwayGoals : null,
      status,
      detailsSynced: 0,
    });
  }

  return rows;
}

// ─── Match events parser ──────────────────────────────────────────────────────

/**
 * Parses goal events (EventTypeID 100-199) from matchdetails CHPP response.
 *
 * Shape: HattrickData.Match.EventList.Event[]
 * For goals: SubjectPlayerID = scorer, ObjectPlayerID = assister
 */
export function parseMatchEvents(
  matchId: string,
  tournamentId: string,
  raw: unknown,
): NewMatchEventRow[] {
  const root = raw as Record<string, unknown>;
  const htData = (root['HattrickData'] ?? root) as Record<string, unknown>;
  const match = (htData['Match'] ?? htData['match']) as Record<string, unknown> | undefined;
  if (!match) return [];

  const eventList = (match['EventList'] ?? match['eventList']) as Record<string, unknown> | undefined;
  if (!eventList) return [];

  const rawEvents = eventList['Event'] ?? eventList['event'];
  if (!rawEvents) return [];

  const events = toArray<Record<string, unknown>>(rawEvents);
  const rows: NewMatchEventRow[] = [];

  for (const ev of events) {
    const eventTypeId = getNum(ev, 'EventTypeID', 'eventTypeId', 'EventTypeId');
    if (isNaN(eventTypeId)) continue;

    // Only store goal events (100-199)
    if (eventTypeId < 100 || eventTypeId > 199) continue;

    const minute = getNum(ev, 'Minute', 'minute');
    const subjectPlayerId = getNum(ev, 'SubjectPlayerID', 'subjectPlayerId', 'SubjectPlayerID');
    const subjectTeamId = getNum(ev, 'SubjectTeamID', 'subjectTeamId', 'SubjectTeamID');
    const objectPlayerId = getNum(ev, 'ObjectPlayerID', 'objectPlayerId', 'ObjectPlayerID');

    rows.push({
      id: randomUUID(),
      matchId,
      tournamentId,
      eventTypeId,
      minute: isNaN(minute) ? 0 : minute,
      subjectPlayerId: isNaN(subjectPlayerId) ? null : subjectPlayerId,
      subjectTeamId: isNaN(subjectTeamId) ? null : subjectTeamId,
      objectPlayerId: isNaN(objectPlayerId) ? null : objectPlayerId,
    });
  }

  return rows;
}

// ─── Match bookings parser ────────────────────────────────────────────────────

/**
 * Parses bookings (cards) from matchdetails CHPP response.
 *
 * Shape: HattrickData.Match.Bookings.Booking (single object or array)
 * Fields: BookingPlayerID, BookingTeamID, BookingType, BookingMinute
 *
 * BookingType: 1 = yellow, 2 = yellow-red (2nd yellow → red), 3 = red
 */
export function parseMatchBookings(
  matchId: string,
  tournamentId: string,
  raw: unknown,
): NewMatchBookingRow[] {
  const root = raw as Record<string, unknown>;
  const htData = (root['HattrickData'] ?? root) as Record<string, unknown>;
  const match = (htData['Match'] ?? htData['match']) as Record<string, unknown> | undefined;
  if (!match) return [];

  const bookingsWrapper = (match['Bookings'] ?? match['bookings']) as Record<string, unknown> | undefined;
  if (!bookingsWrapper) return [];

  const rawBookings = bookingsWrapper['Booking'] ?? bookingsWrapper['booking'];
  if (!rawBookings) return [];

  const bookings = toArray<Record<string, unknown>>(rawBookings);
  const rows: NewMatchBookingRow[] = [];

  for (const b of bookings) {
    const htPlayerId = getNum(b, 'BookingPlayerID', 'bookingPlayerId');
    const htTeamId = getNum(b, 'BookingTeamID', 'bookingTeamId');
    const bookingType = getNum(b, 'BookingType', 'bookingType');
    const minute = getNum(b, 'BookingMinute', 'bookingMinute');

    if (isNaN(htPlayerId) || isNaN(htTeamId) || isNaN(bookingType) || isNaN(minute)) continue;

    rows.push({
      id: randomUUID(),
      matchId,
      tournamentId,
      htPlayerId,
      htTeamId,
      bookingType,
      minute,
    });
  }

  return rows;
}

// ─── Match lineup parser ──────────────────────────────────────────────────────

interface ParsedLineupResult {
  appearances: NewMatchAppearanceRow[];
  players: Array<{
    htPlayerId: number;
    firstName: string;
    lastName: string;
    htTeamId: number;
  }>;
}

/**
 * Parses a matchlineup CHPP response for ONE team.
 *
 * Shape: HattrickData.Team.StartingLineup.Player[] (starters)
 *        HattrickData.Team.Lineup.Player[]         (end-of-match, includes subs)
 *        HattrickData.Team.Substitutions.Substitution[]
 *
 * RoleID 100-113 = starting field positions
 * RoleID 114-118 = substitute bench
 * RoleID 19-21   = replaced players (already subbed out)
 *
 * minuteIn  = 0 for starters; substitution minute for subs coming in
 * minuteOut = substitution minute for starters taken off; null if full-time
 */
export function parseMatchLineup(
  matchId: string,
  tournamentId: string,
  raw: unknown,
): ParsedLineupResult {
  const root = raw as Record<string, unknown>;
  const htData = (root['HattrickData'] ?? root) as Record<string, unknown>;
  const teamSection = (htData['Team'] ?? htData['team']) as Record<string, unknown> | undefined;
  if (!teamSection) return { appearances: [], players: [] };

  const htTeamId = getNum(teamSection, 'TeamID', 'teamId', 'TeamId');

  // ── Starting lineup (who started) ───────────────────────────────────────────
  const startingWrapper = (teamSection['StartingLineup'] ?? teamSection['startingLineup']) as
    | Record<string, unknown>
    | undefined;
  const rawStarters = startingWrapper
    ? (startingWrapper['Player'] ?? startingWrapper['player'])
    : null;
  const starters = toArray<Record<string, unknown>>(rawStarters);

  // ── End-of-match lineup (ratings + who played) ───────────────────────────────
  const lineupWrapper = (teamSection['Lineup'] ?? teamSection['lineup']) as
    | Record<string, unknown>
    | undefined;
  const rawLineup = lineupWrapper ? (lineupWrapper['Player'] ?? lineupWrapper['player']) : null;
  const lineupPlayers = toArray<Record<string, unknown>>(rawLineup);

  // Build rating map: playerId → ratingStars (from end-of-match Lineup)
  const ratingMap = new Map<number, number>();
  for (const p of lineupPlayers) {
    const pid = getNum(p, 'PlayerID', 'playerId', 'PlayerID');
    const rating = getNum(p, 'RatingStars', 'ratingStars');
    if (!isNaN(pid) && !isNaN(rating)) ratingMap.set(pid, rating);
  }

  // ── Substitutions ────────────────────────────────────────────────────────────
  const subsWrapper = (teamSection['Substitutions'] ?? teamSection['substitutions']) as
    | Record<string, unknown>
    | undefined;
  const rawSubs = subsWrapper
    ? (subsWrapper['Substitution'] ?? subsWrapper['substitution'])
    : null;
  const substitutions = toArray<Record<string, unknown>>(rawSubs);

  // Build maps from substitution data
  // playerOut → minuteOut (minute they were subbed off)
  const minuteOutMap = new Map<number, number>();
  // playerIn → { minuteIn, roleId, behaviour }
  const subInMap = new Map<number, { minuteIn: number; roleId: number; behaviour: number }>();

  for (const sub of substitutions) {
    const orderType = getNum(sub, 'OrderType', 'orderType');
    if (orderType !== 1) continue; // Only actual substitutions (not tactic/swap)

    const playerOut = getNum(sub, 'SubjectPlayerID', 'subjectPlayerId');
    const playerIn = getNum(sub, 'ObjectPlayerID', 'objectPlayerId');
    const minute = getNum(sub, 'MatchMinute', 'matchMinute');
    const newRoleId = getNum(sub, 'NewPositionId', 'newPositionId');
    const newBehaviour = getNum(sub, 'NewPositionBehaviour', 'newPositionBehaviour');

    if (!isNaN(playerOut) && !isNaN(minute)) minuteOutMap.set(playerOut, minute);
    if (!isNaN(playerIn) && !isNaN(minute)) {
      subInMap.set(playerIn, {
        minuteIn: minute,
        roleId: isNaN(newRoleId) ? 0 : newRoleId,
        behaviour: isNaN(newBehaviour) ? 0 : newBehaviour,
      });
    }
  }

  const appearances: NewMatchAppearanceRow[] = [];
  const players: ParsedLineupResult['players'] = [];

  // ── Process starters ─────────────────────────────────────────────────────────
  // Use a Map to deduplicate: keep the entry with the higher roleId (field position > bench role)
  const starterMap = new Map<number, { p: Record<string, unknown>; roleId: number }>();
  for (const p of starters) {
    const htPlayerId = getNum(p, 'PlayerID', 'playerId');
    if (isNaN(htPlayerId)) continue;
    const roleId = getNum(p, 'RoleID', 'roleId');
    const existing = starterMap.get(htPlayerId);
    // Prefer roleId >= 100 (actual field position) over lower values (bench/special roles)
    if (!existing || (roleId >= 100 && existing.roleId < 100)) {
      starterMap.set(htPlayerId, { p, roleId: isNaN(roleId) ? 0 : roleId });
    }
  }

  for (const [htPlayerId, { p, roleId }] of starterMap) {
    const firstName = getStr(p, 'FirstName', 'firstName');
    const lastName = getStr(p, 'LastName', 'lastName');
    const behaviour = getNum(p, 'Behaviour', 'behaviour');
    const minuteOut = minuteOutMap.get(htPlayerId) ?? null;
    const rating = ratingMap.get(htPlayerId) ?? null;

    appearances.push({
      id: randomUUID(),
      matchId,
      tournamentId,
      htPlayerId,
      htTeamId: isNaN(htTeamId) ? 0 : htTeamId,
      roleId,
      behaviour: isNaN(behaviour) ? 0 : behaviour,
      minuteIn: 0,
      minuteOut,
      ratingStars: rating !== null ? rating : null,
    });

    players.push({
      htPlayerId,
      firstName,
      lastName,
      htTeamId: isNaN(htTeamId) ? 0 : htTeamId,
    });
  }

  // ── Process substitutes (players who came in) ────────────────────────────────
  for (const p of lineupPlayers) {
    const htPlayerId = getNum(p, 'PlayerID', 'playerId');
    if (isNaN(htPlayerId)) continue;

    // Skip if already processed as a starter
    if (appearances.some((a) => a.htPlayerId === htPlayerId)) continue;

    const subInfo = subInMap.get(htPlayerId);
    if (!subInfo) continue; // Not a sub that came in — skip (e.g. unused bench)

    const firstName = getStr(p, 'FirstName', 'firstName');
    const lastName = getStr(p, 'LastName', 'lastName');
    const rating = ratingMap.get(htPlayerId) ?? null;

    appearances.push({
      id: randomUUID(),
      matchId,
      tournamentId,
      htPlayerId,
      htTeamId: isNaN(htTeamId) ? 0 : htTeamId,
      roleId: subInfo.roleId,
      behaviour: subInfo.behaviour,
      minuteIn: subInfo.minuteIn,
      minuteOut: null,
      ratingStars: rating !== null ? rating : null,
    });

    players.push({
      htPlayerId,
      firstName,
      lastName,
      htTeamId: isNaN(htTeamId) ? 0 : htTeamId,
    });
  }

  return { appearances, players };
}

// ─── Use case ─────────────────────────────────────────────────────────────────

/**
 * Syncs a registered tournament's data from CHPP:
 *
 *  Phase 0 — worlddetails → upsert countries table (ISO codes for flags)
 *  Phase 1 — Base sync (standings + fixtures + metadata refresh)
 *  Phase 2 — Upsert teams from standings into teams + tournament_team_seasons
 *  Phase 2b — Enrich teams with teamdetails (skip if already done)
 *  Phase 2c — Enrich player roster via file=players per team (skip if < 7 days since last sync)
 *  Phase 3 — For each finished match without details:
 *              · matchdetails v3.1 → parse goals → insert match_events
 *              · matchlineup v2.1 (home) → parse lineup → insert match_appearances
 *              · matchlineup v2.1 (away) → parse lineup → insert match_appearances
 *              · upsert players encountered
 *              · mark detailsSynced = 1
 *              · 500ms delay between matches to respect CHPP rate limits
 */
export function createSyncTournament(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
  tournamentRepository: TournamentRepository,
  teamsRepository: TeamsRepository,
  playersRepository: PlayersRepository,
  countriesRepository: CountriesRepository,
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

    // ── Phase 0: Sync countries from worlddetails ────────────────────────────
    // One call, always — data is idempotent and rarely changes.

    const worldDetailsRes = await chpp.fetch({ file: 'worlddetails', version: '1.9' });
    if (worldDetailsRes.ok) {
      const wd = worldDetailsRes.value as Record<string, unknown>;
      const htData = (wd['HattrickData'] ?? wd) as Record<string, unknown>;
      const leagueListWrapper = (htData['LeagueList'] ?? htData['leagueList'] ?? {}) as Record<string, unknown>;
      const rawLeagues = leagueListWrapper['League'] ?? leagueListWrapper['league'];
      const leagues = toArray<Record<string, unknown>>(rawLeagues);

      for (const league of leagues) {
        const leagueId = getNum(league, 'LeagueID', 'leagueID', 'leagueId');
        const countryWrapper = (league['Country'] ?? league['country'] ?? {}) as Record<string, unknown>;
        const countryId = getNum(countryWrapper, 'CountryID', 'countryID', 'countryId');
        const countryCode = getStr(countryWrapper, 'CountryCode', 'countryCode');

        if (isNaN(countryId) || countryId <= 0 || !countryCode) continue;

        const name = getStr(league, 'EnglishName', 'englishName', 'Name', 'name') || `Country ${countryId}`;
        await countriesRepository.upsertCountry({
          countryId,
          leagueId: isNaN(leagueId) ? null : leagueId,
          countryCode: countryCode.toLowerCase(),
          name,
        });
      }
    }

    // ── Phase 1: Base sync ───────────────────────────────────────────────────

    const [detailsResult, tableResult, fixturesResult] = await Promise.all([
      chpp.fetch({ file: 'tournamentdetails', tournamentID: tournament.htTournamentId }),
      chpp.fetch({ file: 'tournamentleaguetables', tournamentID: tournament.htTournamentId }),
      chpp.fetch({ file: 'tournamentfixtures', tournamentID: tournament.htTournamentId }),
    ]);

    if (!tableResult.ok) return err(tableResult.error);
    if (!fixturesResult.ok) return err(fixturesResult.error);

    // Refresh tournament metadata
    if (detailsResult.ok) {
      const raw = detailsResult.value as Record<string, unknown>;
      const htData = (raw['HattrickData'] ?? raw) as Record<string, unknown>;
      const td = (htData['Tournament'] ?? htData['tournament'] ?? htData) as Record<string, unknown>;

      await tournamentRepository.updateDetails(tournamentId, {
        name: String(td['Name'] ?? td['name'] ?? '') || undefined,
        season: Number(td['Season'] ?? td['season'] ?? 0) || null,
        tournamentType: Number(td['TournamentType'] ?? td['tournamentType'] ?? 0) || null,
        numberOfTeams: Number(td['NumberOfTeams'] ?? td['numberOfTeams'] ?? 0) || null,
      });
    }

    const { rows: standingRows, teamNames } = parseStandings(tournamentId, tableResult.value);
    const matchRows = parseMatches(tournamentId, fixturesResult.value);

    await Promise.all([
      tournamentRepository.replaceStandings(tournamentId, standingRows),
      tournamentRepository.replaceMatches(tournamentId, matchRows),
    ]);

    // ── Phase 2: Upsert teams from standings ─────────────────────────────────

    const teamUpserts = standingRows.map((row) =>
      teamsRepository.upsertTeam({ htTeamId: row.htTeamId, name: teamNames.get(row.htTeamId) ?? `Team ${row.htTeamId}` }),
    );
    await Promise.all(teamUpserts);
    await teamsRepository.replaceTeamSeasons(
      tournamentId,
      standingRows.map((r) => r.htTeamId),
    );

    // ── Phase 2b: Enrich teams with teamdetails from CHPP (skip if already done) ──

    const upsertedTeams = await Promise.all(
      standingRows.map((r) => teamsRepository.findByHtId(r.htTeamId)),
    );

    for (const team of upsertedTeams) {
      if (!team) continue;
      // Skip if already enriched (manager_login_name populated)
      if (team.managerLoginName && team.managerLoginName !== '') continue;

      await delay(500);
      const teamDetailsRes = await chpp.fetch({ file: 'teamdetails', teamID: team.htTeamId });
      if (!teamDetailsRes.ok) continue;

      const raw = teamDetailsRes.value as Record<string, unknown>;
      const htData = (raw['HattrickData'] ?? raw) as Record<string, unknown>;
      const td = (htData['Team'] ?? htData['team'] ?? htData) as Record<string, unknown>;

      const manager = (td['Manager'] ?? td['manager'] ?? {}) as Record<string, unknown>;
      const league = (td['League'] ?? td['league'] ?? {}) as Record<string, unknown>;
      const arena = (td['Arena'] ?? td['arena'] ?? {}) as Record<string, unknown>;

      await teamsRepository.updateTeamDetails(team.htTeamId, {
        shortName: String(td['ShortTeamName'] ?? td['shortTeamName'] ?? '') || undefined,
        managerLoginName: String(manager['Loginname'] ?? manager['loginname'] ?? '') || undefined,
        leagueName: String(league['LeagueName'] ?? league['leagueName'] ?? '') || undefined,
        arenaName: String(arena['ArenaName'] ?? arena['arenaName'] ?? '') || undefined,
        foundedDate: String(td['FoundedDate'] ?? td['foundedDate'] ?? '') || undefined,
      });
    }

    // ── Phase 3: Sync match details (incremental) ────────────────────────────

    const unsyncedMatches = await tournamentRepository.getUnsyncedFinishedMatches(tournamentId);
    let matchesSynced = 0;

    for (const match of unsyncedMatches) {
      // 3a. Fetch matchdetails for goals
      const detailsRes = await chpp.fetch({
        file: 'matchdetails',
        version: '3.1',
        matchID: match.htMatchId,
        sourceSystem: 'HTOIntegrated',
        matchEvents: true,
      });

      // 3b. Fetch lineups for both teams (sequentially to respect rate limit)
      await delay(500);
      const homeLineupRes = await chpp.fetch({
        file: 'matchlineup',
        version: '2.1',
        matchID: match.htMatchId,
        teamID: match.homeTeamId,
        sourceSystem: 'HTOIntegrated',
      });

      await delay(500);
      const awayLineupRes = await chpp.fetch({
        file: 'matchlineup',
        version: '2.1',
        matchID: match.htMatchId,
        teamID: match.awayTeamId,
        sourceSystem: 'HTOIntegrated',
      });

      // Parse goals — even if lineup fails we still want to store goals
      const eventRows: NewMatchEventRow[] = detailsRes.ok
        ? parseMatchEvents(match.id, tournamentId, detailsRes.value)
        : [];

      // Parse bookings (cards)
      const bookingRows: NewMatchBookingRow[] = detailsRes.ok
        ? parseMatchBookings(match.id, tournamentId, detailsRes.value)
        : [];

      // Parse lineups
      const homeLineup: ParsedLineupResult = homeLineupRes.ok
        ? parseMatchLineup(match.id, tournamentId, homeLineupRes.value)
        : { appearances: [], players: [] };
      const awayLineup: ParsedLineupResult = awayLineupRes.ok
        ? parseMatchLineup(match.id, tournamentId, awayLineupRes.value)
        : { appearances: [], players: [] };

      const allAppearances = [...homeLineup.appearances, ...awayLineup.appearances];
      const allPlayers = [...homeLineup.players, ...awayLineup.players];

      // Upsert players encountered in this match — WITHOUT htTeamId so we
      // don't set currentHtTeamId from lineup data. Only Phase 4 (file=players)
      // is authoritative for the current roster.
      await Promise.all(
        allPlayers.map((p) =>
          playersRepository.upsertPlayer({
            htPlayerId: p.htPlayerId,
            firstName: p.firstName,
            lastName: p.lastName,
          }),
        ),
      );

      // Persist events + appearances + bookings
      await Promise.all([
        tournamentRepository.replaceMatchEvents(match.id, eventRows),
        tournamentRepository.replaceMatchAppearances(match.id, allAppearances),
        tournamentRepository.replaceMatchBookings(match.id, bookingRows),
      ]);

      await tournamentRepository.markMatchDetailsSynced(match.id);
      matchesSynced++;

      // Rate limit: 500ms before next match
      if (matchesSynced < unsyncedMatches.length) {
        await delay(500);
      }
    }

    // ── Phase 4: Enrich player roster via file=players (once per week per team) ──
    // Runs AFTER Phase 3 so that clearCurrentTeam is never overwritten by upsertPlayer
    // calls from match lineups processed in the same sync run.

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const team of upsertedTeams) {
      if (!team) continue;

      // Re-fetch from DB to get the current playersSyncedAt (may have been reset externally)
      const freshTeam = await teamsRepository.findByHtId(team.htTeamId);
      if (!freshTeam) continue;

      // Skip if synced within the last 7 days
      if (freshTeam.playersSyncedAt && now - freshTeam.playersSyncedAt.getTime() < SEVEN_DAYS_MS) continue;

      await delay(500);
      const playersRes = await chpp.fetch({ file: 'players', teamID: team.htTeamId, version: '2.0' });
      if (!playersRes.ok) continue;

      const raw = playersRes.value as Record<string, unknown>;

      const htData = (raw['HattrickData'] ?? raw) as Record<string, unknown>;
      const teamWrapper = (htData['Team'] ?? htData['team'] ?? htData) as Record<string, unknown>;
      const playerListWrapper = (teamWrapper['PlayerList'] ?? teamWrapper['playerList'] ?? teamWrapper) as Record<string, unknown>;
      const rawPlayers = playerListWrapper['Player'] ?? playerListWrapper['player'];
      const chppPlayers = toArray<Record<string, unknown>>(rawPlayers);

      // Recopilar los IDs de jugadores en la respuesta CHPP
      const chppPlayerIds = new Set<number>();

      for (const p of chppPlayers) {
        // Skip trainers — CHPP includes them in PlayerList but they are not
        // squad players. Trainers have a TrainerData sub-object.
        if (p['TrainerData'] || p['trainerData']) continue;

        const htPlayerId = getNum(p, 'PlayerID', 'playerID', 'playerId');
        if (isNaN(htPlayerId)) continue;

        chppPlayerIds.add(htPlayerId);

        const firstName = String(p['FirstName'] ?? p['firstName'] ?? '');
        const lastName = String(p['LastName'] ?? p['lastName'] ?? '');

        // Upsert para garantizar que el jugador existe en la BD aunque nunca haya jugado
        await playersRepository.upsertPlayer({
          htPlayerId,
          firstName: firstName || 'Player',
          lastName: lastName || String(htPlayerId),
          htTeamId: team.htTeamId,
        });

        const age = getNum(p, 'Age', 'age');
        const ageDays = getNum(p, 'AgeDays', 'ageDays');
        const countryId = getNum(p, 'CountryID', 'countryID', 'Nationality', 'nationality');

        await playersRepository.updatePlayerDetails(htPlayerId, {
          age: isNaN(age) ? null : age,
          ageDays: isNaN(ageDays) ? null : ageDays,
          countryId: isNaN(countryId) || countryId <= 0 ? null : countryId,
        });
      }

      // Detectar jugadores que ya no están en el equipo según CHPP
      // y limpiar su current_ht_team_id para que no aparezcan en la plantilla
      const dbPlayers = await playersRepository.listByCurrentTeam(team.htTeamId);
      for (const dbPlayer of dbPlayers) {
        if (!chppPlayerIds.has(dbPlayer.htPlayerId)) {
          await playersRepository.clearCurrentTeam(dbPlayer.htPlayerId);
        }
      }

      // Registrar timestamp de sync
      await teamsRepository.updatePlayersSyncedAt(team.htTeamId, new Date());
    }

    await tournamentRepository.markSynced(tournamentId);

    return ok({ synced: true as const, matchesSynced });
  };
}
