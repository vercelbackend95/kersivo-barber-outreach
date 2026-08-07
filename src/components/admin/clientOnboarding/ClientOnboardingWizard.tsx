import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ClientOnboardingStatus } from '@prisma/client';
import { ButtonSpinner } from '@/components/ButtonSpinner';
import PrivateDemoAuthPanel from '@/components/admin/PrivateDemoAuthPanel';
import { ClientOnboardingProgress } from './ClientOnboardingProgress';
import { useClientOnboardingDraft } from './useClientOnboardingDraft';
import { BrandStep, BusinessStep, DomainStep, WelcomeStep } from './steps/BusinessBrandDomain';
import {
  AvailabilityStep,
  OpeningHoursStep,
  ServicesStep,
  TeamStep,
} from './steps/CanonicalSteps';
import {
  FinalDetailsStep,
  LaunchPreferencesStep,
  MigrationStep,
  ReviewStep,
} from './steps/LaunchReviewSteps';
import { STEP_META, readJsonError } from './types';

function missingToStep(message: string): number | null {
  const m = message.toLowerCase();
  if (m.includes('shop name') || m.includes('contact') || m.includes('address') || m.includes('postcode') || m.includes('town') || m.includes('public contact')) {
    return 1;
  }
  if (m.includes('domain')) return 3;
  if (m.includes('barber')) return 4;
  if (m.includes('service')) return 5;
  if (m.includes('opening')) return 6;
  if (m.includes('availability')) return 7;
  if (m.includes('migration') || m.includes('lawfully')) return 8;
  if (m.includes('retail') || m.includes('product')) return 9;
  if (m.includes('content rights') || m.includes('accuracy')) return 11;
  return null;
}

