import { createSignal, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAuth } from '../context/auth.context';
import { clearToken } from '../lib/api-client';

export function Navbar() {
  const { user, clearUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);

  function handleLogout() {
    clearToken();
    clearUser();
    navigate('/login', { replace: true });
  }

  function avatarInitial() {
    const email = user()?.email ?? '';
    return email.charAt(0).toUpperCase() || '?';
  }

  return (
    <header class="fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-gray-100 flex items-center px-4">
      <A href="/" class="text-base font-semibold text-gray-900 tracking-tight select-none">
        App
      </A>

      <div class="ml-auto relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          class="w-8 h-8 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center hover:bg-primary-hover transition-colors cursor-pointer select-none"
          aria-label="User menu"
        >
          {avatarInitial()}
        </button>

        <Show when={open()}>
          {/* Overlay para cerrar al clickear fuera */}
          <div
            class="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          <div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-1">
            {/* Email del usuario */}
            <div class="px-4 py-3 border-b border-gray-100">
              <p class="text-xs text-gray-400 mb-0.5">Signed in as</p>
              <p class="text-sm font-medium text-gray-900 truncate">
                {user()?.email ?? '—'}
              </p>
            </div>

            {/* Acciones */}
            <A
              href="/profile"
              onClick={() => setOpen(false)}
              class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Profile
            </A>

            <button
              type="button"
              onClick={handleLogout}
              class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        </Show>
      </div>
    </header>
  );
}
