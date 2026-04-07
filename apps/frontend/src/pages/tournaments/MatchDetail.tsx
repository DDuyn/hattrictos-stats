import { createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { onMount } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import {
  tournamentsApi,
  type MatchDetail,
  type MatchAppearance,
  type MatchEvent,
} from '../../domain/tournaments/tournaments.api';

// ─── Controller ───────────────────────────────────────────────────────────────

function createMatchDetailCtrl() {
  const params = useParams<{ id: string; matchId: string }>();
  const [state, setState] = createStore<{
    detail: MatchDetail | null;
    loading: boolean;
    error: string | null;
  }>({ detail: null, loading: true, error: null });

  onMount(async () => {
    try {
      const detail = await tournamentsApi.getMatch(params.id, params.matchId);
      setState({ detail, loading: false });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : 'Error al cargar el partido' });
    }
  });

  return { state, params };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps CHPP RoleID to a short position label */
function roleLabel(roleId: number): string {
  if (roleId === 100) return 'POR';
  if (roleId >= 101 && roleId <= 104) return 'DEF';
  if (roleId >= 105 && roleId <= 108) return 'MED';
  if (roleId >= 109 && roleId <= 113) return 'DEL';
  // Substitutes (came in during the match)
  if (roleId >= 114) return 'SUP';
  // Unknown / special role (e.g. Arena roleId=17) — show nothing
  return '';
}

function formatMatchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GoalBall() {
  return (
    <span class="inline-block w-4 h-4 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7.5" stroke="#374151" stroke-width="1"/>
        <polygon points="8,2 9.5,6 14,6 10.5,8.5 12,12.5 8,10 4,12.5 5.5,8.5 2,6 6.5,6" fill="#374151" stroke="none"/>
      </svg>
    </span>
  );
}

