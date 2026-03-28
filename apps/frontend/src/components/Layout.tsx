import { ErrorBoundary, onMount } from 'solid-js';
import type { RouteSectionProps } from '@solidjs/router';
import { AppLayout } from './AppLayout';
import { ErrorFallback } from './ErrorFallback';
import { useAuth } from '../context/auth.context';

export default function Layout(props: RouteSectionProps) {
  const auth = useAuth();

  onMount(() => {
    void auth.loadUser();
  });

  return (
    <AppLayout>
      <ErrorBoundary fallback={(err, reset) => <ErrorFallback error={err} reset={reset} />}>
        {props.children}
      </ErrorBoundary>
    </AppLayout>
  );
}
