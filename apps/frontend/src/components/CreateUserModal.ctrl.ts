import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { createUserInputSchema, type CreateUserResponse, type UserRole } from '@hattrictos-stats/shared';
import { authApi } from '../domain/auth/auth.api';

type Phase = 'form' | 'done';

export function createCreateUserModalCtrl(onCreated?: () => void) {
  const [phase, setPhase] = createSignal<Phase>('form');
  const [created, setCreated] = createSignal<CreateUserResponse | null>(null);
  const [form, setForm] = createStore({
    email: '',
    role: null as UserRole | null,
    error: '',
    loading: false,
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const parsed = createUserInputSchema.safeParse({ email: form.email, role: form.role });
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

  return { phase, created, form, setForm, handleSubmit };
}
