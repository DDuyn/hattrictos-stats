import { For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { createAdminTournamentsCtrl } from './admin-tournaments.ctrl';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function AdminTournaments() {
  const ctrl = createAdminTournamentsCtrl();

  return (
    <>
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Gestión de Torneos</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Registra torneos de Hattrick Arena por su ID para sincronizar su clasificación y calendario.
        </p>
      </div>

      {/* Register form */}
      <div class="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h2 class="text-base font-medium text-gray-900 mb-4">Añadir torneo</h2>
        <form onSubmit={ctrl.handleRegister} class="flex flex-col gap-3">
          <div class="flex gap-3">
            <div class="flex-1">
              <input
                type="text"
                inputmode="numeric"
                value={ctrl.state.htTournamentIdInput}
                onInput={(e) => ctrl.setState('htTournamentIdInput', e.currentTarget.value)}
                placeholder="Tournament ID de Hattrick (ej: 98765)"
                class={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  ctrl.state.registerError ? 'border-danger' : 'border-gray-300'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={ctrl.state.registering}
              class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {ctrl.state.registering ? 'Registrando...' : 'Añadir torneo'}
            </button>
          </div>
          <Show when={ctrl.state.registerError}>
            <p class="text-sm text-danger">{ctrl.state.registerError}</p>
          </Show>
          <p class="text-xs text-gray-400">
            El ID lo encuentras en la URL del torneo en Hattrick Arena.
            Al añadirlo se sincronizará automáticamente la clasificación y el calendario.
          </p>
        </form>
      </div>

      {/* Tournament list */}
      <div>
        <h2 class="text-base font-medium text-gray-900 mb-4">Torneos registrados</h2>

        <Show
          when={!ctrl.state.loadingList}
          fallback={
            <div class="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-400">
              Cargando...
            </div>
          }
        >
          <Show
            when={ctrl.state.tournaments.length > 0}
            fallback={
              <div class="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center text-sm text-gray-400">
                No hay torneos registrados todavía. Añade el primero usando el formulario.
              </div>
            }
          >
            <div class="flex flex-col gap-3">
              <For each={ctrl.state.tournaments}>
                {(t) => (
                  <div class="bg-white border border-gray-200 rounded-lg px-4 py-4 flex flex-col gap-3">
                    {/* Row 1: name + action buttons */}
                    <div class="flex items-center justify-between gap-4">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-gray-900 truncate">{t.name}</span>
                          <Show when={t.season !== null}>
                            <span class="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">
                              T{t.season}
                            </span>
                          </Show>
                        </div>
                        <div class="text-xs text-gray-400 mt-0.5 flex gap-3">
                          <span>HT ID: {t.htTournamentId}</span>
                          <Show when={t.numberOfTeams !== null}>
                            <span>{t.numberOfTeams} equipos</span>
                          </Show>
                          <span>
                            Última sync: {formatDate(t.lastSyncedAt)}
                          </span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <A
                          href={`/torneos/${t.id}`}
                          class="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Ver público
                        </A>
                        <button
                          type="button"
                          disabled={!!ctrl.state.syncingIds[t.id]}
                          onClick={() => ctrl.handleSync(t.id)}
                          class="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {ctrl.state.syncingIds[t.id] ? 'Sincronizando...' : 'Sincronizar'}
                        </button>
                      </div>
                    </div>

                    {/* Row 2: promotion/relegation config */}
                    <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <span class="text-xs text-gray-500 shrink-0">Configuración:</span>
                      <label class="flex items-center gap-1.5 text-xs text-gray-600">
                        <span class="text-emerald-600 font-medium">↑ Ascensos</span>
                        <input
                          type="number"
                          min="0"
                          value={ctrl.state.configInputs[t.id]?.promotionSlots ?? String(t.promotionSlots)}
                          onInput={(e) =>
                            ctrl.setState('configInputs', t.id, 'promotionSlots', e.currentTarget.value)
                          }
                          class="w-14 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-gray-400"
                        />
                      </label>
                      <label class="flex items-center gap-1.5 text-xs text-gray-600">
                        <span class="text-red-500 font-medium">↓ Descensos</span>
                        <input
                          type="number"
                          min="0"
                          value={ctrl.state.configInputs[t.id]?.relegationSlots ?? String(t.relegationSlots)}
                          onInput={(e) =>
                            ctrl.setState('configInputs', t.id, 'relegationSlots', e.currentTarget.value)
                          }
                          class="w-14 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-gray-400"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!!ctrl.state.savingConfigIds[t.id]}
                        onClick={() => ctrl.handleSaveConfig(t.id)}
                        class="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {ctrl.state.savingConfigIds[t.id] ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </>
  );
}
