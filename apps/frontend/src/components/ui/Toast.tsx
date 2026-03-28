import type { JSX } from 'solid-js';
import type { Toast, ToastVariant } from '../../context/toast.context';

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: JSX.Element }> = {
  success: {
    container: 'bg-success-light border-success text-success-hover',
    icon: (
      <svg class="w-5 h-5 shrink-0 text-success" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  error: {
    container: 'bg-danger-light border-danger text-danger-hover',
    icon: (
      <svg class="w-5 h-5 shrink-0 text-danger" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    ),
  },
  warning: {
    container: 'bg-warning-light border-warning text-warning-hover',
    icon: (
      <svg class="w-5 h-5 shrink-0 text-warning" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
  info: {
    container: 'bg-info-light border-info text-info-hover',
    icon: (
      <svg class="w-5 h-5 shrink-0 text-info" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
  },
};

export function ToastItem(props: ToastProps) {
  const styles = () => VARIANT_STYLES[props.toast.variant];

  return (
    <div
      class={`flex items-start gap-3 w-80 border rounded-lg px-4 py-3 shadow-md text-sm font-medium ${styles().container}`}
      role="alert"
    >
      {styles().icon}
      <span class="flex-1 leading-snug">{props.toast.message}</span>
      <button
        type="button"
        onClick={() => props.onDismiss(props.toast.id)}
        class="shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Dismiss"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
