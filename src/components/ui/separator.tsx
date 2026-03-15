import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'separator',
        orientation === 'horizontal' ? 'separator--horizontal' : 'separator--vertical',
        className,
      )}
      {...props}
    />
  );
}