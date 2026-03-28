import type { JSX } from 'solid-js';

interface InputProps {
  label?: string;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  class?: string;
}

export function Input(props: InputProps) {
  const inputClasses = () =>
    [
      'w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm transition-colors',
      'focus:outline-none focus:bg-white focus:ring-2',
      props.error
        ? 'border-danger focus:ring-danger/30 text-danger placeholder:text-danger/50'
        : 'border-gray-200 focus:ring-primary/30 focus:border-primary',
      props.class ?? '',
    ].join(' ');

  return (
    <div class="flex flex-col gap-1">
      {props.label && (
        <label class="text-sm font-medium text-gray-700">{props.label}</label>
      )}
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder={props.placeholder}
        class={inputClasses()}
      />
      {props.error && (
        <p class="text-xs text-danger">{props.error}</p>
      )}
    </div>
  );
}
