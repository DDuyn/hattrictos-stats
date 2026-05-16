import { For, Show, createMemo, createSignal } from 'solid-js';
import type { UserRole } from '@hattrictos-stats/shared';
import { createAdminUsersCtrl } from './AdminUsers.ctrl';
import { CreateUserModal } from '../../components/CreateUserModal';
import type { UserListItem } from '../../domain/auth/auth.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleBadge(role: string | null) {
  if (!role) {
    return (
      <span class="inline-block text-xs rounded px-1.5 py-0.5 bg-gray-100 text-gray-400">
        sin rol
      </span>
    );
  }
  const styles: Record<string, string> = {
    owner: 'bg-violet-100 text-violet-700',
    co_owner: 'bg-blue-100 text-blue-700',
    admin: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      class={`inline-block text-xs font-medium rounded px-1.5 py-0.5 ${styles[role] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {role}
    </span>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditUserModal(props: {
  user: UserListItem;
  role: UserRole | null;
  htTeamId: number | null;
  saving: boolean;
  error: string;
  teams: { htTeamId: number; name: string }[];
  onChangeRole: (role: UserRole | null) => void;
  onChangeTeam: (htTeamId: number | null) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  // Team combobox state
  const initialName = () =>
    props.htTeamId !== null
      ? (props.teams.find((t) => t.htTeamId === props.htTeamId)?.name ?? '')
      : '';

  const [teamQuery, setTeamQuery] = createSignal(initialName());
  const [comboOpen, setComboOpen] = createSignal(false);

  const filteredTeams = createMemo(() => {
    const q = teamQuery().toLowerCase().trim();
    if (!q) return props.teams;
    return props.teams.filter((t) => t.name.toLowerCase().includes(q));
  });

  function selectTeam(htTeamId: number, name: string) {
    props.onChangeTeam(htTeamId);
    setTeamQuery(name);
    setComboOpen(false);
  }

  function clearTeam() {
    props.onChangeTeam(null);
    setTeamQuery('');
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        {/* Header */}
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Editar usuario</h2>
            <p class="text-xs text-gray-400 mt-0.5 truncate max-w-[16rem]">{props.user.email}</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          {/* Role selector */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              value={props.role ?? ''}
              onChange={(e) => {
                const v = e.currentTarget.value;
                props.onChangeRole(v === '' ? null : (v as UserRole));
              }}
            >
              <option value="">— sin rol —</option>
              <option value="admin">admin</option>
              <option value="co_owner">co_owner</option>
              <option value="owner">owner</option>
            </select>
          </div>

          {/* Team combobox */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Equipo redactor</label>
            <div class="relative">
              <div class="flex items-center gap-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition bg-white">
                <input
                  type="text"
                  class="flex-1 outline-none bg-transparent text-gray-900 placeholder:text-gray-400 min-w-0"
                  placeholder="Buscar equipo..."
                  value={teamQuery()}
                  onInput={(e) => {
                    setTeamQuery(e.currentTarget.value);
                    props.onChangeTeam(null);
                    setComboOpen(true);
                  }}
                  onFocus={() => setComboOpen(true)}
                  onBlur={() => setTimeout(() => setComboOpen(false), 150)}
                />
                <Show when={props.htTeamId !== null || teamQuery()}>
                  <button
                    type="button"
                    onClick={clearTeam}
                    class="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                    tabIndex={-1}
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Show>
              </div>

              <Show when={comboOpen() && filteredTeams().length > 0}>
                <ul class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
                  <Show when={teamQuery().trim() === ''}>
                    <li
                      class="px-3 py-2 text-sm text-gray-400 cursor-pointer hover:bg-gray-50"
                      onMouseDown={clearTeam}
                    >
                      — Ninguno —
                    </li>
                  </Show>
                  <For each={filteredTeams()}>
                    {(team) => (
                      <li
                        class={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                          props.htTeamId === team.htTeamId
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-gray-800 hover:bg-gray-50'
                        }`}
                        onMouseDown={() => selectTeam(team.htTeamId, team.name)}
                      >
                        {team.name}
                      </li>
                    )}
                  </For>
                </ul>
              </Show>

              <Show when={comboOpen() && teamQuery().trim() !== '' && filteredTeams().length === 0}>
                <div class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                  Sin resultados
                </div>
              </Show>
            </div>
            <p class="text-xs text-gray-400 mt-1">Equipo del que este usuario puede escribir notas de prensa.</p>
          </div>

          <Show when={props.error}>
            <p class="text-xs text-danger">{props.error}</p>
          </Show>

          <div class="flex gap-3 pt-1">
            <button
              type="button"
              onClick={props.onClose}
              class="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={props.onSave}
              disabled={props.saving}
              class="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {props.saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const ctrl = createAdminUsersCtrl();

  return (
    <>
      <div class="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Gestión de usuarios</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Administra roles y equipos de redactor de los usuarios registrados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => ctrl.setAddUserOpen(true)}
          class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          Crear usuario
        </button>
      </div>

      {/* Error de carga */}
      <Show when={ctrl.loadError()}>
        <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-6">
          {ctrl.loadError()}
        </div>
      </Show>

      {/* Tabla de usuarios */}
      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <Show
          when={!ctrl.loading()}
          fallback={
            <div class="px-4 py-12 text-center text-sm text-gray-400">Cargando usuarios...</div>
          }
        >
          <Show
            when={ctrl.users().length > 0}
            fallback={
              <div class="px-4 py-12 text-center text-sm text-gray-400">
                No hay usuarios registrados.
              </div>
            }
          >
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-100 bg-gray-50">
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Usuario
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Rol
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                      Equipo redactor
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <For each={ctrl.users()}>
                    {(user) => {
                      const teamName = () =>
                        user.htTeamId !== null
                          ? (ctrl.teams().find((t) => t.htTeamId === user.htTeamId)?.name ?? `#${user.htTeamId}`)
                          : null;

                      return (
                        <tr class="hover:bg-gray-50 transition-colors">
                          <td class="px-4 py-3">
                            <p class="font-medium text-gray-900">{user.name}</p>
                            <p class="text-xs text-gray-400 truncate max-w-[12rem]">{user.email}</p>
                          </td>
                          <td class="px-4 py-3">
                            {roleBadge(user.role)}
                          </td>
                          <td class="px-4 py-3 hidden sm:table-cell text-gray-600">
                            <Show when={teamName()} fallback={<span class="text-gray-300">—</span>}>
                              {teamName()}
                            </Show>
                          </td>
                          <td class="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => ctrl.openEdit(user)}
                              class="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </div>

      {/* Modal edición */}
      <Show when={ctrl.editing()}>
        {(e) => {
          const user = () => ctrl.users().find((u) => u.id === e().userId)!;
          return (
            <EditUserModal
              user={user()}
              role={e().role}
              htTeamId={e().htTeamId}
              saving={e().saving}
              error={e().error}
              teams={ctrl.teams()}
              onChangeRole={(role) => ctrl.patchEditing({ role })}
              onChangeTeam={(htTeamId) => ctrl.patchEditing({ htTeamId })}
              onSave={ctrl.saveEdit}
              onClose={ctrl.closeEdit}
            />
          );
        }}
      </Show>

      {/* Modal crear usuario */}
      <Show when={ctrl.addUserOpen()}>
        <CreateUserModal
          onClose={() => ctrl.setAddUserOpen(false)}
          onCreated={ctrl.reload}
        />
      </Show>
    </>
  );
}
