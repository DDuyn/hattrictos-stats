import { For } from 'solid-js';
import { useToast } from '../context/toast.context';
import { ToastItem } from './ui/Toast';

export function ToastContainer() {
  const toast = useToast();

  return (
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
      <For each={toast.toasts()}>
        {(t) => <ToastItem toast={t} onDismiss={toast.dismiss} />}
      </For>
    </div>
  );
}
