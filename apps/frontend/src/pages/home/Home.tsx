import { For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { createHomeCtrl } from './home.ctrl';
import { useAuth } from '../../context/auth.context';
import type { HomePressNote, HomeStandingRow, HomeTournament } from '../../domain/home/home.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StandingsCard(props: { tournament: HomeTournament }) {
  const t = () => props.tournament;

  return (
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <A
            href={`/torneos/${t().id}`}
            class="font-semibold text-sm text-gray-900 hover:text-primary transition-colors truncate"
          >
            {t().name}
          </A>
          <Show when={t().season !== null}>
            <span class="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">T{t().season}</span>
          </Show>
        </div>
        <A href={`/torneos/${t().id}`} class="text-xs text-primary hover:underline shrink-0">
          Ver todo
        </A>
      </div>

      {/* Standings — top 5 */}
      <Show
        when={t().standings.length > 0}
        fallback={<p class="text-center text-xs text-gray-400 py-6">Sin datos de clasificación</p>}
      >
        <StandingsTable rows={t().standings.slice(0, 5)} />
        <div class="px-4 py-2.5 border-t border-gray-100">
          <A
            href={`/torneos/${t().id}`}
            class="text-xs font-medium hover:underline"
            style="color:var(--color-primary,#4f46e5)"
          >
            Ver clasificación completa →
          </A>
        </div>
      </Show>
    </div>
  );
}

