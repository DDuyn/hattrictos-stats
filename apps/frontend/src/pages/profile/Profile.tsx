import { Show } from 'solid-js';
import { createProfileCtrl } from './profile.ctrl';

export default function Profile() {
  const ctrl = createProfileCtrl();

  return (
    <div class="max-w-md">
      <h1 class="text-2xl font-semibold text-gray-900 mb-1">Profile</h1>
      <p class="text-sm text-gray-500 mb-8">Your account details</p>

      <Show
        when={!ctrl.loading()}
        fallback={<p class="text-gray-400 text-sm">Loading...</p>}
      >
        <Show
          when={ctrl.user()}
          fallback={<p class="text-gray-400 text-sm">No user data available.</p>}
        >
          {(user) => (
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              <div class="px-5 py-4">
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Name</p>
                <p class="text-sm font-medium text-gray-900">{user().name}</p>
              </div>
              <div class="px-5 py-4">
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                <p class="text-sm font-medium text-gray-900">{user().email}</p>
              </div>
              <div class="px-5 py-4">
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">User ID</p>
                <p class="text-sm font-mono text-gray-500">{user().id}</p>
              </div>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
}
