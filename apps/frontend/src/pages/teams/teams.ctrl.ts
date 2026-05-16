import { createStore } from 'solid-js/store';
import { createSignal, onMount } from 'solid-js';
import { useParams } from '@solidjs/router';
import {
  teamsApi,
  type TeamWithTournaments,
  type TeamDetail,
} from '../../domain/teams/teams.api';

// ─── Teams list ctrl ──────────────────────────────────────────────────────────

interface TeamsListState {
  teams: TeamWithTournaments[];
  loading: boolean;
  error: string | null;
}

export function createTeamsListCtrl() {
  const [state, setState] = createStore<TeamsListState>({
    teams: [],
    loading: true,
    error: null,
  });

  const [search, setSearch] = createSignal('');

  onMount(async () => {
    try {
      const list = await teamsApi.list();
      setState({ teams: list, loading: false });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Error al cargar' });
    }
  });

  const filteredTeams = () => {
    const q = search().toLowerCase().trim();
    if (!q) return state.teams;
    return state.teams.filter((t) => t.name.toLowerCase().includes(q));
  };

  return { state, search, setSearch, filteredTeams };
}

// ─── Team detail ctrl ─────────────────────────────────────────────────────────

interface TeamDetailState {
  detail: TeamDetail | null;
  loading: boolean;
  error: string | null;
}

export function createTeamDetailCtrl() {
  const params = useParams<{ htTeamId: string }>();
  const [state, setState] = createStore<TeamDetailState>({
    detail: null,
    loading: true,
    error: null,
  });

  onMount(async () => {
    const htTeamId = Number(params.htTeamId);
    if (!htTeamId || htTeamId <= 0) {
      setState({ loading: false, error: 'ID de equipo inválido' });
      return;
    }
    try {
      const detail = await teamsApi.get(htTeamId);
      setState({ detail, loading: false });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Error al cargar' });
    }
  });

  return { state };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatMatchDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
