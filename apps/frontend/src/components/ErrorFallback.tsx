import type { JSX } from 'solid-js';

interface ErrorFallbackProps {
  error: unknown;
  reset: () => void;
}

export function ErrorFallback(props: ErrorFallbackProps): JSX.Element {
  const message = () => {
    const e = props.error;
    if (e instanceof Error) return e.message;
    if (typeof e === 'string') return e;
    return 'An unexpected error occurred.';
  };

  return (
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="max-w-md w-full bg-white border border-danger-light rounded-xl p-8 shadow-sm text-center">
        <div class="flex justify-center mb-4">
          <div class="w-12 h-12 rounded-full bg-danger-light flex items-center justify-center">
            <svg
              class="w-6 h-6 text-danger"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
        </div>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p class="text-sm text-gray-500 mb-6 break-words">{message()}</p>
        <button
          type="button"
          onClick={props.reset}
          class="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          Try again
        </button>
      </div>
    </div>
  );
}
