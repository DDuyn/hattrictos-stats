import { createSignal, onMount } from 'solid-js';
import type { UserRole } from '@hattrictos-stats/shared';
import { authApi, type UserListItem } from '../../domain/auth/auth.api';
import { teamsApi, type TeamWithTournaments } from '../../domain/teams/teams.api';

export interface EditingState {
  userId: string;
  role: UserRole | null;
  htTeamId: number | null;
  saving: boolean;
  error: string;
}

export function createAdminUsersCtrl() {
  const [users, setUsers] = createSignal<UserListItem[]>([]);
  const [teams, setTeams] = createSignal<TeamWithTournaments[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal('');
  const [editing, setEditing] = createSignal<EditingState | null>(null);
  const [addUserOpen, setAddUserOpen] = createSignal(false);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [userList, teamList] = await Promise.all([
        authApi.listUsers(),
        teamsApi.list(),
      ]);
      setUsers(userList);
      setTeams(teamList);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }

  onMount(load);

  function openEdit(user: UserListItem) {
    setEditing({
      userId: user.id,
      role: user.role as UserRole | null,
      htTeamId: user.htTeamId,
      saving: false,
      error: '',
    });
  }

  function closeEdit() {
    setEditing(null);
  }

  function patchEditing(patch: Partial<EditingState>) {
    setEditing((prev) => (prev ? { ...prev, ...patch } : null));
  }

  async function saveEdit() {
    const e = editing();
    if (!e) return;
    patchEditing({ saving: true, error: '' });
    try {
      const updated = await authApi.updateUser(e.userId, {
        role: e.role,
        htTeamId: e.htTeamId,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      closeEdit();
    } catch (err) {
      patchEditing({
        saving: false,
        error: err instanceof Error ? err.message : 'Error al guardar',
      });
    }
  }

  return {
    users,
    teams,
    loading,
    loadError,
    editing,
    patchEditing,
    openEdit,
    closeEdit,
    saveEdit,
    addUserOpen,
    setAddUserOpen,
    reload: load,
  };
}
