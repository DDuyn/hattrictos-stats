import { For, Show, createMemo } from 'solid-js';
import { A } from '@solidjs/router';
import {
  createTournamentDetailCtrl,
  groupStandings,
  groupMatchesByRound,
  getLastPlayedRound,
  getNextRound,
  formatMatchDate,
} from './tournaments.ctrl';
import type { TournamentStanding, TournamentMatch } from '../../domain/tournaments/tournaments.api';

// ─── Standings table ──────────────────────────────────────────────────────────

function StandingsGroup(props: {
  groupId: number;
  rows: TournamentStanding[];
  multiGroup: boolean;
  promotionSlots: number;
  relegationSlots: number;
}) {
  const maxPosition = () => Math.max(...props.rows.map((r) => r.position));

  function rowAccentStyle(position: number): string {
    if (props.promotionSlots > 0 && position <= props.promotionSlots)
      return 'border-left: 3px solid #34d399';  // emerald-400
    if (props.relegationSlots > 0 && position > maxPosition() - props.relegationSlots)
      return 'border-left: 3px solid #f87171';  // red-400
    return 'border-left: 3px solid transparent';
  }

  return (
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Show when={props.multiGroup}>
        <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Grupo {String.fromCharCode(64 + props.groupId)}
          </span>
        </div>
      </Show>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
              <th class="px-4 py-2 text-left w-6">#</th>
              <th class="px-4 py-2 text-left">Equipo</th>
              <th class="px-3 py-2 text-center">PJ</th>
              <th class="px-3 py-2 text-center">PG</th>
              <th class="px-3 py-2 text-center">PE</th>
              <th class="px-3 py-2 text-center">PP</th>
              <th class="px-3 py-2 text-center">GF</th>
              <th class="px-3 py-2 text-center">GC</th>
              <th class="px-3 py-2 text-center">DG</th>
              <th class="px-3 py-2 text-center font-semibold text-gray-600">Pts</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(row) => {
                const gd = row.goalsFor - row.goalsAgainst;
                return (
                  <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors" style={rowAccentStyle(row.position)}>
                    <td class="px-4 py-2.5 text-gray-400 text-xs">{row.position}</td>
                    <td class="px-4 py-2.5 font-medium text-gray-900">{row.teamName}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.played}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.won}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.drawn}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.lost}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.goalsFor}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">{row.goalsAgainst}</td>
                    <td class="px-3 py-2.5 text-center text-gray-600">
                      {gd > 0 ? `+${gd}` : gd}
                    </td>
                    <td class="px-3 py-2.5 text-center font-bold text-gray-900">{row.points}</td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Match row ────────────────────────────────────────────────────────────────

