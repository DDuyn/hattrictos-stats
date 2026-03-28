import { Show, createSignal } from 'solid-js';
import { createCreateUserModalCtrl } from './CreateUserModal.ctrl';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface CreateUserModalProps {
  onClose: () => void;
}

export function CreateUserModal(props: CreateUserModalProps) {
  const ctrl = createCreateUserModalCtrl();
  const [copied, setCopied] = createSignal(false);

  function handleCopy() {
    const pwd = ctrl.created()?.generatedPassword;
    if (!pwd) return;
    void navigator.clipboard.writeText(pwd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        {/* Header */}
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900">Add user</h2>
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

        {/* Phase: form */}
        <Show when={ctrl.phase() === 'form'}>
          <form onSubmit={ctrl.handleSubmit} noValidate class="space-y-4">
            <Input
              label="Email"
              type="email"
              value={ctrl.form.email}
              onInput={(v) => ctrl.setForm('email', v)}
              placeholder="user@example.com"
            />

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                value={ctrl.form.role ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  ctrl.setForm('role', v === '' ? null : (v as 'owner' | 'co_owner' | 'admin'));
                }}
              >
                <option value="">— no role —</option>
                <option value="admin">admin</option>
                <option value="co_owner">co_owner</option>
                <option value="owner">owner</option>
              </select>
            </div>

            <Show when={ctrl.form.error}>
              <p class="text-xs text-danger">{ctrl.form.error}</p>
            </Show>

            <Button type="submit" disabled={ctrl.form.loading} class="w-full mt-1">
              {ctrl.form.loading ? 'Creating...' : 'Create user'}
            </Button>
          </form>
        </Show>

        {/* Phase: done */}
        <Show when={ctrl.phase() === 'done' && ctrl.created()}>
          {(result) => (
            <div class="space-y-4">
              <div class="flex items-center gap-2 text-green-600 mb-2">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span class="text-sm font-medium">User created successfully</span>
              </div>

              <div>
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                <p class="text-sm font-medium text-gray-900">{result().user.email}</p>
              </div>

              <div>
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Generated password</p>
                <div class="flex items-center gap-2 mt-1">
                  <code class="flex-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 truncate">
                    {result().generatedPassword}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    class="flex-shrink-0 p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    aria-label="Copy password"
                  >
                    <Show
                      when={copied()}
                      fallback={
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                        </svg>
                      }
                    >
                      <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </Show>
                  </button>
                </div>
                <p class="text-xs text-gray-400 mt-1.5">Share this password with the user. It won't be shown again.</p>
              </div>

              <Button type="button" onClick={props.onClose} class="w-full mt-2">
                Close
              </Button>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
