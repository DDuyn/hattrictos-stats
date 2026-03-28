import { useNavigate } from '@solidjs/router';
import { createLoginCtrl } from './login.ctrl';
import { useAuth } from '../../context/auth.context';
import { useToast } from '../../context/toast.context';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function AdminLogin() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();
  const ctrl = createLoginCtrl(navigate, auth.loadUser, toast);

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Admin access</h1>
          <p class="text-sm text-gray-500 mt-1">Sign in to manage the app</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={ctrl.handleSubmit} noValidate class="space-y-5">
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
              placeholder="At least 8 characters"
              error={ctrl.state.errors.password}
            />
            <Button type="submit" disabled={ctrl.state.loading} class="w-full mt-2">
              {ctrl.state.loading ? 'Please wait...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
