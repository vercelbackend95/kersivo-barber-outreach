import type { ReactNode } from 'react';

export type BookingConfirmationSecondaryAction = {
  label: string;
  href: string;
};

type Props = {
  children: ReactNode;
  secondaryActions?: readonly BookingConfirmationSecondaryAction[];
  className?: string;
};

/**
 * Shared post-booking commerce surface: compact appointment pass + optional
 * recommendation rail + secondary navigation. Hosts supply the rail as a child
 * so demo vs live product sources stay out of this wrapper.
 */
export default function BookingConfirmationExperience({
  children,
  secondaryActions = [],
  className,
}: Props) {
  const actions = secondaryActions.filter((action) => action.label.trim() && action.href.trim());

  return (
    <div
      className={['booking-confirmation-experience', className].filter(Boolean).join(' ')}
      data-booking-confirmation-experience
    >
      {children}
      {actions.length > 0 ? (
        <nav className="booking-confirmation-experience__secondary" aria-label="Next steps">
          {actions.map((action) => (
            <a key={`${action.href}:${action.label}`} className="booking-confirmation-experience__link" href={action.href}>
              {action.label}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
