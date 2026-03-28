import { Show, onMount } from 'solid-js';
import { ErrorBoundary } from 'solid-js';
import { useLocation } from '@solidjs/router';
import type { RouteSectionProps } from '@solidjs/router';
import { AppLayout } from './AppLayout';
import { ErrorFallback } from './ErrorFallback';
import { useAuth } from '../context/auth.context';

export default function Layout(props: RouteSectionProps) {
  const location = useLocation();
  const auth = useAuth();

  onMount(() => {
    if (location.pathname !== '/login') {
      void auth.loadUser();
    }
  });

  return (
    <Show
      when={location.pathname !== '/login'}
      fallback={
        <ErrorBoundary fallback={(err, reset) => <ErrorFallback error={err} reset={reset} />}>
          {props.children}
        </ErrorBoundary>
      }
    >
      <AppLayout>
        <ErrorBoundary fallback={(err, reset) => <ErrorFallback error={err} reset={reset} />}>
          {props.children}
        </ErrorBoundary>
      </AppLayout>
    </Show>
  );
}
