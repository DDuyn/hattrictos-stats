import { createContext, useContext, createSignal, type ParentProps } from 'solid-js';
import { ToastContainer } from '../components/ToastContainer';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
  toasts: () => Toast[];
}

const ToastContext = createContext<ToastContextValue>();

const DEFAULT_DURATION = 4000;

export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createSignal<Toast[]>([]);

  function add(message: string, variant: ToastVariant, duration: number) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), duration);
  }

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const value: ToastContextValue = {
    success: (msg, duration = DEFAULT_DURATION) => add(msg, 'success', duration),
    error: (msg, duration = DEFAULT_DURATION) => add(msg, 'error', duration),
    warning: (msg, duration = DEFAULT_DURATION) => add(msg, 'warning', duration),
    info: (msg, duration = DEFAULT_DURATION) => add(msg, 'info', duration),
    dismiss,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
