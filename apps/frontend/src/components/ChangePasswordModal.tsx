import { Show } from 'solid-js';
import { createChangePasswordModalCtrl } from './ChangePasswordModal.ctrl';
import { useToast } from '../context/toast.context';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal(props: ChangePasswordModalProps) {
  const toast = useToast();
  const ctrl = createChangePasswordModalCtrl(toast, props.onClose);

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900">Change password</h2>
          <button
            type="button"
            onClick={props.onClose}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={ctrl.handleSubmit} noValidate class="space-y-4">
          <Input
            label="Current password"
            type="password"
            value={ctrl.form.currentPassword}
            onInput={(v) => ctrl.setForm('currentPassword', v)}
            placeholder="Your current password"
          />
          <Input
            label="New password"
            type="password"
            value={ctrl.form.newPassword}
            onInput={(v) => ctrl.setForm('newPassword', v)}
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={ctrl.form.confirmPassword}
            onInput={(v) => ctrl.setForm('confirmPassword', v)}
            placeholder="Repeat new password"
          />

          <Show when={ctrl.form.error}>
            <p class="text-xs text-danger">{ctrl.form.error}</p>
          </Show>

          <Button type="submit" disabled={ctrl.form.loading} class="w-full mt-1">
            {ctrl.form.loading ? 'Saving...' : 'Change password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
