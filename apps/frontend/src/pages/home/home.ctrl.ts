import { createStore } from 'solid-js/store';

export function createHomeCtrl() {
  const [state, setState] = createStore({
    loading: false,
  });

  return { state, setState };
}
