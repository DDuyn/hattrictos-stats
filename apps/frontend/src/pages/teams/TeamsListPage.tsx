import { For, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { createTeamsListCtrl } from './teams.ctrl';

export default function TeamsListPage() {
  const ctrl = createTeamsListCtrl();
  const navigate = useNavigate();

  return (
    <>
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Equipos</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Todos los equipos que han participado en competiciones de la comunidad
        </p>
      </div>

      <Show
        when={!ctrl.state.loading}
        fallback={
          <div class="bg-white border border-gray-200 rounded-lg px-4 py-16 text-center text-sm text-gray-400">
            Cargando equipos...
          </div>
        }
      >
        <Show when={ctrl.state.error}>
          <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
            {ctrl.state.error}
          </div>
        </Show>

        {/* Search input */}
        <div class="mb-4">
          <input
            type="text"
            placeholder="Buscar equipo..."
            value={ctrl.search()}
            onInput={(e) => ctrl.setSearch(e.currentTarget.value)}
            class="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <Show
          when={ctrl.filteredTeams().length > 0}
          fallback={
            <div class="bg-white border border-gray-200 rounded-lg px-4 py-16 text-center text-sm text-gray-400">
              {ctrl.state.teams.length === 0 ? 'No hay equipos registrados todavía.' : 'No hay resultados para tu búsqueda.'}
            </div>
          }
        >
          <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100 bg-gray-50">
                  <th class="text-left px-4 py-2.5 font-medium text-gray-600">Equipo</th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-600">Competiciones</th>
                  <th class="w-8"></th>
                </tr>
              </thead>
              <tbody>
                <For each={ctrl.filteredTeams()}>
                  {(team) => (
                    <tr
                      class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/equipos/${team.htTeamId}`)}
                    >
                      <td class="px-4 py-3">
                        <span class="font-medium text-gray-900 group-hover:text-primary transition-colors">
                          {team.name}
                        </span>
                        <Show when={team.shortName && team.shortName !== team.name}>
                          <span class="text-xs text-gray-400 ml-1.5">({team.shortName})</span>
                        </Show>
                      </td>
                      <td class="px-4 py-3">
                        <Show
                          when={team.tournaments.length > 0}
                          fallback={<span class="text-xs text-gray-400">—</span>}
                        >
                          <div class="flex flex-wrap gap-1">
                            <For each={team.tournaments}>
                              {(t) => (
                                <A
                                  href={`/torneos/${t.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  class="text-xs bg-gray-100 hover:bg-primary/10 hover:text-primary text-gray-600 rounded px-1.5 py-0.5 transition-colors"
                                >
                                  {t.name}
                                  <Show when={t.season !== null}>
                                    {' '}T{t.season}
                                  </Show>
                                </A>
                              )}
                            </For>
                          </div>
                        </Show>
                      </td>
                      <td class="px-3 py-3 text-gray-300 group-hover:text-primary transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          <p class="text-xs text-gray-400 mt-2 text-right">
            {ctrl.filteredTeams().length} equipo{ctrl.filteredTeams().length !== 1 ? 's' : ''}
          </p>
        </Show>
      </Show>
    </>
  );
}
