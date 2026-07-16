import React from 'react';

type ButtonSpinnerProps = {
  className?: string;
};

export function ButtonSpinner({ className }: ButtonSpinnerProps) {
  return (
    <span
      className={['btn-spinner', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}
