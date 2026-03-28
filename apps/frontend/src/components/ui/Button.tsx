import type { JSX } from 'solid-js';

interface ButtonProps {
  children: JSX.Element;
  onClick?: () => void;
  type?: 'submit' | 'button';
  variant?: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  class?: string;
}

export function Button(props: ButtonProps) {
  const baseClasses = 'rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50';

  const variantClasses = () => {
    switch (props.variant ?? 'primary') {
      case 'primary':
        return 'bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:cursor-not-allowed';
      case 'danger':
        return 'text-danger hover:text-danger-hover';
      case 'ghost':
        return 'text-gray-500 hover:text-gray-700';
    }
  };

  const classes = () => `${baseClasses} ${variantClasses()} ${props.class ?? ''}`;

  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      class={classes()}
    >
      {props.children}
    </button>
  );
}
