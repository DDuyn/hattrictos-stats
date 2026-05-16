import { For, Show, createSignal, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { A, useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { createTeamDetailCtrl, formatMatchDate } from './teams.ctrl';
import type { TeamDetail, PlayerStat } from '../../domain/teams/teams.api';
import { teamsApi } from '../../domain/teams/teams.api';
import { pressNotesApi, type PressNote } from '../../domain/press-notes/press-notes.api';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { useAuth } from '../../context/auth.context';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'plantilla' | 'calendario' | 'competiciones' | 'estadisticas' | 'notas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Genera un color de fondo determinista basado en el nombre del equipo */
function teamColor(name: string): string {
  const palette = [
    '#1e40af', '#7c3aed', '#b91c1c', '#065f46', '#92400e',
    '#1e3a5f', '#6b21a8', '#9f1239', '#064e3b', '#78350f',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

/** Iniciales del equipo (máx. 2 chars) */
function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton(props: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        props.active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {props.label}
      <Show when={props.count !== undefined}>
        <span
          class={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
            props.active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {props.count}
        </span>
      </Show>
    </button>
  );
}

function MatchStatusBadge(props: {
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeamId: number;
  htTeamId: number;
}) {
  const finished = () => props.status.toLowerCase() === 'finished';

  if (!finished()) {
    return <span class="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">Pend.</span>;
  }

  if (props.homeGoals === null || props.awayGoals === null) {
    return <span class="text-xs text-gray-400">—</span>;
  }

  const isHome = props.homeTeamId === props.htTeamId;
  const gf = isHome ? props.homeGoals : props.awayGoals;
  const ga = isHome ? props.awayGoals : props.homeGoals;

  let label: string;
  let style: string;
  if (gf > ga) {
    label = 'V';
    style = 'background:#34d399;color:#fff';
  } else if (gf === ga) {
    label = 'E';
    style = 'background:#d1d5db;color:#374151';
  } else {
    label = 'D';
    style = 'background:#f87171;color:#fff';
  }

  return (
    <span
      class="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold shrink-0"
      style={style}
    >
      {label}
    </span>
  );
}

type StatPillColor = 'default' | 'win' | 'draw' | 'loss' | 'goals-for' | 'goals-against' | 'pct' | 'accent';

function StatPill(props: { label: string; value: string | number; color?: StatPillColor }) {
  const bg = () => {
    switch (props.color) {
      case 'win':           return 'background:#dcfce7';
      case 'draw':          return 'background:#fef9c3';
      case 'loss':          return 'background:#fee2e2';
      case 'goals-for':     return 'background:#dbeafe';
      case 'goals-against': return 'background:#ffe4e6';
      case 'pct':           return 'background:#f3e8ff';
      case 'accent':        return 'background:rgba(79,70,229,0.08)';
      default:              return 'background:#f3f4f6';
    }
  };
  const fg = () => {
    switch (props.color) {
      case 'win':           return 'color:#16a34a';
      case 'draw':          return 'color:#854d0e';
      case 'loss':          return 'color:#dc2626';
      case 'goals-for':     return 'color:#1d4ed8';
      case 'goals-against': return 'color:#be123c';
      case 'pct':           return 'color:#7c3aed';
      case 'accent':        return 'color:#4f46e5';
      default:              return 'color:#1f2937';
    }
  };

  return (
    <div class="flex flex-col items-center px-3 py-2 rounded-lg" style={bg()}>
      <span class="text-lg font-bold leading-none" style={fg()}>
        {props.value}
      </span>
      <span class="text-xs mt-0.5 whitespace-nowrap" style="color:#6b7280">{props.label}</span>
    </div>
  );
}

function PlayerRankTable(props: { rows: PlayerStat[]; valueLabel: string; extra?: (row: PlayerStat) => string }) {
  return (
    <Show
      when={props.rows.length > 0}
      fallback={
        <div class="text-center text-sm text-gray-400 py-8">Sin datos disponibles</div>
      }
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-2 text-left w-8">#</th>
            <th class="px-4 py-2 text-left">Jugador</th>
            <th class="px-4 py-2 text-right">{props.valueLabel}</th>
            <Show when={props.extra}>
              <th class="px-4 py-2 text-right">Detalle</th>
            </Show>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row, i) => (
              <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td class="px-4 py-2.5 text-gray-400 text-xs">{i() + 1}</td>
                <td class="px-4 py-2.5 font-medium text-gray-800">
                  <A href={`/jugadores/${row.htPlayerId}`} class="hover:text-primary transition-colors">
                    {row.firstName} {row.lastName}
                  </A>
                </td>
                <td class="px-4 py-2.5 text-right font-semibold text-gray-700">{row.value}</td>
                <Show when={props.extra}>
                  <td class="px-4 py-2.5 text-right text-xs text-gray-400">
                    {props.extra!(row)}
                  </td>
                </Show>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </Show>
  );
}

function StatsSection(props: {
  icon: string;
  title: string;
  valueLabel: string;
  seasonRows: PlayerStat[];
  historicRows: PlayerStat[];
  seasonLabel: string | null;
  showCardDetail?: boolean;
}) {
  const cardExtra = (row: PlayerStat) =>
    `${row.yellows ?? 0}A / ${row.reds ?? 0}R`;

  return (
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div class="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span class="text-base">{props.icon}</span>
        <span class="font-semibold text-gray-800 text-sm">{props.title}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {/* Temporada actual */}
        <div>
          <div class="px-4 py-2 border-b border-gray-50">
            <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {props.seasonLabel ?? 'Temporada actual'}
            </span>
          </div>
          <PlayerRankTable
            rows={props.seasonRows}
            valueLabel={props.valueLabel}
            extra={props.showCardDetail ? cardExtra : undefined}
          />
        </div>

        {/* Histórico */}
        <div>
          <div class="px-4 py-2 border-b border-gray-50">
            <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Histórico
            </span>
          </div>
          <PlayerRankTable
            rows={props.historicRows}
            valueLabel={props.valueLabel}
            extra={props.showCardDetail ? cardExtra : undefined}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ htTeamId: string }>();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const ctrl = createTeamDetailCtrl();

  const validTabs: Tab[] = ['plantilla', 'calendario', 'competiciones', 'estadisticas', 'notas'];
  const initialTab = (): Tab => {
    const t = searchParams.tab as Tab;
    return validTabs.includes(t) ? t : 'plantilla';
  };
  const [activeTab, setActiveTab] = createSignal<Tab>(initialTab());
  const [logoUrl, setLogoUrl] = createSignal<string | null>(null);
  const [logoUploading, setLogoUploading] = createSignal(false);
  const [logoError, setLogoError] = createSignal<string | null>(null);

  // ── Press notes state ──────────────────────────────────────────────────────
  const [pressNotes, setPressNotes] = createSignal<PressNote[]>([]);
  const [pressNotesLoading, setPressNotesLoading] = createSignal(false);
  const [pressNotesError, setPressNotesError] = createSignal<string | null>(null);
  const [showNoteForm, setShowNoteForm] = createSignal(false);
  const [noteTitle, setNoteTitle] = createSignal('');
  const [noteContent, setNoteContent] = createSignal('');
  const [noteSubmitting, setNoteSubmitting] = createSignal(false);
  const [noteFormError, setNoteFormError] = createSignal<string | null>(null);

  const htTeamIdNum = () => Number(params.htTeamId);

  // Sync logoUrl from detail when it loads
  const isStaff = () => {
    const role = auth.user()?.role ?? null;
    return role === 'owner' || role === 'co_owner' || role === 'admin';
  };

  const isOwnerOrCoOwner = () => {
    const role = auth.user()?.role ?? null;
    return role === 'owner' || role === 'co_owner';
  };

  const canWriteNote = () => {
    if (!auth.user()) return false;
    if (isOwnerOrCoOwner()) return true;
    return auth.user()!.htTeamId === htTeamIdNum();
  };

  async function loadPressNotes() {
    const id = htTeamIdNum();
    if (!id) return;
    setPressNotesLoading(true);
    setPressNotesError(null);
    try {
      const notes = await pressNotesApi.list(id);
      setPressNotes(notes);
    } catch (err) {
      setPressNotesError(err instanceof Error ? err.message : 'Error al cargar las notas');
    } finally {
      setPressNotesLoading(false);
    }
  }

  onMount(() => {
    if (initialTab() === 'notas') loadPressNotes();
  });

  async function submitNote() {
    if (!noteTitle().trim() || !noteContent().trim()) {
      setNoteFormError('El título y el contenido son obligatorios');
      return;
    }
    setNoteSubmitting(true);
    setNoteFormError(null);
    try {
      const note = await pressNotesApi.create(htTeamIdNum(), {
        title: noteTitle().trim(),
        content: noteContent().trim(),
      });
      setPressNotes((prev) => [note, ...prev]);
      setNoteTitle('');
      setNoteContent('');
      setShowNoteForm(false);
    } catch (err) {
      setNoteFormError(err instanceof Error ? err.message : 'Error al publicar la nota');
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function deleteNote(noteId: string) {
    try {
      await pressNotesApi.delete(htTeamIdNum(), noteId);
      setPressNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      setPressNotesError(err instanceof Error ? err.message : 'Error al borrar la nota');
    }
  }

  // undefined = sin override local (usa el valor del server)
  // null = borrado localmente
  // string = URL subida localmente
  const currentLogoUrl = () => {
    const local = logoUrl();
    if (local === '__deleted__') return null;  // borrado explícito
    if (local !== null) return local;          // upload local
    return ctrl.state.detail?.team.logoUrl ?? null;  // valor del server
  };

  async function handleLogoUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !ctrl.state.detail) return;

    setLogoUploading(true);
    setLogoError(null);
    try {
      const result = await teamsApi.uploadLogo(ctrl.state.detail.team.htTeamId, file);
      setLogoUrl(result.logoUrl);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Error al subir el logo');
    } finally {
      setLogoUploading(false);
      input.value = '';
    }
  }

  async function handleLogoDelete() {
    if (!ctrl.state.detail) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      await teamsApi.deleteLogo(ctrl.state.detail.team.htTeamId);
      setLogoUrl('__deleted__');   // señal especial para indicar borrado
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Error al eliminar el logo');
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <>
      {/* Breadcrumb + back */}
      <div class="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          class="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all text-gray-500 hover:text-gray-700 shrink-0"
          title="Volver"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div class="text-xs text-gray-400">
          <A href="/equipos" class="hover:text-primary transition-colors">Equipos</A>
          <Show when={ctrl.state.detail}>
            {' / '}
            <span class="text-gray-600">{ctrl.state.detail!.team.name}</span>
          </Show>
        </div>
      </div>

      <Show
        when={!ctrl.state.loading}
        fallback={
          <div class="bg-white border border-gray-200 rounded-xl px-4 py-20 text-center text-sm text-gray-400">
            Cargando equipo...
          </div>
        }
      >
        <Show when={ctrl.state.error}>
          <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
            {ctrl.state.error}
          </div>
        </Show>

        <Show when={ctrl.state.detail}>
          {(detail) => {
            const team = () => detail().team;
            const gs = () => detail().globalStats;
            const color = () => teamColor(team().name);
            const initials = () => teamInitials(team().name);

            return (
              <div>
                {/* ── Error de logo ──────────────────────────────────────── */}
                <Show when={logoError()}>
                  <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
                    {logoError()}
                  </div>
                </Show>

                {/* ── Team Header ────────────────────────────────────────── */}
                <div class="bg-white border border-gray-200 rounded-xl p-5 mb-5">
                  <div class="flex flex-col sm:flex-row gap-4 items-start">

                    {/* Avatar / Logo */}
                    <div class="relative shrink-0 group">
                      <Show
                        when={currentLogoUrl()}
                        fallback={
                          <div
                            class="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm"
                            style={`background:${color()}`}
                          >
                            {initials()}
                          </div>
                        }
                      >
                        <img
                          src={currentLogoUrl()!}
                          alt={`Escudo de ${team().name}`}
                          class="w-20 h-20 object-contain"
                        />
                      </Show>

                      {/* Overlay de subida — solo visible para staff al hacer hover */}
                      <Show when={isStaff()}>
                        <label
                          class="absolute inset-0 rounded-2xl flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                          title={currentLogoUrl() ? 'Cambiar escudo' : 'Subir escudo'}
                        >
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            class="sr-only"
                            onChange={handleLogoUpload}
                            disabled={logoUploading()}
                          />
                          <Show
                            when={!logoUploading()}
                            fallback={
                              <svg class="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                            }
                          >
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <span class="text-white text-[10px] mt-0.5 font-medium leading-tight text-center px-1">
                              {currentLogoUrl() ? 'Cambiar' : 'Subir'}
                            </span>
                          </Show>
                        </label>

                        {/* Botón eliminar logo — solo si hay logo, visible siempre para staff */}
                        <Show when={currentLogoUrl()}>
                          <button
                            type="button"
                            class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors z-10"
                            title="Quitar escudo"
                            onClick={handleLogoDelete}
                            disabled={logoUploading()}
                          >
                            <svg class="w-2.5 h-2.5 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </Show>
                      </Show>
                    </div>

                    {/* Name + metadata */}
                    <div class="flex-1 min-w-0">
                      <h1 class="text-2xl font-bold text-gray-900 leading-tight truncate">
                        {team().name}
                      </h1>
                      <Show when={team().shortName}>
                        <p class="text-sm text-gray-500 mt-0.5">{team().shortName}</p>
                      </Show>

                      <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <Show when={team().managerLoginName}>
                          <span class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                            {team().managerLoginName}
                          </span>
                        </Show>
                        <Show when={team().leagueName}>
                          <span class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
                            </svg>
                            {team().leagueName}
                          </span>
                        </Show>
                        <Show when={team().arenaName}>
                          <span class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                            {team().arenaName}
                          </span>
                        </Show>
                        <Show when={team().foundedDate}>
                          <span class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            Fundado {team().foundedDate.slice(0, 10)}
                          </span>
                        </Show>
                      </div>
                    </div>
                  </div>

                  {/* Global stats bar */}
                  <Show when={gs().totalPlayed > 0}>
                    <div class="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                      <StatPill label="Partidos" value={gs().totalPlayed} />
                      <StatPill label="Victorias" value={gs().totalWon} color="win" />
                      <StatPill label="Empates" value={gs().totalDrawn} color="draw" />
                      <StatPill label="Derrotas" value={gs().totalLost} color="loss" />
                      <StatPill label="GF" value={gs().totalGoalsFor} color="goals-for" />
                      <StatPill label="GC" value={gs().totalGoalsAgainst} color="goals-against" />
                      <StatPill
                        label="% victorias"
                        value={`${Math.round((gs().totalWon / gs().totalPlayed) * 100)}%`}
                        color="pct"
                      />
                    </div>
                  </Show>
                </div>

                {/* ── Tab bar ───────────────────────────────────────────── */}
                <div class="border-b border-gray-200 mb-6 flex gap-0 overflow-x-auto">
                  <TabButton
                    label="Plantilla"
                    active={activeTab() === 'plantilla'}
                    onClick={() => setActiveTab('plantilla')}
                    count={detail().roster.length}
                  />
                  <TabButton
                    label="Calendario"
                    active={activeTab() === 'calendario'}
                    onClick={() => setActiveTab('calendario')}
                    count={detail().matches.length}
                  />
                  <TabButton
                    label="Competiciones"
                    active={activeTab() === 'competiciones'}
                    onClick={() => setActiveTab('competiciones')}
                    count={detail().tournaments.length}
                  />
                  <TabButton
                    label="Estadísticas"
                    active={activeTab() === 'estadisticas'}
                    onClick={() => setActiveTab('estadisticas')}
                  />
                  <TabButton
                    label="Notas de prensa"
                    active={activeTab() === 'notas'}
                    onClick={() => {
                      setActiveTab('notas');
                      if (pressNotes().length === 0 && !pressNotesLoading()) loadPressNotes();
                    }}
                    count={pressNotes().length > 0 ? pressNotes().length : undefined}
                  />
                </div>

                {/* ── Tab: Plantilla ──────────────────────────────────── */}
                <Show when={activeTab() === 'plantilla'}>
                  <Show
                    when={detail().roster.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-xl px-4 py-16 text-center text-sm text-gray-400">
                        No hay jugadores registrados para este equipo.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                            <th class="px-4 py-2.5 text-left w-8">#</th>
                            <th class="px-4 py-2.5 text-left">Jugador</th>
                            <th class="px-3 py-2.5 text-center">Nac.</th>
                            <th class="px-4 py-2.5 text-center">Edad</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={detail().roster}>
                            {(player, i) => (
                              <tr
                                class="border-b border-gray-50 last:border-0 hover:bg-primary/5 transition-colors cursor-pointer"
                                onClick={() => navigate(`/jugadores/${player.htPlayerId}`)}
                              >
                                <td class="px-4 py-2.5 text-gray-400 text-xs">{i() + 1}</td>
                                <td class="px-4 py-2.5 font-medium text-gray-800">
                                  <A href={`/jugadores/${player.htPlayerId}`} class="hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                    {player.firstName} {player.lastName}
                                  </A>
                                </td>
                                <td class="px-3 py-2.5 text-center">
                                  <CountryFlag
                                    code={player.countryCode}
                                    size={18}
                                    title={player.countryName ?? player.countryCode ?? undefined}
                                  />
                                </td>
                                <td class="px-4 py-2.5 text-center text-gray-600 text-xs">
                                  <Show when={player.age !== null} fallback={<span class="text-gray-300">—</span>}>
                                    {player.age}
                                  </Show>
                                </td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                    <p class="text-xs text-gray-400 mt-2 text-right">
                      {detail().roster.length} jugador{detail().roster.length !== 1 ? 'es' : ''}
                    </p>
                  </Show>
                </Show>

                {/* ── Tab: Calendario ─────────────────────────────────── */}
                <Show when={activeTab() === 'calendario'}>
                  <Show
                    when={detail().matches.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-xl px-4 py-16 text-center text-sm text-gray-400">
                        No hay partidos registrados para este equipo.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead>
                            <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                              <th class="px-4 py-2.5 text-left">Fecha</th>
                              <th class="px-4 py-2.5 text-left hidden sm:table-cell">Competición</th>
                              <th class="px-3 py-2.5 text-center">Jor.</th>
                              <th class="px-4 py-2.5 text-left">Rival</th>
                              <th class="px-3 py-2.5 text-center">Marcador</th>
                              <th class="px-3 py-2.5 text-center">Res.</th>
                              <th class="px-2 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={detail().matches}>
                              {(m) => {
                                const isHome = m.homeTeamId === detail().team.htTeamId;
                                const opponentName = isHome ? m.awayTeamName : m.homeTeamName;
                                const opponentId = isHome ? m.awayTeamId : m.homeTeamId;
                                const finished = m.status.toLowerCase() === 'finished';
                                const hasDetail = finished && m.detailsSynced === 1;
                                const scoreStr =
                                  finished && m.homeGoals !== null && m.awayGoals !== null
                                    ? `${m.homeGoals} – ${m.awayGoals}`
                                    : '—';
                                const navigate = useNavigate();

                                return (
                                  <tr
                                    class={`border-b border-gray-50 last:border-0 transition-colors ${hasDetail ? 'cursor-pointer hover:bg-primary/5' : 'hover:bg-gray-50'}`}
                                    onClick={() => {
                                      if (hasDetail) navigate(`/torneos/${m.tournamentId}/partidos/${m.id}`);
                                    }}
                                  >
                                    <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                                      {formatMatchDate(m.matchDate)}
                                    </td>
                                    <td class="px-4 py-3 hidden sm:table-cell">
                                      <Show
                                        when={m.tournamentName}
                                        fallback={<span class="text-gray-400">—</span>}
                                      >
                                        <A
                                          href={`/torneos/${m.tournamentId}`}
                                          class="text-gray-500 hover:text-primary transition-colors text-xs"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {m.tournamentName}
                                        </A>
                                      </Show>
                                    </td>
                                    <td class="px-3 py-3 text-center text-gray-400 text-xs">
                                      {m.round}
                                    </td>
                                    <td class="px-4 py-3">
                                      <A
                                        href={`/equipos/${opponentId}`}
                                        class="text-gray-800 hover:text-primary transition-colors font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {opponentName}
                                      </A>
                                      <span class="text-xs text-gray-400 ml-1.5">
                                        {isHome ? '(L)' : '(V)'}
                                      </span>
                                    </td>
                                    <td class="px-3 py-3 text-center font-mono text-gray-700 text-sm">
                                      {scoreStr}
                                    </td>
                                    <td class="px-3 py-3 text-center">
                                      <MatchStatusBadge
                                        status={m.status}
                                        homeGoals={m.homeGoals}
                                        awayGoals={m.awayGoals}
                                        homeTeamId={m.homeTeamId}
                                        htTeamId={detail().team.htTeamId}
                                      />
                                    </td>
                                    <td class="px-2 py-3 text-center">
                                      <Show when={hasDetail}>
                                        <svg
                                          class="w-4 h-4 inline text-gray-300"
                                          fill="none"
                                          stroke="currentColor"
                                          stroke-width="1.5"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                          />
                                        </svg>
                                      </Show>
                                    </td>
                                  </tr>
                                );
                              }}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Show>
                </Show>

                {/* ── Tab: Competiciones ──────────────────────────────── */}
                <Show when={activeTab() === 'competiciones'}>
                  <Show
                    when={detail().tournaments.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-xl px-4 py-16 text-center text-sm text-gray-400">
                        No participa en ninguna competición registrada.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead>
                            <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                              <th class="px-4 py-2.5 text-left">Competición</th>
                              <th class="px-3 py-2.5 text-center w-8">#</th>
                              <th class="px-3 py-2.5 text-center">PJ</th>
                              <th class="px-3 py-2.5 text-center">PG</th>
                              <th class="px-3 py-2.5 text-center">PE</th>
                              <th class="px-3 py-2.5 text-center">PP</th>
                              <th class="px-3 py-2.5 text-center">GF</th>
                              <th class="px-3 py-2.5 text-center">GC</th>
                              <th class="px-3 py-2.5 text-center">DG</th>
                              <th class="px-3 py-2.5 text-center font-semibold text-gray-600">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={detail().tournaments}>
                              {(t) => (
                                <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                  <td class="px-4 py-3">
                                    <A
                                      href={`/torneos/${t.tournamentId}`}
                                      class="font-medium text-gray-900 hover:text-primary transition-colors"
                                    >
                                      {t.tournamentName}
                                    </A>
                                    <Show when={t.season !== null}>
                                      <span class="text-xs text-gray-400 ml-1.5">T{t.season}</span>
                                    </Show>
                                  </td>
                                  <td class="px-3 py-3 text-center text-gray-700 font-medium">
                                    {t.position}
                                  </td>
                                  <td class="px-3 py-3 text-center text-gray-600">{t.played}</td>
                                  <td class="px-3 py-3 text-center text-gray-600">{t.won}</td>
                                  <td class="px-3 py-3 text-center text-gray-600">{t.drawn}</td>
                                  <td class="px-3 py-3 text-center text-gray-600">{t.lost}</td>
                                  <td class="px-3 py-3 text-center text-gray-600">{t.goalsFor}</td>
                                  <td class="px-3 py-3 text-center text-gray-600">
                                    {t.goalsAgainst}
                                  </td>
                                  <td class="px-3 py-3 text-center text-gray-600">
                                    {t.goalsFor - t.goalsAgainst >= 0 ? '+' : ''}
                                    {t.goalsFor - t.goalsAgainst}
                                  </td>
                                  <td class="px-3 py-3 text-center font-semibold text-gray-800">
                                    {t.points}
                                  </td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Show>
                </Show>

                {/* ── Tab: Estadísticas históricas ─────────────────────── */}
                <Show when={activeTab() === 'estadisticas'}>
                  <Show
                    when={detail().topScorers.length === 0 && detail().topMinutes.length === 0 && detail().topCards.length === 0}
                  >
                    <p class="text-sm text-gray-400 text-center py-12">
                      Las estadísticas se poblarán al sincronizar competiciones con detalles de partido.
                    </p>
                  </Show>

                  <Show when={detail().topScorers.length > 0 || detail().topMinutes.length > 0 || detail().topCards.length > 0}>
                    <div class="flex flex-col gap-6">

                      {/* ── Goleadores ── */}
                      <StatsSection
                        icon="⚽"
                        title="Goleadores"
                        valueLabel="Goles"
                        seasonRows={detail().currentSeason?.topScorers ?? []}
                        historicRows={detail().topScorers}
                        seasonLabel={detail().currentSeason ? `T${detail().currentSeason!.season ?? '?'} — ${detail().currentSeason!.tournamentName}` : null}
                      />

                      {/* ── Minutos ── */}
                      <StatsSection
                        icon="⏱"
                        title="Minutos jugados"
                        valueLabel="Min"
                        seasonRows={detail().currentSeason?.topMinutes ?? []}
                        historicRows={detail().topMinutes}
                        seasonLabel={detail().currentSeason ? `T${detail().currentSeason!.season ?? '?'} — ${detail().currentSeason!.tournamentName}` : null}
                      />

                      {/* ── Tarjetas ── */}
                      <StatsSection
                        icon="🟨"
                        title="Tarjetas"
                        valueLabel="Total"
                        seasonRows={detail().currentSeason?.topCards ?? []}
                        historicRows={detail().topCards}
                        seasonLabel={detail().currentSeason ? `T${detail().currentSeason!.season ?? '?'} — ${detail().currentSeason!.tournamentName}` : null}
                        showCardDetail
                      />

                    </div>
                  </Show>
                </Show>

                {/* ── Tab: Notas de prensa ────────────────────────────── */}
                <Show when={activeTab() === 'notas'}>
                  {/* Header with create button */}
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm font-semibold text-gray-700">Notas de prensa</h2>
                    <Show when={canWriteNote()}>
                      <button
                        type="button"
                        onClick={() => setShowNoteForm((v) => !v)}
                        class="text-sm font-medium px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                      >
                        {showNoteForm() ? 'Cancelar' : '+ Nueva nota'}
                      </button>
                    </Show>
                  </div>

                  {/* Form */}
                  <Show when={showNoteForm()}>
                    <div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                      <div class="flex flex-col gap-3">
                        <input
                          type="text"
                          placeholder="Título"
                          value={noteTitle()}
                          onInput={(e) => setNoteTitle(e.currentTarget.value)}
                          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          maxLength={200}
                        />
                        <textarea
                          placeholder="Contenido de la nota..."
                          value={noteContent()}
                          onInput={(e) => setNoteContent(e.currentTarget.value)}
                          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                          rows={4}
                          maxLength={5000}
                        />
                        <Show when={noteFormError()}>
                          <p class="text-xs text-red-600">{noteFormError()}</p>
                        </Show>
                        <div class="flex justify-end">
                          <button
                            type="button"
                            onClick={submitNote}
                            disabled={noteSubmitting()}
                            class="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
                            style="background:var(--color-primary, #4f46e5)"
                          >
                            {noteSubmitting() ? 'Publicando...' : 'Publicar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Show>

                  {/* Error */}
                  <Show when={pressNotesError()}>
                    <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
                      {pressNotesError()}
                    </div>
                  </Show>

                  {/* Loading */}
                  <Show when={pressNotesLoading()}>
                    <div class="bg-white border border-gray-200 rounded-xl px-4 py-12 text-center text-sm text-gray-400">
                      Cargando notas...
                    </div>
                  </Show>

                  {/* Notes list */}
                  <Show when={!pressNotesLoading()}>
                    <Show
                      when={pressNotes().length > 0}
                      fallback={
                        <div class="bg-white border border-gray-200 rounded-xl px-4 py-16 text-center text-sm text-gray-400">
                          No hay notas de prensa publicadas todavía.
                        </div>
                      }
                    >
                      <div class="flex flex-col gap-4">
                        <For each={pressNotes()}>
                          {(note) => (
                            <div class="bg-white border border-gray-200 rounded-xl p-4">
                              <div class="flex items-start justify-between gap-3">
                                <div class="flex-1 min-w-0">
                                  <h3 class="font-semibold text-gray-900 text-sm">{note.title}</h3>
                                  <p class="text-xs text-gray-500 mt-0.5">
                                    Por {note.authorName} · {new Date(note.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                                <Show when={isOwnerOrCoOwner() || note.authorId === auth.user()?.id}>
                                  <button
                                    type="button"
                                    onClick={() => deleteNote(note.id)}
                                    class="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                                    title="Borrar nota"
                                  >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </Show>
                              </div>
                              <p class="text-sm text-gray-700 mt-3 whitespace-pre-line leading-relaxed">{note.content}</p>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </Show>
                </Show>

              </div>
            );
          }}
        </Show>
      </Show>
    </>
  );
}
