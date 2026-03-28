import { createStore } from 'solid-js/store';
import type { Navigator } from '@solidjs/router';
import { setToken } from '../../lib/api-client';
import { login, register } from '../../domain/auth/auth.service';
import type { FieldErrors } from '../../domain/validation';
import type { useToast } from '../../context/toast.context';

export function createLoginCtrl(
  navigate: Navigator,
  loadUser: () => Promise<void>,
  toast: ReturnType<typeof useToast>,
) {
  const [state, setState] = createStore({
    email: '',
    password: '',
    name: '',
    isRegister: false,
    errors: {} as FieldErrors,
    loading: false,
  });

  function toggleMode() {
    setState({ isRegister: !state.isRegister, errors: {} });
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setState({ errors: {}, loading: true });

    const result = state.isRegister
      ? await register(state.email, state.password, state.name)
      : await login(state.email, state.password);

    if (!result.ok) {
      if ('fieldErrors' in result) {
        setState({ errors: result.fieldErrors, loading: false });
      } else {
        toast.error(result.error.message);
        setState('loading', false);
      }
      return;
    }

    setToken(result.value.token);
    await loadUser();
    setState('loading', false);
    navigate('/', { replace: true });
  }

  return { state, setState, toggleMode, handleSubmit };
}