export default function ClientOnboardingWizard() {
  const {
    loading,
    state,
    setState,
    draft,
    step,
    saveStatus,
    saveError,
    gateError,
    dirty,
    prefillKind,
    reload,
    updateDraft,
    flushSave,
    goToStep,
    upsertAsset,
    removeAssetLocal,
    mergeCanonical,
  } = useClientOnboardingDraft();

  const [navBusy, setNavBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const beforeContinueRef = useRef<(() => Promise<boolean>) | null>(null);

  const registerBeforeContinue = useCallback((fn: (() => Promise<boolean>) | null) => {
    beforeContinueRef.current = fn;
  }, []);

  const status = state?.onboarding.status;
  const readOnly =
    status === ClientOnboardingStatus.SUBMITTED ||
    status === ClientOnboardingStatus.READY_FOR_BUILD;

  const title = STEP_META[step]?.title ?? 'Setup';

  const common = useMemo(() => {
    if (!draft || !state) return null;
    return {
      draft,
      state,
      disabled: readOnly || navBusy || submitBusy,
      updateDraft,
      upsertAsset,
      removeAssetLocal,
      mergeCanonical,
      registerBeforeContinue,
    };
  }, [
    draft,
    state,
    readOnly,
    navBusy,
    submitBusy,
    updateDraft,
    upsertAsset,
    removeAssetLocal,
    mergeCanonical,
    registerBeforeContinue,
  ]);

  const continueDisabled =
    navBusy ||
    submitBusy ||
    saveStatus === 'saving' ||
    (dirty && saveStatus === 'error');

  const handleBack = async () => {
    if (step <= 0 || navBusy) return;
    setNavBusy(true);
    setActionError('');
    try {
      await goToStep(step - 1);
    } finally {
      setNavBusy(false);
    }
  };

  const handleContinue = async () => {
    if (navBusy || readOnly) return;
    setNavBusy(true);
    setActionError('');
    try {
      const flushed = await flushSave();
      if (!flushed && dirty) {
        setActionError(saveError || 'Could not save. Please try again.');
        return;
      }
      if (beforeContinueRef.current) {
        const stepOk = await beforeContinueRef.current();
        if (!stepOk) {
          setActionError('Could not save this step. Please fix the issue and try again.');
          return;
        }
      }
      if (step === 0) {
        const ok = await goToStep(1);
        if (!ok) setActionError(saveError || 'Could not save. Please try again.');
        return;
      }
      if (step < 11) {
        const ok = await goToStep(step + 1);
        if (!ok) setActionError(saveError || 'Could not save. Please try again.');
      }
    } finally {
      setNavBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (submitBusy || readOnly) return;
    setSubmitBusy(true);
    setActionError('');
    setMissing([]);
    try {
      const flushed = await flushSave();
      if (!flushed && dirty) {
        setActionError(saveError || 'Could not save before submitting.');
        return;
      }
      const response = await fetch('/api/admin/client-onboarding/submit', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 409) {
        await reload();
        return;
      }
      if (response.status === 400) {
        const body = await readJsonError(response);
        const list = body.missing ?? [];
        setMissing(list);
        setActionError(body.error || 'Please fix the highlighted details before submitting.');
        const firstStep = list.map(missingToStep).find((s) => s != null);
        if (typeof firstStep === 'number') {
          await goToStep(firstStep);
        }
        return;
      }
      if (!response.ok) {
        const body = await readJsonError(response);
        setActionError(body.error || 'Could not submit. Please try again.');
        return;
      }
      const body = (await response.json()) as {
        onboarding: NonNullable<typeof state>['onboarding'];
      };
      setState((prev) =>
        prev
          ? {
              ...prev,
              onboarding: body.onboarding,
              completion: {
                ...prev.completion,
                submitted: true,
                writeLocked: true,
                readyToSubmit: true,
                missing: [],
              },
            }
          : prev,
      );
    } catch {
      setActionError('Could not submit. Please try again.');
    } finally {
      setSubmitBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-onboarding" aria-busy="true">
        <div className="admin-onboarding__main">
          <p className="admin-onboarding__description">Loading your setup…</p>
        </div>
      </div>
    );
  }

  if (gateError?.kind === 'unauthorized') {
    return (
      <div className="admin-onboarding admin-onboarding--auth-preview">
        <div className="admin-onboarding__main">
          <h1 className="admin-onboarding__title">Sign in to continue</h1>
          <p className="admin-onboarding__description">
            Your session has expired. Sign in again to continue your setup.
          </p>
        </div>
        <PrivateDemoAuthPanel onSuccess={() => void reload()} />
      </div>
    );
  }

  if (gateError?.kind === 'unpaid') {
    return (
      <div className="admin-onboarding">
        <div className="client-onboarding__gate">
          <h1 className="admin-onboarding__title">Setup available after purchase</h1>
          <p className="admin-onboarding__description">
            This setup is available after a successful KERSIVO subscription purchase.
          </p>
        </div>
      </div>
    );
  }

  if (gateError?.kind === 'forbidden') {
    return (
      <div className="admin-onboarding">
        <div className="client-onboarding__gate">
          <h1 className="admin-onboarding__title">Owner access required</h1>
          <p className="admin-onboarding__description">
            This setup can only be completed by the account owner.
          </p>
        </div>
      </div>
    );
  }

  if (gateError?.kind === 'server' || !state || !draft || !common) {
    return (
      <div className="admin-onboarding">
        <div className="client-onboarding__gate">
          <h1 className="admin-onboarding__title">Something went wrong</h1>
          <p className="admin-onboarding__description">
            {gateError && 'message' in gateError
              ? gateError.message
              : 'Please refresh and try again.'}
          </p>
          <button type="button" className="btn btn--primary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (status === ClientOnboardingStatus.SUBMITTED) {
    return (
      <div className="admin-onboarding">
        <div className="admin-onboarding__main">
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
          <h1 className="admin-onboarding__title">Your setup details have been submitted</h1>
          <p className="admin-onboarding__description">
            We’ll review everything and contact you if we need anything else.
          </p>
          <p className="admin-onboarding__description">
            Nothing will go live without your approval.
          </p>
          {state.onboarding.submittedAt ? (
            <p className="client-onboarding__card-meta">
              Submitted {new Date(state.onboarding.submittedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (status === ClientOnboardingStatus.READY_FOR_BUILD) {
    return (
      <div className="admin-onboarding">
        <div className="admin-onboarding__main">
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
          <h1 className="admin-onboarding__title">Your setup is being prepared</h1>
          <p className="admin-onboarding__description">
            We have the details we need to continue with your KERSIVO setup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-onboarding">
      <ClientOnboardingProgress step={step} saveStatus={saveStatus} saveError={saveError} />
      <main className="admin-onboarding__main admin-onboarding__main--wide">
        {status === ClientOnboardingStatus.NEEDS_CHANGES ? (
          <div className="client-onboarding__banner" role="status">
            <h2>We need a few updates</h2>
            <p>
              Review the details below, make the requested changes and submit again.
            </p>
          </div>
        ) : null}

        {step === 0 ? (
          <WelcomeStep prefillKind={prefillKind} onStart={() => void handleContinue()} />
        ) : null}
        {step === 1 ? <BusinessStep {...common} /> : null}
        {step === 2 ? <BrandStep {...common} /> : null}
        {step === 3 ? <DomainStep {...common} /> : null}
        {step === 4 ? <TeamStep {...common} /> : null}
        {step === 5 ? <ServicesStep {...common} /> : null}
        {step === 6 ? <OpeningHoursStep {...common} /> : null}
        {step === 7 ? <AvailabilityStep {...common} /> : null}
        {step === 8 ? <MigrationStep {...common} /> : null}
        {step === 9 ? <LaunchPreferencesStep {...common} /> : null}
        {step === 10 ? <FinalDetailsStep {...common} /> : null}
        {step === 11 ? (
          <ReviewStep
            {...common}
            onEditStep={(s) => {
              void goToStep(s);
            }}
          />
        ) : null}

        {actionError ? (
          <p className="admin-onboarding__error" role="alert">
            {actionError}
          </p>
        ) : null}
        {missing.length ? (
          <ul className="client-onboarding__review-lines" role="list">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        <span className="sr-only">{title}</span>
      </main>

      {step > 0 ? (
        <footer className="admin-onboarding__footer">
          <div className="admin-onboarding__footer-inner">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={step <= 1 || continueDisabled}
              onClick={() => void handleBack()}
            >
              Back
            </button>
            {step < 11 ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={continueDisabled}
                onClick={() => void handleContinue()}
              >
                {navBusy ? <ButtonSpinner /> : null}
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                disabled={continueDisabled || submitBusy}
                onClick={() => void handleSubmit()}
              >
                {submitBusy ? <ButtonSpinner /> : null}
                {status === ClientOnboardingStatus.NEEDS_CHANGES
                  ? 'Resubmit setup details'
                  : 'Submit setup details'}
              </button>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
