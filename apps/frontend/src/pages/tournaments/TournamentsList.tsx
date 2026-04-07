import { For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { createTournamentsListCtrl } from './tournaments.ctrl';

export default function TournamentsList() {
  const ctrl = createTournamentsListCtrl();

  return (
    <>
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Torneos</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Ligas y torneos de Hattrick Arena registrados en la comunidad
        </p>
      </div>

      <Show
        when={!ctrl.state.loading}
        fallback={
          <div class="bg-white border border-gray-200 rounded-lg px-4 py-16 text-center text-sm text-gray-400">
            Cargando torneos...
          </div>
        }
      >
        <Show when={ctrl.state.error}>
          <div class="bg-danger-light border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger mb-4">
            {ctrl.state.error}
          </div>
        </Show>

        <Show
          when={ctrl.state.tournaments.length > 0}
          fallback={
            <div class="bg-white border border-gray-200 rounded-lg px-4 py-16 text-center text-sm text-gray-400">
              No hay torneos registrados todavía.
            </div>
          }
        >
          <div class="flex flex-col gap-3">
            <For each={ctrl.state.tournaments}>
              {(t) => (
                <A
                  href={`/torneos/${t.id}`}
                  class="bg-white border border-gray-200 rounded-lg px-5 py-4 flex items-center justify-between hover:border-primary hover:shadow-sm transition-all group"
                >
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-900 group-hover:text-primary transition-colors">
                        {t.name}
                      </span>
                      <Show when={t.season !== null}>
                        <span class="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                          T{t.season}
                        </span>
                      </Show>
                      <Show when={t.tournamentType === 1}>
                        <span class="text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                          Copa
                        </span>
                      </Show>
                    </div>
                    <div class="text-xs text-gray-400 mt-0.5">
                      <Show when={t.numberOfTeams !== null}>
                        {t.numberOfTeams} equipos ·{' '}
                      </Show>
                      ID: {t.htTournamentId}
                    </div>
                  </div>
                  <svg
                    class="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </>
  );
}
