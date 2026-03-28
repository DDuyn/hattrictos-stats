import { createStore } from 'solid-js/store';
import type { Navigator } from '@solidjs/router';
import { isAuthenticated } from '../../lib/api-client';

export function createHomeCtrl(navigate: Navigator) {
  const [state, setState] = createStore({ loading: true });

  async function init() {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    setState('loading', false);
  }

  return { state, init };
}