function StandingsTable(props: { rows: HomeStandingRow[] }) {
  return (
    <table class="w-full text-sm" style="table-layout:fixed">
      <colgroup><col style="width:2rem" /><col /><col style="width:2.25rem" /><col style="width:2.25rem" /><col style="width:2.25rem" /><col style="width:2.25rem" /><col style="width:2.5rem" /></colgroup>
      <thead>
        <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
          <th class="px-3 py-2 text-left">#</th>
          <th class="px-2 py-2 text-left">Equipo</th>
          <th class="px-1 py-2 text-center">PJ</th>
          <th class="px-1 py-2 text-center">PG</th>
          <th class="px-1 py-2 text-center">PE</th>
          <th class="px-1 py-2 text-center">PP</th>
          <th class="px-2 py-2 text-center font-semibold text-gray-500">Pts</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.rows}>
          {(row) => (
            <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              <td class="px-3 py-2 text-gray-400 text-xs">{row.position}</td>
              <td class="px-2 py-2 max-w-0">
                <A
                  href={`/equipos/${row.htTeamId}`}
                  class="flex items-center gap-1.5 text-gray-800 font-medium hover:text-primary transition-colors w-full min-w-0"
                >
                  <Show when={row.logoUrl}>
                    <img src={row.logoUrl!} alt="" class="w-4 h-4 object-contain shrink-0" />
                  </Show>
                  <span class="truncate" title={row.teamName}>{row.teamName}</span>
                </A>
              </td>
              <td class="px-1 py-2 text-center text-gray-600">{row.played}</td>
              <td class="px-1 py-2 text-center text-gray-600">{row.won}</td>
              <td class="px-1 py-2 text-center text-gray-600">{row.drawn}</td>
              <td class="px-1 py-2 text-center text-gray-600">{row.lost}</td>
              <td class="px-2 py-2 text-center font-semibold text-gray-800">{row.points}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

function PressNotesList(props: { notes: HomePressNote[] }) {
  return (
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div class="px-4 py-2.5 border-b border-gray-100">
        <span class="text-sm font-semibold text-gray-900">Últimas notas de prensa</span>
      </div>
      <ul>
        <For each={props.notes}>
          {(note) => (
            <li class="border-b border-gray-50 last:border-0">
              <A
                href={`/equipos/${note.htTeamId}?tab=notas`}
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                {/* Logo */}
                <div class="shrink-0 w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                  <Show
                    when={note.teamLogo}
                    fallback={
                      <svg class="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
                      </svg>
                    }
                  >
                    <img src={note.teamLogo!} alt="" class="w-7 h-7 object-contain" />
                  </Show>
                </div>

                {/* Title */}
                <span class="text-sm text-gray-800 font-medium truncate flex-1 min-w-0">{note.title}</span>

                {/* Meta */}
                <div class="flex items-center gap-2 shrink-0">
                  <Show when={note.teamName}>
                    <span class="text-xs font-medium" style="color:var(--color-primary,#4f46e5)">{note.teamName}</span>
                    <span class="text-gray-300 text-xs">·</span>
                  </Show>
                  <span class="text-xs text-gray-400">{formatDate(note.createdAt)}</span>
                </div>
              </A>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const ctrl = createHomeCtrl();
  const auth = useAuth();

  const isStaff = () => {
    const role = auth.user()?.role ?? null;
    return role === 'owner' || role === 'co_owner';
  };

  return (
    <>
      {/* Page header */}
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Inicio</h1>
          <p class="text-sm text-gray-500 mt-0.5">Resumen de la actividad de la comunidad</p>
        </div>
        <Show when={isStaff()}>
          <button
            type="button"
            onClick={() => ctrl.setState('showAnnouncementForm', (v) => !v)}
            class="text-sm font-medium px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors shrink-0"
          >
            {ctrl.state.showAnnouncementForm ? 'Cancelar' : '+ Anuncio'}
          </button>
        </Show>
      </div>

      {/* Global error */}
      <Show when={ctrl.state.error}>
        <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {ctrl.state.error}
        </div>
      </Show>

      {/* Announcement form */}
      <Show when={ctrl.state.showAnnouncementForm}>
        <div class="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h2 class="text-sm font-semibold text-gray-800 mb-3">Nuevo anuncio</h2>
          <div class="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Título"
              value={ctrl.state.announcementTitle}
              onInput={(e) => ctrl.setState('announcementTitle', e.currentTarget.value)}
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              maxLength={200}
            />
            <textarea
              placeholder="Contenido del anuncio..."
              value={ctrl.state.announcementContent}
              onInput={(e) => ctrl.setState('announcementContent', e.currentTarget.value)}
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              rows={3}
              maxLength={2000}
            />
            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={ctrl.state.announcementPinned}
                onChange={(e) => ctrl.setState('announcementPinned', e.currentTarget.checked)}
                class="rounded border-gray-300"
              />
              Fijar en la parte superior
            </label>

            <Show when={ctrl.state.announcementError}>
              <p class="text-xs text-red-600">{ctrl.state.announcementError}</p>
            </Show>

            <div class="flex justify-end">
              <button
                type="button"
                onClick={() => ctrl.submitAnnouncement()}
                disabled={ctrl.state.announcementSubmitting}
                class="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                style="background:var(--color-primary, #4f46e5)"
              >
                {ctrl.state.announcementSubmitting ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show
        when={!ctrl.state.loading}
        fallback={
          <div class="bg-white border border-gray-200 rounded-xl px-4 py-20 text-center text-sm text-gray-400">
            Cargando inicio...
          </div>
        }
      >
        {/* Announcements */}
        <Show when={ctrl.state.data && ctrl.state.data!.announcements.length > 0}>
          <div class="flex flex-col gap-3 mb-6">
            <For each={ctrl.state.data!.announcements}>
              {(a) => (
                <div
                  class="rounded-xl border-l-4 px-4 py-3.5 flex items-start gap-3"
                  style={a.pinned
                    ? 'background:#fffbeb;border-color:#f59e0b;border-width:1px 1px 1px 4px;'
                    : 'background:#f0f9ff;border-color:#38bdf8;border-width:1px 1px 1px 4px;'}
                >
                  <span class="shrink-0 mt-0.5 text-base leading-none" style={a.pinned ? 'color:#d97706' : 'color:#0284c7'}>
                    {a.pinned ? '📌' : '📢'}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-sm font-semibold" style={a.pinned ? 'color:#92400e' : 'color:#0c4a6e'}>{a.title}</p>
                      <Show when={a.pinned}>
                        <span class="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style="background:#fde68a;color:#92400e">
                          Fijado
                        </span>
                      </Show>
                    </div>
                    <p class="text-sm mt-1 whitespace-pre-line leading-relaxed" style={a.pinned ? 'color:#78350f' : 'color:#075985'}>{a.content}</p>
                    <p class="text-xs mt-1.5" style="color:#94a3b8">{formatDate(a.createdAt)}</p>
                  </div>
                  <Show when={isStaff()}>
                    <button
                      type="button"
                      onClick={() => ctrl.deleteAnnouncement(a.id)}
                      class="shrink-0 transition-colors"
                      style="color:#cbd5e1"
                      title="Borrar anuncio"
                      onMouseOver={(e) => (e.currentTarget.style.color = '#f87171')}
                      onMouseOut={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Tournament standings — grid de tarjetas compactas */}
        <Show
          when={ctrl.state.data && ctrl.state.data!.tournaments.length > 0}
          fallback={
            <div class="bg-white border border-gray-200 rounded-xl px-4 py-20 text-center text-sm text-gray-400">
              No hay competiciones registradas todavía.
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <For each={ctrl.state.data!.tournaments}>
              {(t) => <StandingsCard tournament={t} />}
            </For>
          </div>
        </Show>

        {/* Press notes list */}
        <Show when={ctrl.state.data && ctrl.state.data!.pressNotes.length > 0}>
          <PressNotesList notes={ctrl.state.data!.pressNotes} />
        </Show>
      </Show>
    </>
  );
}
