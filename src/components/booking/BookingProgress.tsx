import React from 'react';

export type BookingProgressStep = {
  id: string;
  label: string;
};

type Props = {
  steps: BookingProgressStep[];
  currentStep: number;
  onStepSelect?: (stepNumber: number) => void;
};

export default function BookingProgress({ steps, currentStep, onStepSelect }: Props) {
  const total = steps.length;
  const current = steps[currentStep - 1];
  const progress = total === 0 ? 0 : Math.max(0, Math.min(1, (currentStep - 1) / Math.max(total - 1, 1)));

  return (
    <div className="bx-progress">
      <p className="bx-progress__mobile" aria-live="polite">
        <span>
          Step {currentStep} of {total}
        </span>
        <strong>{current?.label}</strong>
      </p>
      <div
        className="bx-progress__beam"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentStep}
        aria-label={`Booking step ${currentStep} of ${total}`}
      >
        <span style={{ transform: `scaleX(${progress || (currentStep >= 1 ? 0.08 : 0)})` }} />
      </div>
      <nav className="bx-progress__nav" aria-label="Booking progress">
        <ol className="bx-progress__list">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const state = stepNumber < currentStep ? 'completed' : stepNumber === currentStep ? 'active' : 'pending';
            const clickable = state === 'completed' && typeof onStepSelect === 'function';
            return (
              <li
                key={step.id}
                className={`bx-progress__step bx-progress__step--${state}`}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                {clickable ? (
                  <button className="bx-progress__control" type="button" onClick={() => onStepSelect(stepNumber)}>
                    <span className="bx-progress__index" aria-hidden="true">
                      ✓
                    </span>
                    <span className="bx-progress__label">{step.label}</span>
                  </button>
                ) : (
                  <span className="bx-progress__control">
                    <span className="bx-progress__index" aria-hidden="true">
                      {stepNumber}
                    </span>
                    <span className="bx-progress__label">{step.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
