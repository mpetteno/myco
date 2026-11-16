import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'danger' };

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  const colors = {
    primary: 'bg-green-800 text-white hover:bg-green-900 dark:bg-green-500 dark:text-green-950 dark:hover:bg-green-400',
    secondary: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800',
    danger: 'bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500',
  };
  return (
    <button
      {...props}
      className={`min-h-12 w-full cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-green-700 aria-pressed:bg-green-50 dark:aria-pressed:border-green-400 dark:aria-pressed:bg-green-950 dark:aria-pressed:text-green-300 ${colors[variant]}`}
    />
  );
}
