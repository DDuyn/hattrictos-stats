import { createStore } from 'solid-js/store';
import { onMount } from 'solid-js';
import { useParams } from '@solidjs/router';
import { playersApi, type PlayerDetail } from '../../domain/players/players.api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerDetailState {
  loading: boolean;
  error: string | null;
  data: PlayerDetail | null;
  activeTab: 'partidos' | 'equipos' | 'competiciones';
}

// ─── Controller ───────────────────────────────────────────────────────────────

export function createPlayerDetailCtrl() {
  const params = useParams<{ htPlayerId: string }>();

  const [state, setState] = createStore<PlayerDetailState>({
    loading: true,
    error: null,
    data: null,
    activeTab: 'partidos',
  });

  onMount(async () => {
    const htPlayerId = Number(params.htPlayerId);
    if (!Number.isInteger(htPlayerId) || htPlayerId <= 0) {
      setState({ loading: false, error: 'ID de jugador inválido.' });
      return;
    }

    try {
      const data = await playersApi.get(htPlayerId);
      setState({ loading: false, data });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : 'Error desconocido.' });
    }
  });

  function setTab(tab: PlayerDetailState['activeTab']) {
    setState('activeTab', tab);
  }

  return { state, setTab };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatMatchDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function playerFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}
