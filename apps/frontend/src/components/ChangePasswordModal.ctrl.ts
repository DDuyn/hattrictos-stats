import { createStore } from 'solid-js/store';
import { changePasswordInputSchema } from '@hattrictos-stats/shared';
import { authApi } from '../domain/auth/auth.api';
import type { useToast } from '../context/toast.context';

export function createChangePasswordModalCtrl(
  toast: ReturnType<typeof useToast>,
  onSuccess: () => void,
) {
  const [form, setForm] = createStore({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    error: '',
    loading: false,
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setForm({ error: '', loading: true });

    if (form.newPassword !== form.confirmPassword) {
      setForm({ error: 'Passwords do not match', loading: false });
      return;
    }

    const parsed = changePasswordInputSchema.safeParse({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    if (!parsed.success) {
      setForm({ error: parsed.error.issues[0].message, loading: false });
      return;
    }

    try {
      await authApi.changePassword(parsed.data);
      toast.success('Password changed successfully');
      onSuccess();
    } catch (err) {
      setForm({
        error: err instanceof Error ? err.message : 'Something went wrong',
        loading: false,
      });
    }
  }

  return { form, setForm, handleSubmit };
}
