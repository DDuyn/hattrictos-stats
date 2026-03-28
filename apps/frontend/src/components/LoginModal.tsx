import { createLoginModalCtrl } from './LoginModal.ctrl';
import { useAuth } from '../context/auth.context';
import { useToast } from '../context/toast.context';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface LoginModalProps {
  onClose: () => void;
}

export function LoginModal(props: LoginModalProps) {
  const auth = useAuth();
  const toast = useToast();
  const ctrl = createLoginModalCtrl(auth.loadUser, toast, props.onClose);

  return (
    /* Backdrop */
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900">Sign in</h2>
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
            label="Email"
            type="email"
            value={ctrl.state.email}
            onInput={(v) => ctrl.setState('email', v)}
            placeholder="you@example.com"
            error={ctrl.state.errors.email}
          />
          <Input
            label="Password"
            type="password"
            value={ctrl.state.password}
            onInput={(v) => ctrl.setState('password', v)}
            placeholder="Your password"
            error={ctrl.state.errors.password}
          />
          <Button type="submit" disabled={ctrl.state.loading} class="w-full mt-1">
            {ctrl.state.loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
