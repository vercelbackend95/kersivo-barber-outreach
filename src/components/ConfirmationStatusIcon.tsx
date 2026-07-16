import React from 'react';
import { Check, X } from '@/components/lucide-react';

export type ConfirmationStatusVariant = 'success' | 'error';

type ConfirmationStatusIconProps = {
  variant?: ConfirmationStatusVariant;
  className?: string;
};

export function ConfirmationStatusIcon({
  variant = 'success',
  className,
}: ConfirmationStatusIconProps) {
  const Icon = variant === 'error' ? X : Check;

  return (
    <div
      className={['booking-confirmation__icon', className].filter(Boolean).join(' ')}
      data-variant={variant}
      aria-hidden="true"
    >
      <Icon />
    </div>
  );
}
