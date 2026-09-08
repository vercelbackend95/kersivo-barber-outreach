import type { ReactNode } from 'react';

export type BookingConfirmationSecondaryAction = {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
};

type Props = {
  children: ReactNode;
  secondaryActions?: readonly BookingConfirmationSecondaryAction[];
  /** Optional rail; rendered after actions so CTAs stay above recommendations in DOM. */
  recommendations?: ReactNode;
  className?: string;
};

/**
 * Shared post-booking commerce surface.
 * DOM order: confirmation → actions → recommendations (no CSS order tricks).
 * Primary wrapper groups confirm+actions; desktop stacks the rail in a full row below.
 * Hosts supply the rail so demo vs live product sources stay out of this wrapper.
 */
export default function BookingConfirmationExperience({
  children,
  secondaryActions = [],
  recommendations = null,
  className,
}: Props) {
  const actions = secondaryActions.filter((action) => action.label.trim() && action.href.trim());

  return (
    <div
      className={['booking-confirmation-experience', className].filter(Boolean).join(' ')}
      data-booking-confirmation-experience
    >
      <div className="booking-confirmation-experience__primary">
        <div className="booking-confirmation-experience__confirm">{children}</div>

        {actions.length > 0 ? (
          <nav className="booking-confirmation-experience__actions" aria-label="Next steps">
            {actions.map((action) => {
              const variant = action.variant ?? 'secondary';
              const className =
                variant === 'primary'
                  ? 'booking-confirmation-experience__cta booking-confirmation-experience__cta--primary btn btn--primary'
                  : 'booking-confirmation-experience__cta booking-confirmation-experience__cta--secondary';
              return (
                <a key={`${action.href}:${action.label}`} className={className} href={action.href}>
                  {action.label}
                </a>
              );
            })}
          </nav>
        ) : null}
      </div>

      {recommendations ? (
        <div className="booking-confirmation-experience__recommendations">{recommendations}</div>
      ) : null}
    </div>
  );
}
