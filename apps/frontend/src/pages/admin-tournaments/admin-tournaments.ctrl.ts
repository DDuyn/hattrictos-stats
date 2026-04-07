import { createStore } from 'solid-js/store';
import { onMount } from 'solid-js';
import { tournamentsApi, type Tournament } from '../../domain/tournaments/tournaments.api';
import { useToast } from '../../context/toast.context';

interface AdminTournamentsState {
  tournaments: Tournament[];
  loadingList: boolean;
  // Register form
  htTournamentIdInput: string;
  registering: boolean;
  registerError: string | null;
  // Per-tournament sync state: tournamentId → loading bool
  syncingIds: Record<string, boolean>;
  // Per-tournament config inputs: tournamentId → { promotionSlots, relegationSlots }
  configInputs: Record<string, { promotionSlots: string; relegationSlots: string }>;
  // Per-tournament config save loading
  savingConfigIds: Record<string, boolean>;
}

export function createAdminTournamentsCtrl() {
  const toast = useToast();

  const [state, setState] = createStore<AdminTournamentsState>({
    tournaments: [],
    loadingList: true,
    htTournamentIdInput: '',
    registering: false,
    registerError: null,
    syncingIds: {},
    configInputs: {},
    savingConfigIds: {},
  });

  onMount(async () => {
    await loadTournaments();
  });

  async function loadTournaments() {
    setState({ loadingList: true });
    try {
      const list = await tournamentsApi.list();
      const inputs: Record<string, { promotionSlots: string; relegationSlots: string }> = {};
      for (const t of list) {
        inputs[t.id] = {
          promotionSlots: String(t.promotionSlots),
          relegationSlots: String(t.relegationSlots),
        };
      }
      setState({ tournaments: list, loadingList: false, configInputs: inputs });
    } catch (err) {
      setState({ loadingList: false });
      toast.error(err instanceof Error ? err.message : 'Error al cargar torneos');
    }
  }

  async function handleRegister(e: Event) {
    e.preventDefault();
    const raw = state.htTournamentIdInput.trim();
    const htId = Number(raw);

    if (!raw || isNaN(htId) || !Number.isInteger(htId) || htId <= 0) {
      setState({ registerError: 'Introduce un Tournament ID válido (número positivo).' });
      return;
    }

    setState({ registering: true, registerError: null });
    try {
      const created = await tournamentsApi.register(htId);
      toast.success(`Torneo "${created.name}" registrado correctamente`);
      setState({
        registering: false,
        htTournamentIdInput: '',
      });
      await loadTournaments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar torneo';
      setState({ registering: false, registerError: message });
      toast.error(message);
    }
  }

  async function handleSync(id: string) {
    setState('syncingIds', id, true);
    try {
      await tournamentsApi.sync(id);
      toast.success('Torneo sincronizado correctamente');
      await loadTournaments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setState('syncingIds', id, false);
    }
  }

  async function handleSaveConfig(id: string) {
    const inputs = state.configInputs[id];
    if (!inputs) return;

    const promotionSlots = parseInt(inputs.promotionSlots, 10);
    const relegationSlots = parseInt(inputs.relegationSlots, 10);

    if (isNaN(promotionSlots) || promotionSlots < 0 || isNaN(relegationSlots) || relegationSlots < 0) {
      toast.error('Los valores de ascensos y descensos deben ser números >= 0');
      return;
    }

    setState('savingConfigIds', id, true);
    try {
      await tournamentsApi.updateConfig(id, { promotionSlots, relegationSlots });
      toast.success('Configuración guardada');
      await loadTournaments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar configuración');
    } finally {
      setState('savingConfigIds', id, false);
    }
  }

  return { state, setState, handleRegister, handleSync, handleSaveConfig };
}
