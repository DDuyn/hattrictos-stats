import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAuth } from '../context/auth.context';
import { clearToken } from '../lib/api-client';
import { LoginModal } from './LoginModal';
import { CreateUserModal } from './CreateUserModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { chppApi } from '../domain/chpp/chpp.api';

export function Navbar() {
  const { user, clearUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [loginOpen, setLoginOpen] = createSignal(false);
  const [addUserOpen, setAddUserOpen] = createSignal(false);
  const [changePasswordOpen, setChangePasswordOpen] = createSignal(false);
  const [connectingChpp, setConnectingChpp] = createSignal(false);

  const isOwner = () => user()?.role === 'owner';

  async function handleChppConnect() {
    setMenuOpen(false);
    setConnectingChpp(true);
    try {
      const { authorizeUrl } = await chppApi.connect();
      window.location.href = authorizeUrl;
    } catch {
      setConnectingChpp(false);
    }
  }

  function handleUnauthorized() {
    clearUser();
    setMenuOpen(false);
    setLoginOpen(true);
  }

  onMount(() => {
    window.addEventListener('auth:unauthorized', handleUnauthorized);
  });

  onCleanup(() => {
    window.removeEventListener('auth:unauthorized', handleUnauthorized);
  });

  function handleLogout() {
    clearToken();
    clearUser();
    setMenuOpen(false);
    navigate('/', { replace: true });
  }

  function avatarInitial() {
    const email = user()?.email ?? '';
    return email.charAt(0).toUpperCase() || '?';
  }

  const canCreateUsers = () => {
    const role = user()?.role;
    return role === 'owner' || role === 'co_owner';
  };

  return (
    <>
      <header class="fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-gray-100 flex items-center px-4">
        <A href="/" class="text-base font-semibold text-gray-900 tracking-tight select-none">
          Hattrictos
        </A>

        <div class="ml-auto relative">
          {/* Authenticated: avatar + dropdown */}
          <Show
            when={user()}
            fallback={
              /* Not authenticated: discreet lock icon */
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Sign in"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </button>
            }
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              class="w-8 h-8 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center hover:bg-primary-hover transition-colors cursor-pointer select-none"
              aria-label="User menu"
            >
              {avatarInitial()}
            </button>

            <Show when={menuOpen()}>
              {/* Overlay to close on outside click */}
              <div
                class="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />

              <div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-1">
                {/* User email */}
                <div class="px-4 py-3 border-b border-gray-100">
                  <p class="text-xs text-gray-400 mb-0.5">Signed in as</p>
                  <p class="text-sm font-medium text-gray-900 truncate">
                    {user()?.email ?? '—'}
                  </p>
                </div>

                {/* Actions */}
                <A
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Profile
                </A>

                {/* Add user — owner / co_owner only */}
                <Show when={canCreateUsers()}>
                  <A
                    href="/admin/usuarios"
                    onClick={() => setMenuOpen(false)}
                    class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                    Usuarios
                  </A>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setAddUserOpen(true); }}
                    class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                    </svg>
                    Add user
                  </button>
                </Show>

                <div class="border-t border-gray-100 mt-1 pt-1">
                  {/* Hattrick connect — owner only */}
                  <Show when={isOwner()}>
                    <button
                      type="button"
                      onClick={handleChppConnect}
                      disabled={connectingChpp()}
                      class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                      </svg>
                      {connectingChpp() ? 'Redirigiendo...' : 'Conectar Hattrick'}
                    </button>
                  </Show>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setChangePasswordOpen(true); }}
                    class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                    </svg>
                    Change password
                  </button>

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
              </div>
            </Show>
          </Show>
        </div>
      </header>

      <Show when={loginOpen()}>
        <LoginModal onClose={() => setLoginOpen(false)} />
      </Show>

      <Show when={addUserOpen()}>
        <CreateUserModal onClose={() => setAddUserOpen(false)} />
      </Show>

      <Show when={changePasswordOpen()}>
        <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />
      </Show>
    </>
  );
}
