import { createStore } from 'solid-js/store';
import { onMount } from 'solid-js';
import { chppApi } from '../../domain/chpp/chpp.api';
import { useToast } from '../../context/toast.context';

type QueryType = 'match' | 'tournament' | 'raw';

interface ConnectionStatus {
  checked: boolean;
  connected: boolean;
  teamName: string | null;
  htLoginName: string | null;
}

export interface StandingsRow {
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

interface TournamentResult {
  details: unknown;
  fixtures: unknown;
  table: unknown;
  standings: StandingsRow[];
}

export interface RawParam {
  key: string;
  value: string;
}

interface ChppExplorerState {
  queryType: QueryType;
  inputId: string;
  loading: boolean;
  connecting: boolean;
  connection: ConnectionStatus;
  matchResult: unknown;
  tournamentResult: TournamentResult | null;
  // Raw mode
  rawFile: string;
  rawParams: RawParam[];
  rawResult: unknown;
  error: string | null;
}

// ─── Standings calculation ─────────────────────────────────────────────────────

/**
 * Derives a standings table from raw `tournamentfixtures` CHPP data.
 *
 * The CHPP XML is parsed into a JS object; property names may be camelCase
 * or PascalCase depending on the XML-to-JSON parser. We handle both.
 *
 * Expected shape (simplified):
 * {
 *   TournamentFixtures: {
 *     Rounds: {
 *       Round: Round | Round[]   // single round or array
 *     }
 *   }
 * }
 *
 * Where each Round has: Round.Matches.Match: Match | Match[]
 * And each Match has: HomeTeamID, AwayTeamID, HomeGoals, AwayGoals, Status
 */
function calcStandings(fixturesData: unknown): StandingsRow[] {
  const map = new Map<number, StandingsRow>();

  function ensureTeam(id: number, name: string) {
    if (!map.has(id)) {
      map.set(id, {
        teamId: id,
        teamName: name,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
      });
    }
    return map.get(id)!;
  }

  function getNum(obj: Record<string, unknown>, ...keys: string[]): number {
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null) return Number(v);
    }
    return NaN;
  }

  function getString(obj: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'string') return v;
    }
    return '';
  }

  // Drill into the CHPP response — tolerates both PascalCase and camelCase
  const root = fixturesData as Record<string, unknown>;
  const tf =
    (root['TournamentFixtures'] ?? root['tournamentFixtures'] ?? root) as Record<string, unknown>;
  const roundsWrapper =
    (tf['Rounds'] ?? tf['rounds']) as Record<string, unknown> | undefined;
  if (!roundsWrapper) return [];

  const rawRounds = roundsWrapper['Round'] ?? roundsWrapper['round'];
  const rounds: Record<string, unknown>[] = Array.isArray(rawRounds)
    ? rawRounds
    : rawRounds
    ? [rawRounds as Record<string, unknown>]
    : [];

  for (const round of rounds) {
    const matchesWrapper = (round['Matches'] ?? round['matches']) as
      | Record<string, unknown>
      | undefined;
    if (!matchesWrapper) continue;

    const rawMatches = matchesWrapper['Match'] ?? matchesWrapper['match'];
    const matches: Record<string, unknown>[] = Array.isArray(rawMatches)
      ? rawMatches
      : rawMatches
      ? [rawMatches as Record<string, unknown>]
      : [];

    for (const m of matches) {
      const status = getString(m, 'Status', 'status').toLowerCase();
      // Only count finished matches
      if (status !== 'finished' && status !== 'finalizado') continue;

      const homeId = getNum(m, 'HomeTeamID', 'homeTeamID', 'homeTeamId');
      const awayId = getNum(m, 'AwayTeamID', 'awayTeamID', 'awayTeamId');
      const homeGoals = getNum(m, 'HomeGoals', 'homeGoals');
      const awayGoals = getNum(m, 'AwayGoals', 'awayGoals');

      if (isNaN(homeId) || isNaN(awayId) || isNaN(homeGoals) || isNaN(awayGoals)) continue;

      const homeName = getString(m, 'HomeTeamName', 'homeTeamName') || `Team ${homeId}`;
      const awayName = getString(m, 'AwayTeamName', 'awayTeamName') || `Team ${awayId}`;

      const home = ensureTeam(homeId, homeName);
      const away = ensureTeam(awayId, awayName);

      home.played++;
      away.played++;
      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;

      if (homeGoals > awayGoals) {
        home.won++; home.points += 3;
        away.lost++;
      } else if (homeGoals < awayGoals) {
        away.won++; away.points += 3;
        home.lost++;
      } else {
        home.drawn++; home.points++;
        away.drawn++; away.points++;
      }
    }
  }

  // Recompute goal diff and sort: points desc → GD desc → GF desc → name asc
  const rows = [...map.values()].map((r) => ({ ...r, goalDiff: r.goalsFor - r.goalsAgainst }));
  rows.sort((a, b) =>
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.teamName.localeCompare(b.teamName),
  );

  return rows;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export function createChppExplorerCtrl() {
  const toast = useToast();

  const [state, setState] = createStore<ChppExplorerState>({
    queryType: 'match',
    inputId: '',
    loading: false,
    connecting: false,
    connection: { checked: false, connected: false, teamName: null, htLoginName: null },
    matchResult: null,
    tournamentResult: null,
    rawFile: 'tournamentmatchdetails',
    rawParams: [{ key: 'matchID', value: '' }],
    rawResult: null,
    error: null,
  });

  // Check connection status on mount
  onMount(async () => {
    try {
      const result = await chppApi.verify();
      setState('connection', {
        checked: true,
        connected: true,
        teamName: result.teamName,
        htLoginName: result.htLoginName,
      });
    } catch {
      setState('connection', { checked: true, connected: false, teamName: null, htLoginName: null });
    }
  });

  async function handleConnect() {
    setState({ connecting: true });
    try {
      const { authorizeUrl } = await chppApi.connect();
      window.location.href = authorizeUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar conexión';
      toast.error(message);
      setState({ connecting: false });
    }
  }

  function setQueryType(type: QueryType) {
    setState({ queryType: type, matchResult: null, tournamentResult: null, rawResult: null, error: null, inputId: '' });
  }

  // ─── Raw mode param helpers ──────────────────────────────────────────────

  function addRawParam() {
    setState('rawParams', (prev) => [...prev, { key: '', value: '' }]);
  }

  function removeRawParam(index: number) {
    setState('rawParams', (prev) => prev.filter((_, i) => i !== index));
  }

  function setRawParamKey(index: number, key: string) {
    setState('rawParams', index, 'key', key);
  }

  function setRawParamValue(index: number, value: string) {
    setState('rawParams', index, 'value', value);
  }

  // ─── Fetch handlers ─────────────────────────────────────────────────────

  async function handleFetch(e: Event) {
    e.preventDefault();

    const id = state.inputId.trim();
    if (!id) {
      setState({ error: 'Introduce un ID válido.' });
      return;
    }

    setState({ loading: true, matchResult: null, tournamentResult: null, rawResult: null, error: null });

    try {
      if (state.queryType === 'match') {
        const response = await chppApi.getMatch(id);
        setState({ matchResult: response.data, loading: false });
      } else {
        const [detailsRes, fixturesRes, tableRes] = await Promise.all([
          chppApi.getTournament(id),
          chppApi.getTournamentFixtures(id),
          chppApi.getTournamentLeagueTable(id),
        ]);
        const standings = calcStandings(fixturesRes.data);
        setState({
          tournamentResult: {
            details: detailsRes.data,
            fixtures: fixturesRes.data,
            table: tableRes.data,
            standings,
          },
          loading: false,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setState({ error: message, loading: false });
      toast.error(message);
    }
  }

  async function handleRawFetch(e: Event) {
    e.preventDefault();

    const file = state.rawFile.trim();
    if (!file) {
      setState({ error: 'El campo "file" es obligatorio.' });
      return;
    }

    // Build params object — skip empty keys, coerce numeric strings to numbers
    const params: Record<string, string | number | boolean> = {};
    for (const { key, value } of state.rawParams) {
      const k = key.trim();
      if (!k) continue;
      const v = value.trim();
      const n = Number(v);
      params[k] = v !== '' && !isNaN(n) ? n : v;
    }

    setState({ loading: true, rawResult: null, error: null });

    try {
      const response = await chppApi.fetchRaw(file, params);
      setState({ rawResult: response.data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setState({ error: message, loading: false });
      toast.error(message);
    }
  }

  return {
    state,
    setState,
    setQueryType,
    handleFetch,
    handleRawFetch,
    addRawParam,
    removeRawParam,
    setRawParamKey,
    setRawParamValue,
    handleConnect,
  };
}
