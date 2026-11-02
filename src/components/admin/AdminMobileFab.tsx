import { forwardRef, type KeyboardEventHandler } from 'react';
import { Plus } from '../lucide-react';

export type AdminMobileFabVisibility = 'mobile' | 'always';
export type AdminMobileFabContext = 'bookings' | 'team' | 'services' | 'products' | 'overview';

export type AdminMobileFabProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  className?: string;
  /** mobile = admin chrome breakpoint only. always = Bookings (all viewports). */
  visibility?: AdminMobileFabVisibility;
  title?: string;
  expanded?: boolean;
  controls?: string;
  haspopup?: 'menu';
  context?: AdminMobileFabContext;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
};

const AdminMobileFab = forwardRef<HTMLButtonElement, AdminMobileFabProps>(function AdminMobileFab(
  {
    label,
    onClick,
    disabled,
    testId = 'admin-mobile-fab',
    className,
    visibility = 'mobile',
    title,
    expanded,
    controls,
    haspopup,
    context,
    onKeyDown,
  },
  ref,
) {
  const classes = [
    'admin-mobile-fab',
    visibility === 'always' ? 'admin-mobile-fab--always' : 'admin-mobile-fab--mobile',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      data-testid={testId}
      data-admin-fab={context}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup={haspopup}
    >
      <Plus aria-hidden />
    </button>
  );
});

export default AdminMobileFab;