function EventTimeline(props: { events: MatchEvent[]; homeTeamId: number }) {
  return (
    <div class="flex flex-col gap-1.5 py-2">
      <For each={props.events}>
        {(ev) => {
          const isHome = ev.subjectTeamId === props.homeTeamId;
          return (
            <div class={`flex items-center gap-3 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
              {/* Minute badge */}
              <span class="text-xs font-mono text-gray-400 w-8 shrink-0 text-center">
                {ev.minute}'
              </span>
              {/* Event card */}
              <div class={`flex items-center gap-2 min-w-0 flex-1 ${isHome ? '' : 'justify-end'}`}>
                <GoalBall />
                <span class="text-sm font-medium text-gray-900 truncate">
                  {ev.subjectPlayerName ?? `Jugador #${ev.subjectPlayerId}`}
                </span>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function LineupTable(props: { appearances: MatchAppearance[]; label: string }) {
  const starters = () => props.appearances.filter((a) => a.minuteIn === 0);
  const subs = () => props.appearances.filter((a) => a.minuteIn > 0);

  return (
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{props.label}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <tbody>
            <For each={starters()}>
              {(p) => (
                <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td class="px-3 py-2.5 w-12 shrink-0">
                    <Show when={roleLabel(p.roleId) !== ''}>
                      <span class="text-xs font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                        {roleLabel(p.roleId)}
                      </span>
                    </Show>
                  </td>
                  <td class="px-3 py-2.5 font-medium text-gray-900">
                    {p.playerName}
                    <Show when={p.minuteOut !== null}>
                      <span class="text-xs text-gray-400 ml-1.5">↓{p.minuteOut}'</span>
                    </Show>
                  </td>
                  <td class="px-3 py-2.5 text-right">
                    <Show when={p.ratingStars !== null}>
                      <span class="text-xs font-mono text-amber-600">{p.ratingStars!.toFixed(1)}★</span>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
            <Show when={subs().length > 0}>
              <tr>
                <td colspan="3" class="px-3 py-1.5 bg-gray-50 border-y border-gray-100">
                  <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sustituciones</span>
                </td>
              </tr>
              <For each={subs()}>
                {(p) => (
                  <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td class="px-3 py-2.5 w-12 shrink-0">
                      <span class="text-xs font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                        ↑{p.minuteIn}'
                      </span>
                    </td>
                    <td class="px-3 py-2.5 font-medium text-gray-900">{p.playerName}</td>
                    <td class="px-3 py-2.5 text-right">
                      <Show when={p.ratingStars !== null}>
                        <span class="text-xs font-mono text-amber-600">{p.ratingStars!.toFixed(1)}★</span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>
      <Show when={props.appearances.length === 0}>
        <div class="px-4 py-6 text-center text-sm text-gray-400">
          Alineación no disponible
        </div>
      </Show>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const ctrl = createMatchDetailCtrl();

  return (
    <Show
      when={!ctrl.state.loading}
      fallback={<div class="py-16 text-center text-sm text-gray-400">Cargando partido...</div>}
    >
      <Show when={ctrl.state.error}>
        <div class="bg-danger-light border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger">
          {ctrl.state.error}
        </div>
      </Show>

      <Show when={ctrl.state.detail !== null}>
        {(_) => {
          const d = ctrl.state.detail!;
          const m = d.match;
          const finished = m.status.toLowerCase() === 'finished';

          return (
            <>
              {/* Breadcrumb */}
              <div class="mb-8">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <A href="/torneos" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    Torneos
                  </A>
                  <span class="text-gray-300">/</span>
                  <A href={`/torneos/${ctrl.params.id}`} class="text-sm text-gray-400 hover:text-gray-600 transition-colors max-w-[12rem] truncate">
                    Torneo
                  </A>
                  <span class="text-gray-300">/</span>
                  <span class="text-sm text-gray-600">Jornada {m.round}</span>
                </div>
              </div>

              {/* Scoreboard */}
              <div class="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
                <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-center">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Jornada {m.round} · {formatMatchDate(m.matchDate)}
                  </span>
                </div>
                <div class="flex items-center justify-between px-6 py-8 gap-4">
                  {/* Home team */}
                  <div class="flex-1 text-right">
                    <p class={`text-lg font-semibold leading-tight ${finished && m.homeGoals! > m.awayGoals! ? 'text-gray-900' : 'text-gray-600'}`}>
                      {m.homeTeamName}
                    </p>
                  </div>

                  {/* Score */}
                  <div class="shrink-0 flex items-center gap-3 px-4">
                    <Show
                      when={finished}
                      fallback={
                        <span class="text-2xl font-light text-gray-300 tracking-widest">vs</span>
                      }
                    >
                      <span class="text-4xl font-bold text-gray-900 tabular-nums">{m.homeGoals}</span>
                      <span class="text-2xl text-gray-300">–</span>
                      <span class="text-4xl font-bold text-gray-900 tabular-nums">{m.awayGoals}</span>
                    </Show>
                  </div>

                  {/* Away team */}
                  <div class="flex-1">
                    <p class={`text-lg font-semibold leading-tight ${finished && m.awayGoals! > m.homeGoals! ? 'text-gray-900' : 'text-gray-600'}`}>
                      {m.awayTeamName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Events + Lineups */}
              <div class="flex flex-col lg:flex-row gap-8">

                {/* Events (goals) */}
                <section class="lg:flex-[1] min-w-0">
                  <h2 class="text-base font-semibold text-gray-900 mb-3">Goles</h2>
                  <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <Show
                      when={d.events.length > 0}
                      fallback={
                        <div class="px-4 py-8 text-center text-sm text-gray-400">
                           <Show when={finished} fallback="Partido no disputado aún">
                             Sin goles registrados
                           </Show>
                        </div>
                      }
                    >
                      {/* Column headers */}
                      <div class="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                        <div class="w-8" />
                        <div class="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">{m.homeTeamName}</div>
                        <div class="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">{m.awayTeamName}</div>
                      </div>
                      <div class="px-4">
                        <EventTimeline events={d.events} homeTeamId={m.homeTeamId} />
                      </div>
                    </Show>
                  </div>
                </section>

                {/* Lineups */}
                <section class="lg:flex-[2] min-w-0">
                  <h2 class="text-base font-semibold text-gray-900 mb-3">Alineaciones</h2>
                  <Show
                    when={d.homeAppearances.length > 0 || d.awayAppearances.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center text-sm text-gray-400">
                        Alineaciones no disponibles todavía.
                        <Show when={!finished}>
                          {' '}Este partido no se ha disputado aún.
                        </Show>
                      </div>
                    }
                  >
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <LineupTable appearances={d.homeAppearances} label={m.homeTeamName} />
                      <LineupTable appearances={d.awayAppearances} label={m.awayTeamName} />
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
