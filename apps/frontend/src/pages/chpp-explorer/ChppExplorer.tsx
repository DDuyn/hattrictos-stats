import { For, Show } from 'solid-js';
import { createChppExplorerCtrl, type StandingsRow } from './chpp-explorer.ctrl';

function JsonBlock(props: { title: string; subtitle?: string; data: unknown }) {
  return (
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <span class="text-sm font-medium text-gray-700">
          {props.title}
          <Show when={props.subtitle}>
            <span class="font-normal text-gray-400"> · {props.subtitle}</span>
          </Show>
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(JSON.stringify(props.data, null, 2))}
          class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Copiar JSON
        </button>
      </div>
      <pre class="p-4 text-xs text-gray-700 overflow-auto max-h-96 leading-relaxed">
        {JSON.stringify(props.data, null, 2)}
      </pre>
    </div>
  );
}

function StandingsTable(props: { rows: StandingsRow[]; tournamentId: string }) {
  return (
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <span class="text-sm font-medium text-gray-700">
          Clasificación calculada
          <span class="font-normal text-gray-400"> · calculada de tournamentfixtures · ID {props.tournamentId}</span>
        </span>
      </div>
      <Show
        when={props.rows.length > 0}
        fallback={
          <p class="px-4 py-6 text-sm text-gray-400 text-center">
            No hay partidos finalizados todavía.
          </p>
        }
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th class="px-4 py-2 text-left w-6">#</th>
                <th class="px-4 py-2 text-left">Equipo</th>
                <th class="px-3 py-2 text-center">PJ</th>
                <th class="px-3 py-2 text-center">PG</th>
                <th class="px-3 py-2 text-center">PE</th>
                <th class="px-3 py-2 text-center">PP</th>
                <th class="px-3 py-2 text-center">GF</th>
                <th class="px-3 py-2 text-center">GC</th>
                <th class="px-3 py-2 text-center">DG</th>
                <th class="px-3 py-2 text-center font-semibold text-gray-700">Pts</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.rows}>
                {(row, i) => (
                  <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-2.5 text-gray-400 text-xs">{i() + 1}</td>
                    <td class="px-4 py-2.5 font-medium text-gray-900">{row.teamName}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.played}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.won}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.drawn}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.lost}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.goalsFor}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.goalsAgainst}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">
                      {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                    </td>
                    <td class="px-3 py-2.5 text-center font-bold text-gray-900">{row.points}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}

export default function ChppExplorer() {
  const ctrl = createChppExplorerCtrl();

  return (
    <>
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">CHPP Explorer</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Consulta datos en crudo de la API de Hattrick por ID
        </p>
      </div>

      {/* Connection status banner */}
      <Show when={ctrl.state.connection.checked}>
        <Show
          when={ctrl.state.connection.connected}
          fallback={
            <div class="flex items-center justify-between bg-danger-light border border-danger/20 rounded-lg px-4 py-3 mb-6">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-danger shrink-0" />
                <span class="text-sm text-danger font-medium">Sin conexión con Hattrick</span>
                <span class="text-sm text-danger/70">— el token ha caducado o fue revocado</span>
              </div>
              <button
                type="button"
                onClick={ctrl.handleConnect}
                disabled={ctrl.state.connecting}
                class="px-3 py-1.5 bg-danger text-white text-xs font-medium rounded-md hover:bg-danger-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ctrl.state.connecting ? 'Redirigiendo...' : 'Reconectar con Hattrick'}
              </button>
            </div>
          }
        >
          <div class="flex items-center justify-between bg-success-light border border-success/20 rounded-lg px-4 py-3 mb-6">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-success shrink-0" />
              <span class="text-sm text-success font-medium">Conectado</span>
              <Show when={ctrl.state.connection.teamName}>
                <span class="text-sm text-success/70">
                  — {ctrl.state.connection.teamName}
                  <Show when={ctrl.state.connection.htLoginName}>
                    {' '}({ctrl.state.connection.htLoginName})
                  </Show>
                </span>
              </Show>
            </div>
            <button
              type="button"
              onClick={ctrl.handleConnect}
              disabled={ctrl.state.connecting}
              class="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
            >
              {ctrl.state.connecting ? 'Redirigiendo...' : 'Reconectar'}
            </button>
          </div>
        </Show>
      </Show>

      {/* Query form */}
      <div class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <form onSubmit={ctrl.handleFetch} class="flex flex-col gap-4">
          <div class="flex gap-2">
            <button
              type="button"
              onClick={() => ctrl.setQueryType('match')}
              class={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                ctrl.state.queryType === 'match'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              Partido
            </button>
            <button
              type="button"
              onClick={() => ctrl.setQueryType('tournament')}
              class={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                ctrl.state.queryType === 'tournament'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              Torneo
            </button>
          </div>

          <Show when={ctrl.state.queryType === 'tournament'}>
            <p class="text-xs text-gray-400 -mt-1">
              Carga en paralelo: detalles + clasificación (API) + calendario. Clasificación local calculada a partir de fixtures.
            </p>
          </Show>

          <div class="flex gap-3">
            <input
              type="text"
              inputmode="numeric"
              value={ctrl.state.inputId}
              onInput={(e) => ctrl.setState('inputId', e.currentTarget.value)}
              placeholder={
                ctrl.state.queryType === 'match'
                  ? 'Match ID (ej: 123456789)'
                  : 'Tournament ID (ej: 98765)'
              }
              class={`flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                ctrl.state.error ? 'border-danger text-danger' : 'border-gray-300'
              }`}
            />
            <button
              type="submit"
              disabled={ctrl.state.loading || !ctrl.state.connection.connected}
              class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {ctrl.state.loading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>

          <Show when={ctrl.state.error}>
            <p class="text-sm text-danger">{ctrl.state.error}</p>
          </Show>
        </form>
      </div>

      {/* Match result */}
      <Show when={ctrl.state.matchResult !== null}>
        <JsonBlock
          title="matchdetails"
          subtitle={`ID ${ctrl.state.inputId}`}
          data={ctrl.state.matchResult}
        />
      </Show>

      {/* Tournament results */}
      <Show when={ctrl.state.tournamentResult !== null}>
        <div class="flex flex-col gap-4">
          <JsonBlock
            title="Detalles del torneo"
            subtitle={`tournamentdetails · ID ${ctrl.state.inputId}`}
            data={ctrl.state.tournamentResult!.details}
          />
          <JsonBlock
            title="Clasificación (API)"
            subtitle={`tournamentleaguetables · ID ${ctrl.state.inputId}`}
            data={ctrl.state.tournamentResult!.table}
          />
          <StandingsTable
            rows={ctrl.state.tournamentResult!.standings}
            tournamentId={ctrl.state.inputId}
          />
          <JsonBlock
            title="Calendario"
            subtitle={`tournamentfixtures · ID ${ctrl.state.inputId}`}
            data={ctrl.state.tournamentResult!.fixtures}
          />
        </div>
      </Show>
    </>
  );
}