function MatchRow(props: { match: TournamentMatch; showDate?: boolean }) {
  const m = props.match;
  const finished = m.status.toLowerCase() === 'finished';
  return (
    <div class="flex flex-col py-2.5 border-b border-gray-50 last:border-0 gap-0.5">
      <Show when={props.showDate !== false}>
        <span class="text-xs text-gray-400">{formatMatchDate(m.matchDate)}</span>
      </Show>
      <div class="flex items-center gap-2 min-w-0">
        <span class={`text-sm flex-1 text-right leading-tight ${finished && m.homeGoals! > m.awayGoals! ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
          {m.homeTeamName}
        </span>
        <span class={`text-sm font-mono shrink-0 w-14 text-center rounded px-1.5 py-0.5 ${finished ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-300'}`}>
          {finished ? `${m.homeGoals} - ${m.awayGoals}` : 'vs'}
        </span>
        <span class={`text-sm flex-1 leading-tight ${finished && m.awayGoals! > m.homeGoals! ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
          {m.awayTeamName}
        </span>
      </div>
    </div>
  );
}

// ─── Round summary card ───────────────────────────────────────────────────────

function RoundCard(props: { label: string; matches: TournamentMatch[] }) {
  return (
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden min-w-0">
      <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {props.label}
        </span>
      </div>
      <div class="px-4">
        <For each={props.matches}>
          {(m) => <MatchRow match={m} showDate={false} />}
        </For>
      </div>
    </div>
  );
}

// ─── Top scorers card (placeholder until data is available) ──────────────────

function TopScorersCard() {
  return (
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
      <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Goleadores
        </span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-3">
        <svg class="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
        </svg>
        <p class="text-sm text-gray-400 text-center">
          Estadísticas de goleadores<br />disponibles próximamente
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentDetail() {
  const ctrl = createTournamentDetailCtrl();

  return (
    <Show
      when={!ctrl.state.loading}
      fallback={
        <div class="py-16 text-center text-sm text-gray-400">Cargando torneo...</div>
      }
    >
      <Show when={ctrl.state.error}>
        <div class="bg-danger-light border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger">
          {ctrl.state.error}
        </div>
      </Show>

      <Show when={ctrl.state.detail !== null}>
        {(_) => {
          const detail = ctrl.state.detail!;
          const t = detail.tournament;
          const standingsGroups = groupStandings(detail.standings);
          const matchRounds = groupMatchesByRound(detail.matches);
          const isMultiGroup = standingsGroups.size > 1;

          const lastPlayedRound = createMemo(() => getLastPlayedRound(detail.matches));
          const nextRound = createMemo(() => getNextRound(detail.matches));

          const lastPlayedMatches = createMemo(() =>
            lastPlayedRound() !== null ? (matchRounds.get(lastPlayedRound()!) ?? []) : [],
          );
          const nextRoundMatches = createMemo(() =>
            nextRound() !== null ? (matchRounds.get(nextRound()!) ?? []) : [],
          );

          const roundNumbers = createMemo(() =>
            [...matchRounds.keys()].sort((a, b) => a - b),
          );

          const activeRoundMatches = createMemo(() =>
            ctrl.activeRound() !== null ? (matchRounds.get(ctrl.activeRound()!) ?? []) : [],
          );

          return (
            <>
              {/* Header */}
              <div class="mb-8">
                <div class="flex items-center gap-2 mb-1">
                  <A href="/torneos" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    Torneos
                  </A>
                  <span class="text-gray-300">/</span>
                  <span class="text-sm text-gray-600">{t.name}</span>
                </div>
                <div class="flex items-center gap-3">
                  <h1 class="text-2xl font-semibold text-gray-900">{t.name}</h1>
                  <Show when={t.season !== null}>
                    <span class="text-sm text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                      Temporada {t.season}
                    </span>
                  </Show>
                </div>
                <Show when={t.numberOfTeams !== null}>
                  <p class="text-sm text-gray-500 mt-0.5">{t.numberOfTeams} equipos</p>
                </Show>
              </div>

              <div class="flex flex-col gap-8">
                {/* Top section: standings (left) + last round + scorers (right) on lg+ */}
                <div class="flex flex-col lg:flex-row lg:items-stretch gap-8">

                  {/* Standings — takes 3/5 of the width on desktop */}
                  <section class="lg:flex-[3] min-w-0 flex flex-col">
                    <h2 class="text-base font-semibold text-gray-900 mb-3">Clasificación</h2>
                    <Show
                      when={detail.standings.length > 0}
                      fallback={
                        <div class="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center text-sm text-gray-400">
                          Clasificación no disponible todavía.
                        </div>
                      }
                    >
                      <div class="flex flex-col gap-4 flex-1 min-h-0">
                        <For each={[...standingsGroups.entries()]}>
                          {([groupId, rows]) => (
                            <StandingsGroup
                              groupId={groupId}
                              rows={rows}
                              multiGroup={isMultiGroup}
                              promotionSlots={t.promotionSlots}
                              relegationSlots={t.relegationSlots}
                            />
                          )}
                        </For>
                      </div>
                    </Show>
                  </section>

                  {/* Right column: last round + top scorers placeholder */}
                  <section class="lg:flex-[2] min-w-0 flex flex-col gap-4">
                    <h2 class="text-base font-semibold text-gray-900">Resumen</h2>
                    <Show when={lastPlayedRound() !== null && lastPlayedMatches().length > 0}>
                      <RoundCard
                        label={`Última jornada · J${lastPlayedRound()}`}
                        matches={lastPlayedMatches()}
                      />
                    </Show>
                    <TopScorersCard />
                  </section>

                </div>

                {/* Next round — full width between top section and calendar */}
                <Show when={nextRound() !== null && nextRoundMatches().length > 0}>
                  <section>
                    <h2 class="text-base font-semibold text-gray-900 mb-3">Próxima jornada</h2>
                    <RoundCard
                      label={`J${nextRound()}`}
                      matches={nextRoundMatches()}
                    />
                  </section>
                </Show>

                {/* Full calendar with round selector */}
                <Show when={detail.matches.length > 0}>
                  <section>
                    <h2 class="text-base font-semibold text-gray-900 mb-3">Calendario completo</h2>

                    {/* Round selector — prev / select / next */}
                    <div class="flex items-center gap-2 mb-4">
                      <button
                        type="button"
                        disabled={ctrl.activeRound() === roundNumbers()[0]}
                        onClick={() => {
                          const idx = roundNumbers().indexOf(ctrl.activeRound()!);
                          if (idx > 0) ctrl.setActiveRound(roundNumbers()[idx - 1]);
                        }}
                        class="p-1.5 rounded border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Jornada anterior"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </button>

                      <select
                        value={ctrl.activeRound() ?? ''}
                        onChange={(e) => ctrl.setActiveRound(Number(e.currentTarget.value))}
                        class="flex-1 sm:flex-none sm:w-48 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-gray-400 cursor-pointer"
                      >
                        <For each={roundNumbers()}>
                          {(round) => (
                            <option value={round}>Jornada {round}</option>
                          )}
                        </For>
                      </select>

                      <button
                        type="button"
                        disabled={ctrl.activeRound() === roundNumbers()[roundNumbers().length - 1]}
                        onClick={() => {
                          const idx = roundNumbers().indexOf(ctrl.activeRound()!);
                          if (idx < roundNumbers().length - 1) ctrl.setActiveRound(roundNumbers()[idx + 1]);
                        }}
                        class="p-1.5 rounded border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Jornada siguiente"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    {/* Active round matches */}
                    <Show when={ctrl.activeRound() !== null}>
                      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Jornada {ctrl.activeRound()}
                          </span>
                        </div>
                        <div class="px-4">
                          <For each={activeRoundMatches()}>
                            {(m) => <MatchRow match={m} />}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </section>
                </Show>

                {/* Empty calendar fallback */}
                <Show when={detail.matches.length === 0}>
                  <section>
                    <h2 class="text-base font-semibold text-gray-900 mb-3">Calendario</h2>
                    <div class="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center text-sm text-gray-400">
                      Calendario no disponible todavía.
                    </div>
                  </section>
                </Show>
              </div>
            </>
          );
        }}
      </Show>
    </Show>
  );
}
