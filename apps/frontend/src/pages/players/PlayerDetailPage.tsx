import { For, Show, createSignal } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { createPlayerDetailCtrl, formatMatchDate, playerFullName } from './players.ctrl';
import type { PlayerMatchStat, PlayerTeamHistoryEntry } from '../../domain/players/players.api';
import { playersApi } from '../../domain/players/players.api';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { useAuth } from '../../context/auth.context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function playerInitials(firstName: string, lastName: string): string {
  return (firstName[0] + (lastName[0] ?? '')).toUpperCase();
}

function playerColor(htPlayerId: number): string {
  const palette = [
    '#1e40af', '#7c3aed', '#b91c1c', '#065f46', '#92400e',
    '#1e3a5f', '#6b21a8', '#9f1239', '#064e3b', '#78350f',
  ];
  return palette[htPlayerId % palette.length];
}

function roleLabel(roleId: number): string {
  if (roleId === 100) return 'POR';
  if (roleId >= 101 && roleId <= 103) return 'DEF';
  if (roleId >= 104 && roleId <= 105) return 'LAT';
  if (roleId >= 106 && roleId <= 108) return 'MED';
  if (roleId >= 109 && roleId <= 110) return 'EXT';
  if (roleId >= 111 && roleId <= 113) return 'DEL';
  if (roleId >= 114) return 'SUP';
  return '—';
}

function formatRating(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(1);
}

