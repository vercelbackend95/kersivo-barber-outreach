import React from 'react';
import { SETUP_STEP_COUNT } from './types';

export function ClientOnboardingProgress({
  step,
  saveStatus,
  saveError,
}: {
  step: number;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string;
}) {
  if (step < 1) return null;
  const display = Math.min(SETUP_STEP_COUNT, Math.max(1, step));
  const pct = Math.round((display / SETUP_STEP_COUNT) * 100);

  let statusText = '';
  let tone: 'default' | 'error' = 'default';
  if (saveStatus === 'saving') statusText = 'Saving…';
  else if (saveStatus === 'saved') statusText = 'Saved';
  else if (saveStatus === 'error') {
    statusText = saveError || 'Couldn’t save';
    tone = 'error';
  }

  return (
    <div className="admin-onboarding__header">
      <div className="admin-onboarding__brand">
        <img
          className="admin-onboarding__logo"
          src="/brand/kersivo-mark.svg"
          alt=""
          width={36}
          height={36}
        />
        <span className="admin-onboarding__brand-name">KERSIVO</span>
      </div>
      <div className="admin-onboarding__progress-meta">
        <p className="admin-onboarding__progress-text">
          Setup details · Step {display} of {SETUP_STEP_COUNT}
        </p>
        <p className="client-onboarding__save-status" data-tone={tone} aria-live="polite">
          {statusText}
        </p>
      </div>
      <div
        className="admin-onboarding__progress-track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={SETUP_STEP_COUNT}
        aria-valuenow={display}
        aria-label={`Step ${display} of ${SETUP_STEP_COUNT}`}
      >
        <div className="admin-onboarding__progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
