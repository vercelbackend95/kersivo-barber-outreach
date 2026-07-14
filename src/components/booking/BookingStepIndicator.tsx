import React from 'react';

type Step = {
  label: string;
};

type Props = {
  steps: Step[];
  currentStep: number;
};

function getStepState(stepNumber: number, currentStep: number): 'completed' | 'active' | 'pending' {
  if (stepNumber < currentStep) return 'completed';
  if (stepNumber === currentStep) return 'active';
  return 'pending';
}

export default function BookingStepIndicator({ steps, currentStep }: Props) {
  return (
    <nav className="booking-step-indicator" aria-label="Booking progress">
      <ol className="booking-step-indicator__list">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const state = getStepState(stepNumber, currentStep);

          return (
            <React.Fragment key={step.label}>
              <li
                className={`booking-step-indicator__step booking-step-indicator__step--${state}`}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                <span className="booking-step-indicator__circle" aria-hidden="true">
                  {state === 'completed' ? (
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
                  className={`booking-step-indicator__connector${stepNumber < currentStep ? ' booking-step-indicator__connector--completed' : ''}`}
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