/** Calcula stats acumuladas de un jugador en una competición concreta a partir de matchStats */
function statsForTournament(matchStats: PlayerMatchStat[], tournamentId: string) {
  const matches = matchStats.filter((m) => m.tournamentId === tournamentId);
  const goals = matches.reduce((s, m) => s + m.goals, 0);
  const assists = matches.reduce((s, m) => s + m.assists, 0);
  const minutes = matches.reduce((s, m) => s + m.minutesPlayed, 0);
  const rated = matches.filter((m) => m.ratingStars !== null);
  const avgRating = rated.length > 0 ? rated.reduce((s, m) => s + m.ratingStars!, 0) / rated.length : null;
  return { count: matches.length, goals, assists, minutes, avgRating };
}
function statsForTeam(matchStats: PlayerMatchStat[], htTeamId: number) {
  const matches = matchStats.filter((m) => m.htTeamId === htTeamId);
  const goals = matches.reduce((s, m) => s + m.goals, 0);
  const assists = matches.reduce((s, m) => s + m.assists, 0);
  const minutes = matches.reduce((s, m) => s + m.minutesPlayed, 0);
  const rated = matches.filter((m) => m.ratingStars !== null);
  const avgRating = rated.length > 0 ? rated.reduce((s, m) => s + m.ratingStars!, 0) / rated.length : null;
  return { count: matches.length, goals, assists, minutes, avgRating };
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

function StatPill(props: { label: string; value: string | number }) {
  return (
    <div class="flex flex-col items-center bg-gray-50 rounded-xl px-3 py-2.5 min-w-[72px]">
      <span class="text-lg font-bold text-gray-800 leading-none">{props.value}</span>
      <span class="text-[11px] text-gray-400 mt-1 whitespace-nowrap">{props.label}</span>
    </div>
  );
}

function RoleBadge(props: { roleId: number }) {
  const label = roleLabel(props.roleId);
  const isGk = props.roleId === 100;
  const isSub = props.roleId >= 114;
  const color = isGk
    ? 'background:#fef3c7;color:#92400e'
    : isSub
    ? 'background:#f3f4f6;color:#6b7280'
    : 'background:#eff6ff;color:#1d4ed8';
  return (
    <span
      class="inline-block text-[10px] font-semibold rounded px-1.5 py-0.5 leading-none"
      style={color}
    >
      {label}
    </span>
  );
}

function StarRating(props: { value: number | null }) {
  if (props.value === null) return <span class="text-gray-300 text-xs">—</span>;
  const v = props.value;
  const color = v >= 7 ? '#16a34a' : v >= 5 ? '#ca8a04' : '#dc2626';
  return (
    <span class="text-xs font-semibold tabular-nums" style={`color:${color}`}>
      {v.toFixed(1)}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerDetailPage() {
  const { state, setTab } = createPlayerDetailCtrl();
  const navigate = useNavigate();
  const auth = useAuth();

  const isStaff = () => {
    const role = auth.user()?.role ?? null;
    return role === 'owner' || role === 'co_owner' || role === 'admin';
  };

  // Avatar local state: null = sin cambio, string = URL subida, '__deleted__' = borrado local
  const [localAvatar, setLocalAvatar] = createSignal<string | null | '__deleted__'>(null);
  const [avatarUploading, setAvatarUploading] = createSignal(false);
  const [avatarError, setAvatarError] = createSignal<string | null>(null);

  const currentAvatarUrl = () => {
    const local = localAvatar();
    if (local === '__deleted__') return null;
    if (typeof local === 'string') return local;
    return state.data?.player.avatarUrl ?? null;
  };

  async function handleAvatarUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !state.data) return;

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const res = await playersApi.uploadAvatar(state.data.player.htPlayerId, file);
      setLocalAvatar(res.avatarUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Error al subir el avatar');
    } finally {
      setAvatarUploading(false);
      input.value = '';
    }
  }

  async function handleAvatarDelete() {
    if (!state.data) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await playersApi.deleteAvatar(state.data.player.htPlayerId);
      setLocalAvatar('__deleted__');
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Error al eliminar el avatar');
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <>
      {/* ── Breadcrumb + back ── */}
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
          <Show when={state.data}>
            {' / '}
            <span class="text-gray-600">{playerFullName(state.data!.player.firstName, state.data!.player.lastName)}</span>
          </Show>
        </div>
      </div>

      <Show
        when={!state.loading}
        fallback={
          <div class="bg-white border border-gray-200 rounded-xl px-4 py-20 text-center text-sm text-gray-400">
            Cargando jugador...
          </div>
        }
      >
        <Show when={state.error}>
          <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
            {state.error}
          </div>
        </Show>

        <Show when={state.data}>
          {(data) => {
            const player = () => data().player;
            const totals = () => data().totals;
            const color = () => playerColor(player().htPlayerId);
            const initials = () => playerInitials(player().firstName, player().lastName);

            // Posición más jugada (excluye suplentes)
            const topRole = () => {
              const counts: Record<number, number> = {};
              for (const m of data().matchStats) {
                if (m.roleId < 114) counts[m.roleId] = (counts[m.roleId] ?? 0) + 1;
              }
              const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
              return best ? Number(best[0]) : null;
            };

            // Mejor actuación (mayor rating)
            const bestMatch = () =>
              data().matchStats
                .filter((m) => m.ratingStars !== null)
                .sort((a, b) => b.ratingStars! - a.ratingStars!)[0] ?? null;

            return (
              <>
                {/* ── Header card ── */}
                <div class="bg-white border border-gray-200 rounded-xl p-5 mb-5">
                  <div class="flex items-start gap-5">
                    {/* Avatar con overlay de subida */}
                    <div class="relative group shrink-0">
                      <Show
                        when={currentAvatarUrl()}
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
                          src={currentAvatarUrl()!}
                          alt={playerFullName(player().firstName, player().lastName)}
                          class="w-20 h-20 object-contain"
                        />
                      </Show>

                      {/* Overlay staff */}
                      <Show when={isStaff()}>
                        <label
                          class="absolute inset-0 rounded-2xl flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                          title={currentAvatarUrl() ? 'Cambiar avatar' : 'Subir avatar'}
                        >
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            class="sr-only"
                            onChange={handleAvatarUpload}
                            disabled={avatarUploading()}
                          />
                          <Show
                            when={!avatarUploading()}
                            fallback={<span class="text-white text-xs">Subiendo...</span>}
                          >
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            </svg>
                          </Show>
                        </label>

                        {/* Botón borrar */}
                        <Show when={currentAvatarUrl()}>
                          <button
                            type="button"
                            onClick={handleAvatarDelete}
                            disabled={avatarUploading()}
                            class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors z-10"
                            title="Eliminar avatar"
                          >
                            <svg class="w-2.5 h-2.5 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </Show>
                      </Show>
                    </div>

                    {/* Info */}
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2">
                        <h1 class="text-xl font-bold text-gray-800 leading-tight">
                          {playerFullName(player().firstName, player().lastName)}
                        </h1>
                        <Show when={topRole() !== null}>
                          <RoleBadge roleId={topRole()!} />
                        </Show>
                      </div>

                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <Show when={player().countryCode}>
                          <span class="flex items-center gap-1 text-sm text-gray-500">
                            <CountryFlag code={player().countryCode!} size={14} />
                            {player().countryName}
                          </span>
                        </Show>
                        <Show when={player().age !== null}>
                          <span class="text-sm text-gray-400">{player().age} años</span>
                        </Show>
                        <Show when={data().teamHistory.length > 0}>
                          <A
                            href={`/equipos/${data().teamHistory[0].htTeamId}`}
                            class="text-sm text-primary hover:underline font-medium"
                          >
                            {data().teamHistory[0].teamName}
                          </A>
                        </Show>
                      </div>

                      {/* Best match highlight */}
                      <Show when={bestMatch()}>
                        {(bm) => (
                          <div class="mt-2 text-xs text-gray-400">
                            Mejor actuación{' '}
                            <span class="font-semibold" style="color:#16a34a">{bm().ratingStars!.toFixed(1)}</span>
                            {' '}vs{' '}
                            <A
                              href={`/equipos/${bm().opponentHtTeamId}`}
                              class="hover:text-primary hover:underline"
                            >
                              {bm().opponentTeamName}
                            </A>
                          </div>
                        )}
                      </Show>
                    </div>
                  </div>

                  <Show when={avatarError()}>
                    <p class="mt-3 text-xs text-red-600">{avatarError()}</p>
                  </Show>

                  {/* ── Stats grid ── */}
                  <div class="mt-5 flex flex-wrap gap-2">
                    <StatPill label="Partidos" value={totals().matches} />
                    <StatPill label="Minutos" value={totals().minutesPlayed} />
                    <StatPill label="Med. min" value={totals().avgMinutes} />
                    <StatPill label="Goles" value={totals().goals} />
                    <StatPill label="Asist." value={totals().assists} />
                    <StatPill label="Med. val." value={formatRating(totals().avgRating)} />
                    <StatPill label="Mejor val." value={formatRating(totals().bestRating)} />
                    <StatPill label="Amarillas" value={totals().yellowCards} />
                    <StatPill label="Rojas" value={totals().redCards} />
                  </div>
                </div>

                {/* ── Tabs ── */}
                <div class="border-b border-gray-200 mb-4 flex gap-0 overflow-x-auto">
                  <TabButton
                    label="Partidos"
                    active={state.activeTab === 'partidos'}
                    onClick={() => setTab('partidos')}
                    count={data().matchStats.length}
                  />
                  <TabButton
                    label="Equipos"
                    active={state.activeTab === 'equipos'}
                    onClick={() => setTab('equipos')}
                    count={data().teamHistory.length}
                  />
                  <TabButton
                    label="Competiciones"
                    active={state.activeTab === 'competiciones'}
                    onClick={() => setTab('competiciones')}
                    count={(() => {
                      const ids = new Set(data().matchStats.map((m) => m.tournamentId));
                      return ids.size;
                    })()}
                  />
                </div>

                {/* ── Tab: Partidos ── */}
                <Show when={state.activeTab === 'partidos'}>
                  <Show
                    when={data().matchStats.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-xl px-4 py-16 text-center text-sm text-gray-400">
                        Sin partidos registrados.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead>
                            <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                              <th class="text-left px-4 py-2.5 font-medium">Fecha</th>
                              <th class="text-left px-4 py-2.5 font-medium hidden md:table-cell">Competición</th>
                              <th class="text-left px-4 py-2.5 font-medium">Rival</th>
                              <th class="text-center px-2 py-2.5 font-medium">Pos</th>
                              <th class="text-center px-2 py-2.5 font-medium" title="Minutos">Min</th>
                              <th class="text-center px-2 py-2.5 font-medium" title="Goles">G</th>
                              <th class="text-center px-2 py-2.5 font-medium" title="Asistencias">A</th>
                              <th class="text-center px-2 py-2.5 font-medium hidden sm:table-cell" title="Amarillas">🟨</th>
                              <th class="text-center px-2 py-2.5 font-medium hidden sm:table-cell" title="Rojas">🟥</th>
                              <th class="text-center px-3 py-2.5 font-medium">Val.</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={data().matchStats}>
                              {(stat) => (
                                <tr
                                  class="border-b border-gray-50 last:border-0 hover:bg-primary/5 transition-colors cursor-pointer"
                                  onClick={() =>
                                    navigate(`/torneos/${stat.tournamentId}/partidos/${stat.matchId}`)
                                  }
                                >
                                  <td class="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                                    {stat.matchDate ? formatMatchDate(stat.matchDate) : '—'}
                                  </td>
                                  <td class="px-4 py-2.5 text-gray-400 text-xs hidden md:table-cell max-w-[130px] truncate">
                                    <A
                                      href={`/torneos/${stat.tournamentId}`}
                                      class="hover:text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {stat.tournamentName}
                                    </A>
                                  </td>
                                  <td class="px-4 py-2.5 text-gray-700 font-medium">
                                    <div class="flex items-center gap-1.5">
                                      <span class="text-xs text-gray-400">{stat.isHome ? 'L' : 'V'}</span>
                                      <A
                                        href={`/equipos/${stat.opponentHtTeamId}`}
                                        class="hover:text-primary hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {stat.opponentTeamName}
                                      </A>
                                    </div>
                                  </td>
                                  <td class="px-2 py-2.5 text-center">
                                    <RoleBadge roleId={stat.roleId} />
                                  </td>
                                  <td class="px-2 py-2.5 text-center text-gray-500 text-xs tabular-nums">
                                    {stat.minutesPlayed}'
                                  </td>
                                  <td class="px-2 py-2.5 text-center">
                                    <Show when={stat.goals > 0} fallback={<span class="text-gray-200">—</span>}>
                                      <span class="font-semibold text-gray-800">{stat.goals}</span>
                                    </Show>
                                  </td>
                                  <td class="px-2 py-2.5 text-center">
                                    <Show when={stat.assists > 0} fallback={<span class="text-gray-200">—</span>}>
                                      <span class="font-semibold text-gray-800">{stat.assists}</span>
                                    </Show>
                                  </td>
                                  <td class="px-2 py-2.5 text-center hidden sm:table-cell">
                                    <Show when={stat.yellowCards > 0} fallback={<span class="text-gray-200">—</span>}>
                                      <span class="font-semibold text-yellow-500">{stat.yellowCards}</span>
                                    </Show>
                                  </td>
                                  <td class="px-2 py-2.5 text-center hidden sm:table-cell">
                                    <Show when={stat.redCards > 0} fallback={<span class="text-gray-200">—</span>}>
                                      <span class="font-semibold text-red-500">{stat.redCards}</span>
                                    </Show>
                                  </td>
                                  <td class="px-3 py-2.5 text-center">
                                    <StarRating value={stat.ratingStars} />
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

                {/* ── Tab: Equipos ── */}
                <Show when={state.activeTab === 'equipos'}>
                  <Show
                    when={data().teamHistory.length > 0}
                    fallback={
                      <div class="bg-white border border-gray-200 rounded-xl px-4 py-16 text-center text-sm text-gray-400">
                        Sin historial de equipos.
                      </div>
                    }
                  >
                    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead>
                            <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                              <th class="text-left px-4 py-2.5 font-medium">Equipo</th>
                              <th class="text-center px-3 py-2.5 font-medium">PJ</th>
                              <th class="text-center px-3 py-2.5 font-medium">G</th>
                              <th class="text-center px-3 py-2.5 font-medium">A</th>
                              <th class="text-center px-3 py-2.5 font-medium">Min</th>
                              <th class="text-center px-3 py-2.5 font-medium">Val. med.</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={data().teamHistory}>
                              {(entry) => {
                                const ts = statsForTeam(data().matchStats, entry.htTeamId);
                                return (
                                  <tr class="border-b border-gray-50 last:border-0 hover:bg-primary/5 transition-colors">
                                    <td class="px-4 py-3">
                                      <A
                                        href={`/equipos/${entry.htTeamId}`}
                                        class="flex items-center gap-3 group"
                                      >
                                        {/* Logo o iniciales */}
                                        <Show
                                          when={entry.logoUrl}
                                          fallback={
                                            <div
                                              class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                                              style={`background:${playerColor(entry.htTeamId)}`}
                                            >
                                              {entry.teamName.slice(0, 2).toUpperCase()}
                                            </div>
                                          }
                                        >
                                          <img
                                            src={entry.logoUrl!}
                                            alt={`Escudo de ${entry.teamName}`}
                                            class="w-8 h-8 object-contain shrink-0"
                                          />
                                        </Show>
                                        <span class="font-medium text-gray-800 group-hover:text-primary transition-colors">
                                          {entry.teamName}
                                        </span>
                                      </A>
                                    </td>
                                    <td class="px-3 py-3 text-center font-semibold text-gray-700 tabular-nums">
                                      {ts.count}
                                    </td>
                                    <td class="px-3 py-3 text-center tabular-nums">
                                      <Show when={ts.goals > 0} fallback={<span class="text-gray-300">—</span>}>
                                        <span class="font-semibold text-gray-700">{ts.goals}</span>
                                      </Show>
                                    </td>
                                    <td class="px-3 py-3 text-center tabular-nums">
                                      <Show when={ts.assists > 0} fallback={<span class="text-gray-300">—</span>}>
                                        <span class="font-semibold text-gray-700">{ts.assists}</span>
                                      </Show>
                                    </td>
                                    <td class="px-3 py-3 text-center text-gray-500 tabular-nums text-xs">
                                      {ts.minutes}'
                                    </td>
                                    <td class="px-3 py-3 text-center tabular-nums">
                                      <Show when={ts.avgRating !== null} fallback={<span class="text-gray-300">—</span>}>
                                        <StarRating value={ts.avgRating} />
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
                {/* ── Tab: Competiciones ── */}
                <Show when={state.activeTab === 'competiciones'}>
                  {(() => {
                    // Deduplica torneos manteniendo el nombre, ordenados por más reciente
                    const tournaments = () => {
                      const seen = new Map<string, string>();
                      for (const m of data().matchStats) {
                        if (!seen.has(m.tournamentId)) seen.set(m.tournamentId, m.tournamentName);
                      }
                      return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
                    };
                    return (
                      <Show
                        when={tournaments().length > 0}
                        fallback={
                          <div class="bg-white border border-gray-200 rounded-xl px-4 py-16 text-center text-sm text-gray-400">
                            Sin competiciones registradas.
                          </div>
                        }
                      >
                        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                              <thead>
                                <tr class="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                                  <th class="text-left px-4 py-2.5 font-medium">Competición</th>
                                  <th class="text-center px-3 py-2.5 font-medium">PJ</th>
                                  <th class="text-center px-3 py-2.5 font-medium">G</th>
                                  <th class="text-center px-3 py-2.5 font-medium">A</th>
                                  <th class="text-center px-3 py-2.5 font-medium">Min</th>
                                  <th class="text-center px-3 py-2.5 font-medium">Val. med.</th>
                                </tr>
                              </thead>
                              <tbody>
                                <For each={tournaments()}>
                                  {(t) => {
                                    const ts = statsForTournament(data().matchStats, t.id);
                                    return (
                                      <tr class="border-b border-gray-50 last:border-0 hover:bg-primary/5 transition-colors">
                                        <td class="px-4 py-3">
                                          <A
                                            href={`/torneos/${t.id}`}
                                            class="font-medium text-gray-800 hover:text-primary transition-colors"
                                          >
                                            {t.name}
                                          </A>
                                        </td>
                                        <td class="px-3 py-3 text-center font-semibold text-gray-700 tabular-nums">
                                          {ts.count}
                                        </td>
                                        <td class="px-3 py-3 text-center tabular-nums">
                                          <Show when={ts.goals > 0} fallback={<span class="text-gray-300">—</span>}>
                                            <span class="font-semibold text-gray-700">{ts.goals}</span>
                                          </Show>
                                        </td>
                                        <td class="px-3 py-3 text-center tabular-nums">
                                          <Show when={ts.assists > 0} fallback={<span class="text-gray-300">—</span>}>
                                            <span class="font-semibold text-gray-700">{ts.assists}</span>
                                          </Show>
                                        </td>
                                        <td class="px-3 py-3 text-center text-gray-500 tabular-nums text-xs">
                                          {ts.minutes}'
                                        </td>
                                        <td class="px-3 py-3 text-center tabular-nums">
                                          <Show when={ts.avgRating !== null} fallback={<span class="text-gray-300">—</span>}>
                                            <StarRating value={ts.avgRating} />
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
                    );
                  })()}
                </Show>

              </>
            );
          }}
        </Show>
      </Show>
    </>
  );
}
