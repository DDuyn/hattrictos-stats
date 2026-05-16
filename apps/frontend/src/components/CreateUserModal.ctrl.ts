import { createSignal, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { createUserInputSchema, type CreateUserResponse, type UserRole } from '@hattrictos-stats/shared';
import { authApi } from '../domain/auth/auth.api';
import { teamsApi, type TeamWithTournaments } from '../domain/teams/teams.api';

type Phase = 'form' | 'done';

export function createCreateUserModalCtrl(onCreated?: () => void) {
  const [phase, setPhase] = createSignal<Phase>('form');
  const [created, setCreated] = createSignal<CreateUserResponse | null>(null);
  const [teams, setTeams] = createSignal<TeamWithTournaments[]>([]);
  const [form, setForm] = createStore({
    email: '',
    role: null as UserRole | null,
    htTeamId: null as number | null,
    error: '',
    loading: false,
  });

  onMount(async () => {
    try {
      const list = await teamsApi.list();
      setTeams(list);
    } catch {
      // non-blocking — team selector will just be empty
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const parsed = createUserInputSchema.safeParse({
      email: form.email,
      role: form.role,
      htTeamId: form.htTeamId,
    });
    if (!parsed.success) {
      setForm('error', parsed.error.issues[0].message);
      return;
    }

    setForm({ loading: true, error: '' });

    try {
      const result = await authApi.createUser(parsed.data);
      setCreated(result);
      setPhase('done');
      onCreated?.();
    } catch (err) {
      setForm({
        error: err instanceof Error ? err.message : 'Something went wrong',
        loading: false,
      });
    }
  }

  return { phase, created, teams, form, setForm, handleSubmit };
}
