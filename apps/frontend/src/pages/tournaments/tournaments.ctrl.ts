import { createStore } from 'solid-js/store';
import { createSignal, onMount } from 'solid-js';
import { useParams } from '@solidjs/router';
import { tournamentsApi, type Tournament, type TournamentDetail, type TournamentStanding, type TournamentMatch, type TopScorer } from '../../domain/tournaments/tournaments.api';

// ─── Tournaments list ctrl ────────────────────────────────────────────────────

interface TournamentsListState {
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
}

export function createTournamentsListCtrl() {
  const [state, setState] = createStore<TournamentsListState>({
    tournaments: [],
    loading: true,
    error: null,
  });

  onMount(async () => {
    try {
      const list = await tournamentsApi.list();
      setState({ tournaments: list, loading: false });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Error al cargar' });
    }
  });

  return { state };
}

// ─── Tournament detail ctrl ───────────────────────────────────────────────────

interface TournamentDetailState {
  detail: TournamentDetail | null;
  loading: boolean;
  error: string | null;
}

export function createTournamentDetailCtrl() {
  const params = useParams<{ id: string }>();
  const [state, setState] = createStore<TournamentDetailState>({
    detail: null,
    loading: true,
    error: null,
  });
  const [activeRound, setActiveRound] = createSignal<number | null>(null);

  onMount(async () => {
    try {
      const detail = await tournamentsApi.get(params.id);
      setState({ detail, loading: false });
      // Auto-select the last played round (or first round if none played yet)
      const lastPlayed = getLastPlayedRound(detail.matches);
      setActiveRound(lastPlayed ?? detail.matches[0]?.round ?? null);
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Error al cargar' });
    }
  });

  return { state, activeRound, setActiveRound };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Groups standings by groupId */
export function groupStandings(standings: TournamentStanding[]): Map<number, TournamentStanding[]> {
  const map = new Map<number, TournamentStanding[]>();
  for (const row of standings) {
    const group = map.get(row.groupId) ?? [];
    group.push(row);
    map.set(row.groupId, group);
  }
  return map;
}

/** Groups matches by round */
export function groupMatchesByRound(matches: TournamentMatch[]): Map<number, TournamentMatch[]> {
  const map = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const round = map.get(m.round) ?? [];
    round.push(m);
    map.set(m.round, round);
  }
  return map;
}

export function formatMatchDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Returns the highest round number that has at least one Finished match.
 * Returns null if no matches have been played yet.
 */
export function getLastPlayedRound(matches: TournamentMatch[]): number | null {
  let last: number | null = null;
  for (const m of matches) {
    if (m.status.toLowerCase() === 'finished') {
      if (last === null || m.round > last) last = m.round;
    }
  }
  return last;
}

export type { TopScorer };

export function getNextRound(matches: TournamentMatch[]): number | null {
  const rounds = groupMatchesByRound(matches);
  for (const [round, ms] of [...rounds.entries()].sort(([a], [b]) => a - b)) {
    const allFinished = ms.every((m) => m.status.toLowerCase() === 'finished');
    if (!allFinished) return round;
  }
  return null;
}
