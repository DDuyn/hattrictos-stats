import { For, Show } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { createStore } from 'solid-js/store';
import { onMount } from 'solid-js';
import { tournamentsApi, type TournamentDetail, type TopMinutes, type TopCard } from '../../domain/tournaments/tournaments.api';

// ─── Ctrl ─────────────────────────────────────────────────────────────────────

function createTournamentStatsCtrl() {
  const params = useParams<{ id: string }>();
  const [state, setState] = createStore<{
    detail: TournamentDetail | null;
    loading: boolean;
    error: string | null;
  }>({ detail: null, loading: true, error: null });

  onMount(async () => {
    try {
      const detail = await tournamentsApi.get(params.id);
      setState({ detail, loading: false });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Error al cargar' });
    }
  });

  return { state };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentStats() {
  const ctrl = createTournamentStatsCtrl();

  return (
    <Show
      when={!ctrl.state.loading}
      fallback={<div class="py-16 text-center text-sm text-gray-400">Cargando estadísticas...</div>}
    >
      <Show when={ctrl.state.error}>
        <div class="bg-danger-light border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger">
          {ctrl.state.error}
        </div>
      </Show>

      <Show when={ctrl.state.detail}>
        {(_) => {
          const detail = ctrl.state.detail!;
          const t = detail.tournament;
          const scorers = detail.topScorers ?? [];
          const topMinutes = detail.topMinutes ?? [];
          const topCards = detail.topCards ?? [];

          return (
            <>
              {/* Breadcrumb + header */}
              <div class="mb-8">
                <div class="flex items-center gap-2 mb-1">
                  <A href="/torneos" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    Torneos
                  </A>
                  <span class="text-gray-300">/</span>
                  <A href={`/torneos/${t.id}`} class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    {t.name}
                  </A>
                  <span class="text-gray-300">/</span>
                  <span class="text-sm text-gray-600">Estadísticas</span>
                </div>
                <div class="flex items-center gap-3">
                  <h1 class="text-2xl font-semibold text-gray-900">Estadísticas</h1>
                  <Show when={t.season !== null}>
                    <span class="text-sm text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                      Temporada {t.season}
                    </span>
                  </Show>
                </div>
                <p class="text-sm text-gray-500 mt-0.5">{t.name}</p>
              </div>

              <div class="flex flex-col gap-10">

                {/* Top scorers */}
                <section>
                  <h2 class="text-base font-semibold text-gray-900 mb-3">Goleadores</h2>
                  <Show
                    when={scorers.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-400">
                        Aún no hay goles registrados. Sincroniza el torneo para obtener estadísticas.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                            <th class="px-4 py-2.5 text-left w-8">#</th>
                            <th class="px-4 py-2.5 text-left">Jugador</th>
                            <th class="px-4 py-2.5 text-left hidden sm:table-cell">Equipo</th>
                            <th class="px-4 py-2.5 text-right font-semibold text-gray-600">Goles</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={scorers}>
                            {(scorer, i) => (
                              <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-2.5 text-gray-400 text-xs font-mono">{i() + 1}</td>
                                <td class="px-4 py-2.5 font-medium text-gray-900">{scorer.playerName}</td>
                                <td class="px-4 py-2.5 text-gray-500 text-sm hidden sm:table-cell">{scorer.teamName}</td>
                                <td class="px-4 py-2.5 text-right font-bold text-gray-900">{scorer.goals}</td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                </section>

                {/* Top minutes played */}
                <section>
                  <h2 class="text-base font-semibold text-gray-900 mb-3">Minutos jugados</h2>
                  <Show
                    when={topMinutes.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-400">
                        No hay datos de minutos. Sincroniza el torneo para obtener estadísticas.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                            <th class="px-4 py-2.5 text-left w-8">#</th>
                            <th class="px-4 py-2.5 text-left">Jugador</th>
                            <th class="px-4 py-2.5 text-left hidden sm:table-cell">Equipo</th>
                            <th class="px-4 py-2.5 text-center hidden md:table-cell">PJ</th>
                            <th class="px-4 py-2.5 text-right font-semibold text-gray-600">Min</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={topMinutes}>
                            {(row: TopMinutes, i) => (
                              <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-2.5 text-gray-400 text-xs font-mono">{i() + 1}</td>
                                <td class="px-4 py-2.5 font-medium text-gray-900">{row.playerName}</td>
                                <td class="px-4 py-2.5 text-gray-500 text-sm hidden sm:table-cell">{row.teamName}</td>
                                <td class="px-4 py-2.5 text-center text-gray-500 hidden md:table-cell">{row.appearances}</td>
                                <td class="px-4 py-2.5 text-right font-bold text-gray-900">{row.minutes}'</td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                </section>

                {/* Tarjetas */}
                <section>
                  <h2 class="text-base font-semibold text-gray-900 mb-3">Tarjetas</h2>
                  <Show
                    when={topCards.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-400">
                        No hay tarjetas registradas.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                            <th class="px-4 py-2.5 text-left w-8">#</th>
                            <th class="px-4 py-2.5 text-left">Jugador</th>
                            <th class="px-4 py-2.5 text-left hidden sm:table-cell">Equipo</th>
                            <th class="px-4 py-2.5 text-center" title="Amarillas">Amar.</th>
                            <th class="px-4 py-2.5 text-center" title="Rojas">Rojas</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={topCards}>
                            {(row: TopCard, i) => (
                              <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-2.5 text-gray-400 text-xs font-mono">{i() + 1}</td>
                                <td class="px-4 py-2.5 font-medium text-gray-900">{row.playerName}</td>
                                <td class="px-4 py-2.5 text-gray-500 text-sm hidden sm:table-cell">{row.teamName}</td>
                                <td class="px-4 py-2.5 text-center font-bold text-gray-900">{row.yellowCards || '-'}</td>
                                <td class="px-4 py-2.5 text-center font-bold text-gray-900">{(row.redCards + row.yellowRedCards) || '-'}</td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                </section>

              </div>
            </>
          );
        }}
      </Show>
    </Show>
  );
}
