import React from 'react';

type Step = {
  label: string;
};

type Props = {
  steps: Step[];
  currentStep: number;
};

const STEPS: Step[] = [
  { label: 'Service' },
  { label: 'Barber' },
  { label: 'Schedule' },
  { label: 'Details' },
];

export default function BookingStepIndicator({ steps = STEPS, currentStep }: Props) {
  return (
    <nav className="booking-step-indicator" aria-label="Booking progress">
      <ol className="booking-step-indicator__list">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;

          let state: 'completed' | 'active' | 'pending';
          if (isCompleted) state = 'completed';
          else if (isActive) state = 'active';
          else state = 'pending';

          return (
            <React.Fragment key={step.label}>
              <li
                className={`booking-step-indicator__step booking-step-indicator__step--${state}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className="booking-step-indicator__circle"
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3 8.5l3.5 3.5 6.5-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span className="booking-step-indicator__number">{stepNumber}</span>
                  )}
                </span>
                <span className="booking-step-indicator__label">{step.label}</span>
              </li>
              {index < steps.length - 1 ? (
                <li
                  className={`booking-step-indicator__connector${isCompleted ? ' booking-step-indicator__connector--completed' : ''}`}
                  aria-hidden="true"
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
