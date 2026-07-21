import { useEffect, useState } from 'react';

import { Pricing36PlanCards } from '@/components/pricing/Pricing36PlanCards';
import { ENABLE_SETUP_FEES } from '@/lib/pricing/offerMode';
import {
  BILLING_CYCLE_SHORT,
  NO_PAUSE_SHORT,
  PLAN_SCOPE_SHORT,
  PRICE_VAT_DISCLAIMER,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getSetupPlan, isSetupPlanId, type SetupPlanId } from '@/lib/setup/plans';
import { formatGbp } from '@/lib/shop/money';

import '@/styles/pricing36.css';
import '@/styles/components/compare3.css';
import '@/styles/components/admin-launch.css';

type LaunchStep = 1 | 2;
type LaunchMode = 'guest' | 'session';
type GuestPhase = 'choose' | 'details' | 'review';

type LaunchBarber = {
  id?: string;
  name: string;
};

type LaunchWorkspace = {
  name: string | null;
  email: string | null;
  shopName: string;
  townCity: string | null;
  barbers: LaunchBarber[];
};

type WorkspaceDraft = {
  name: string;
  email: string;
  shopName: string;
  townCity: string;
  barbers: LaunchBarber[];
};

type LaunchContextResponse = {
  ok?: boolean;
  onboardingCompleted?: boolean;
  pending?: {
    plan: SetupPlanId;
    shopSize: string;
    currentStack: string;
  } | null;
  shop?: {
    name: string | null;
    townCity?: string | null;
    barbers?: { id?: string; name: string }[];
  };
  user?: { name: string | null; email: string | null };
  error?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readQueryPlan(): SetupPlanId | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('plan')?.trim() ?? '';
    return isSetupPlanId(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readWantStep2(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('step') === '2';
  } catch {
    return false;
  }
}

function collectAttribution(): Record<string, string> {
  const attribution: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of [
      'gclid',
      'gbraid',
      'wbraid',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
    ] as const) {
      const value = params.get(key)?.trim();
      if (value) attribution[key] = value.slice(0, 200);
    }
  } catch {
    // ignore
  }
  return attribution;
}

function shopSizeFromBarberCount(count: number): string {
  if (count <= 2) return '1-2';
  if (count <= 4) return '3-4';
  if (count <= 6) return '5-6';
  if (count <= 8) return '7-8';
  return '9+';
}

function workspaceFromPayload(
  shop: LaunchContextResponse['shop'],
  user: LaunchContextResponse['user'],
): LaunchWorkspace {
  return {
    name: user?.name?.trim() || null,
    email: user?.email?.trim() || null,
    shopName: shop?.name?.trim() || 'Your barbershop',
    townCity: shop?.townCity?.trim() || null,
    barbers: (shop?.barbers ?? [])
      .map((barber) => ({
        id: barber.id,
        name: barber.name.trim(),
      }))
      .filter((barber) => barber.name),
  };
}

function emptyGuestDraft(): WorkspaceDraft {
  return {
    name: '',
    email: '',
    shopName: '',
    townCity: '',
    barbers: [{ name: '' }],
  };
}

function draftFromWorkspace(workspace: LaunchWorkspace): WorkspaceDraft {
  return {
    name: workspace.name ?? '',
    email: workspace.email ?? '',
    shopName: workspace.shopName,
    townCity: workspace.townCity ?? '',
    barbers:
      workspace.barbers.length > 0
        ? workspace.barbers.map((barber) => ({ id: barber.id, name: barber.name }))
        : [{ name: '' }],
  };
}

function validateGuestDraft(draft: WorkspaceDraft): string | null {
  if (draft.name.trim().length < 2) return 'Name must be at least 2 characters.';
  const email = draft.email.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) return 'Valid email is required.';
  if (draft.shopName.trim().length < 2) return 'Barbershop name is required.';
  const barbers = draft.barbers.map((b) => b.name.trim()).filter(Boolean);
  if (barbers.length === 0) return 'Add at least one barber.';
  return null;
}

export default function LaunchWizard() {
  const [planFromQuery, setPlanFromQuery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<LaunchMode>('session');
  const [guestPhase, setGuestPhase] = useState<GuestPhase>('details');
  const [step, setStep] = useState<LaunchStep>(1);
  const [planId, setPlanId] = useState<SetupPlanId | null>(null);
  const [workspace, setWorkspace] = useState<LaunchWorkspace | null>(null);
  const [guestDraft, setGuestDraft] = useState<WorkspaceDraft>(emptyGuestDraft);
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [draft, setDraft] = useState<WorkspaceDraft | null>(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const queryPlan = readQueryPlan();
    const wantStep2 = readWantStep2();
    setPlanFromQuery(Boolean(queryPlan));

    (async () => {
      try {
        const response = await fetch('/api/setup/launch-context', { credentials: 'include' });

        if (response.status === 401) {
          if (cancelled) return;
          setMode('guest');
          if (ENABLE_SETUP_FEES && queryPlan) {
            setPlanId(queryPlan);
            setGuestPhase('details');
            setStep(1);
          } else if (ENABLE_SETUP_FEES) {
            setGuestPhase('choose');
            setStep(1);
          } else {
            setGuestPhase('details');
            setStep(1);
          }
          setLoading(false);
          return;
        }

        const data = (await response.json()) as LaunchContextResponse;
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load launch context.');
        }

        if (!data.onboardingCompleted) {
          window.location.assign('/admin/onboarding');
          return;
        }

        if (cancelled) return;

        setMode('session');
        setWorkspace(workspaceFromPayload(data.shop, data.user));

        if (!ENABLE_SETUP_FEES) {
          setStep(2);
        } else if (queryPlan) {
          setPlanId(queryPlan);
          setStep(2);
        } else if (wantStep2 && data.pending?.plan) {
          setPlanId(data.pending.plan);
          setStep(2);
        } else if (wantStep2 && !data.pending?.plan) {
          setStep(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load launch wizard.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const plan = planId ? getSetupPlan(planId) : null;
  const isGuest = mode === 'guest';

  const progressStep: LaunchStep =
    isGuest && guestPhase === 'review' ? 2 : isGuest && guestPhase === 'details' ? 1 : step;
  const showProgress = !(isGuest && guestPhase === 'choose');

  const handleSelectPlan = (nextPlan: SetupPlanId) => {
    setPlanId(nextPlan);
    setTermsAccepted(false);
    setError(null);
    setEditingWorkspace(false);
    setDraft(null);
    setWorkspaceError(null);

    if (isGuest) {
      setGuestPhase('details');
      setStep(1);
      return;
    }

    setStep(2);
  };

  const continueGuestDetails = () => {
    const validationError = validateGuestDraft(guestDraft);
    if (validationError) {
      setWorkspaceError(validationError);
      return;
    }

    const barbers = guestDraft.barbers
      .map((barber) => ({ id: barber.id, name: barber.name.trim() }))
      .filter((barber) => barber.name);

    setWorkspace({
      name: guestDraft.name.trim(),
      email: guestDraft.email.trim().toLowerCase(),
      shopName: guestDraft.shopName.trim(),
      townCity: guestDraft.townCity.trim() || null,
      barbers,
    });
    setWorkspaceError(null);
    setGuestPhase('review');
    setStep(2);
  };

  const startEditWorkspace = () => {
    if (!workspace) return;
    setDraft(draftFromWorkspace(workspace));
    setWorkspaceError(null);
    setEditingWorkspace(true);
  };

  const cancelEditWorkspace = () => {
    setEditingWorkspace(false);
    setDraft(null);
    setWorkspaceError(null);
  };

  const saveWorkspace = async () => {
    if (!draft || savingWorkspace) return;

    if (isGuest) {
      const validationError = validateGuestDraft(draft);
      if (validationError) {
        setWorkspaceError(validationError);
        return;
      }
      const barbers = draft.barbers
        .map((barber) => ({ id: barber.id, name: barber.name.trim() }))
        .filter((barber) => barber.name);
      setWorkspace({
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        shopName: draft.shopName.trim(),
        townCity: draft.townCity.trim() || null,
        barbers,
      });
      setGuestDraft({
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        shopName: draft.shopName.trim(),
        townCity: draft.townCity.trim(),
        barbers,
      });
      setEditingWorkspace(false);
      setDraft(null);
      setWorkspaceError(null);
      return;
    }

    const shopName = draft.shopName.trim();
    if (!shopName) {
      setWorkspaceError('Barbershop name is required.');
      return;
    }

    const barbers = draft.barbers
      .map((barber) => ({
        id: barber.id,
        name: barber.name.trim(),
      }))
      .filter((barber) => barber.name);

    if (barbers.length === 0) {
      setWorkspaceError('Add at least one barber.');
      return;
    }

    setSavingWorkspace(true);
    setWorkspaceError(null);

    try {
      const response = await fetch('/api/setup/launch-workspace', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName,
          townCity: draft.townCity.trim() || null,
          barbers,
        }),
      });

      const data = (await response.json()) as LaunchContextResponse & { error?: string | unknown };
      if (!response.ok) {
        const message =
          typeof data.error === 'string' ? data.error : 'Unable to save workspace details.';
        throw new Error(message);
      }

      setWorkspace(
        workspaceFromPayload(data.shop, data.user ?? { email: workspace?.email ?? null, name: workspace?.name ?? null }),
      );
      setEditingWorkspace(false);
      setDraft(null);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Unable to save workspace details.');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handlePay = async () => {
    if (paying || editingWorkspace || !workspace) return;
    if (ENABLE_SETUP_FEES && !planId) return;
    if (!termsAccepted) {
      setError('Please accept the Terms to continue.');
      return;
    }

    setPaying(true);
    setError(null);

    try {
      if (!ENABLE_SETUP_FEES) {
        if (isGuest) {
          const barberNames = workspace.barbers.map((b) => b.name.trim()).filter(Boolean);
          const response = await fetch('/api/setup/subscription-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: (workspace.name ?? '').trim(),
              email: (workspace.email ?? '').trim().toLowerCase(),
              shopName: workspace.shopName.trim(),
              shopSize: shopSizeFromBarberCount(barberNames.length),
              currentStack: 'landing',
              townCity: workspace.townCity,
              barbers: barberNames.join(', '),
              attribution: collectAttribution(),
            }),
          });

          const data = (await response.json()) as { url?: string; error?: string };
          if (!response.ok || !data.url) {
            throw new Error(data.error || 'Unable to start checkout.');
          }
          window.location.href = data.url;
          return;
        }

        const response = await fetch('/api/setup/launch-subscription-checkout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attribution: collectAttribution(),
          }),
        });

        const data = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !data.url) {
          throw new Error(data.error || 'Unable to start checkout.');
        }

        window.location.href = data.url;
        return;
      }

      if (isGuest) {
        const barberNames = workspace.barbers.map((b) => b.name.trim()).filter(Boolean);
        const response = await fetch('/api/setup/deposit-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: planId,
            name: (workspace.name ?? '').trim(),
            email: (workspace.email ?? '').trim().toLowerCase(),
            shopName: workspace.shopName.trim(),
            shopSize: shopSizeFromBarberCount(barberNames.length),
            currentStack: 'landing',
            townCity: workspace.townCity,
            barbers: barberNames.join(', '),
            attribution: collectAttribution(),
          }),
        });

        const data = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !data.url) {
          throw new Error(data.error || 'Unable to start checkout.');
        }
        window.location.href = data.url;
        return;
      }

      const response = await fetch('/api/setup/launch-deposit-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          attribution: collectAttribution(),
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to start checkout.');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.');
      setPaying(false);
    }
  };

  const goBackFromReview = () => {
    setError(null);
    setTermsAccepted(false);
    setEditingWorkspace(false);
    setDraft(null);
    setWorkspaceError(null);

    if (isGuest) {
      setGuestPhase('details');
      setStep(1);
      return;
    }

    if (!ENABLE_SETUP_FEES) {
      window.location.assign('/');
      return;
    }

    setStep(1);
  };

  if (loading) {
    return (
      <div className="admin-onboarding">
        <header className="admin-onboarding__header">
          <div className="admin-onboarding__brand">
            <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
            <span className="admin-onboarding__brand-name">Kersivo</span>
          </div>
        </header>
        <main className="admin-onboarding__main">
          <p className="admin-onboarding__description">Loading launch…</p>
        </main>
      </div>
    );
  }

  const showChoosePlan =
    ENABLE_SETUP_FEES && ((!isGuest && step === 1) || (isGuest && guestPhase === 'choose'));
  const showGuestDetails = isGuest && guestPhase === 'details';
  const showReview = ENABLE_SETUP_FEES
    ? (!isGuest && step === 2 && plan) || (isGuest && guestPhase === 'review' && plan && workspace)
    : (!isGuest && step === 2 && workspace) || (isGuest && guestPhase === 'review' && workspace);

  return (
    <div className="admin-onboarding admin-launch">
      <header className="admin-onboarding__header">
        <div className="admin-onboarding__brand">
          <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
          <span className="admin-onboarding__brand-name">Kersivo</span>
        </div>
        {showProgress ? (
          <div className="admin-onboarding__progress" aria-hidden={false}>
            <p className="admin-onboarding__progress-text">Step {progressStep} of 2</p>
            <div className="admin-onboarding__progress-track">
              <div
                className="admin-onboarding__progress-fill"
                style={{ width: `${(progressStep / 2) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <main
        className={`admin-onboarding__main${
          showChoosePlan ? ' admin-onboarding__main--launch-plans' : ''
        }`}
      >
        {showChoosePlan ? (
          <section className="admin-launch__step" aria-labelledby="launch-step1-title">
            <h1 id="launch-step1-title" className="admin-onboarding__title">
              Choose how you want to launch
            </h1>
            <p className="admin-onboarding__description">
              {isGuest
                ? 'Pick the launch support you need. Next we will collect a few shop details.'
                : 'Your shop, services and booking setup are already saved. Choose the level of launch support you need.'}
            </p>
            <div className="pricing36 pricing36--landing admin-launch__pricing">
              <Pricing36PlanCards variant="landing" onSelectPlan={handleSelectPlan} />
            </div>
          </section>
        ) : null}

        {showGuestDetails ? (
          <section className="admin-launch__step" aria-labelledby="launch-guest-details-title">
            <h1 id="launch-guest-details-title" className="admin-onboarding__title">
              Tell us about your shop
            </h1>
            <p className="admin-onboarding__description">
              We use these details to prepare your KERSIVO system and keep your subscription tied to
              the right shop.
            </p>

            {ENABLE_SETUP_FEES && plan ? (
              <p className="admin-launch__selected-plan">
                Selected plan: <strong>{plan.name}</strong>
              </p>
            ) : !ENABLE_SETUP_FEES ? (
              <p className="admin-launch__selected-plan">
                Subscription: <strong>£{SAAS_MONTHLY_GBP}/month</strong> ({PLAN_SCOPE_SHORT})
              </p>
            ) : null}

            <div className="admin-launch__guest-form">
              <div className="field">
                <label className="field__label" htmlFor="guest-name">
                  Your name
                </label>
                <input
                  id="guest-name"
                  className="input"
                  value={guestDraft.name}
                  onChange={(event) =>
                    setGuestDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  maxLength={120}
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="guest-email">
                  Email
                </label>
                <input
                  id="guest-email"
                  className="input"
                  type="email"
                  value={guestDraft.email}
                  onChange={(event) =>
                    setGuestDraft((prev) => ({ ...prev, email: event.target.value }))
                  }
                  maxLength={200}
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="guest-shop-name">
                  Barbershop name
                </label>
                <input
                  id="guest-shop-name"
                  className="input"
                  value={guestDraft.shopName}
                  onChange={(event) =>
                    setGuestDraft((prev) => ({ ...prev, shopName: event.target.value }))
                  }
                  maxLength={120}
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="guest-town-city">
                  Town or city <span className="field__hint">(optional)</span>
                </label>
                <input
                  id="guest-town-city"
                  className="input"
                  value={guestDraft.townCity}
                  onChange={(event) =>
                    setGuestDraft((prev) => ({ ...prev, townCity: event.target.value }))
                  }
                  maxLength={120}
                />
              </div>
              <div className="admin-launch__barbers-edit">
                <p className="admin-launch__barbers-label">Barbers</p>
                {guestDraft.barbers.map((barber, index) => (
                  <div key={`guest-barber-${index}`} className="admin-launch__barber-row">
                    <input
                      className="input"
                      value={barber.name}
                      aria-label={`Barber ${index + 1} name`}
                      onChange={(event) => {
                        const value = event.target.value;
                        setGuestDraft((prev) => {
                          const next = [...prev.barbers];
                          next[index] = { ...next[index]!, name: value };
                          return { ...prev, barbers: next };
                        });
                      }}
                      maxLength={120}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        setGuestDraft((prev) => {
                          if (prev.barbers.length <= 1) return prev;
                          return {
                            ...prev,
                            barbers: prev.barbers.filter((_, i) => i !== index),
                          };
                        });
                      }}
                      disabled={guestDraft.barbers.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() =>
                    setGuestDraft((prev) => ({
                      ...prev,
                      barbers: [...prev.barbers, { name: '' }],
                    }))
                  }
                >
                  Add barber
                </button>
              </div>

              {workspaceError ? (
                <p className="admin-onboarding__error" role="alert">
                  {workspaceError}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {showReview && workspace ? (
          <section className="admin-launch__step" aria-labelledby="launch-step2-title">
            <h1 id="launch-step2-title" className="admin-onboarding__title">
              {ENABLE_SETUP_FEES ? 'Review your launch' : 'Review your subscription'}
            </h1>

            <div className="admin-onboarding__summary-card admin-launch__review admin-launch__workspace">
              <div className="admin-launch__card-heading-row">
                <p className="admin-launch__card-heading">Launching for</p>
                {!editingWorkspace ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={startEditWorkspace}
                    disabled={paying}
                  >
                    Edit details
                  </button>
                ) : null}
              </div>

              {editingWorkspace && draft ? (
                <div className="admin-launch__workspace-edit">
                  {isGuest ? (
                    <>
                      <div className="field">
                        <label className="field__label" htmlFor="launch-name">
                          Your name
                        </label>
                        <input
                          id="launch-name"
                          className="input"
                          value={draft.name}
                          onChange={(event) =>
                            setDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                          }
                          disabled={savingWorkspace}
                          maxLength={120}
                          required
                        />
                      </div>
                      <div className="field">
                        <label className="field__label" htmlFor="launch-email">
                          Email
                        </label>
                        <input
                          id="launch-email"
                          className="input"
                          type="email"
                          value={draft.email}
                          onChange={(event) =>
                            setDraft((prev) =>
                              prev ? { ...prev, email: event.target.value } : prev,
                            )
                          }
                          disabled={savingWorkspace}
                          maxLength={200}
                          required
                        />
                      </div>
                    </>
                  ) : workspace.email ? (
                    <div className="admin-launch__review-row">
                      <span className="admin-launch__review-label">Email</span>
                      <span className="admin-launch__review-value">{workspace.email}</span>
                    </div>
                  ) : null}

                  <div className="field">
                    <label className="field__label" htmlFor="launch-shop-name">
                      Barbershop name
                    </label>
                    <input
                      id="launch-shop-name"
                      className="input"
                      value={draft.shopName}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, shopName: event.target.value } : prev,
                        )
                      }
                      disabled={savingWorkspace}
                      maxLength={120}
                      required
                    />
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor="launch-town-city">
                      Town or city <span className="field__hint">(optional)</span>
                    </label>
                    <input
                      id="launch-town-city"
                      className="input"
                      value={draft.townCity}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, townCity: event.target.value } : prev,
                        )
                      }
                      disabled={savingWorkspace}
                      maxLength={120}
                    />
                  </div>

                  <div className="admin-launch__barbers-edit">
                    <p className="admin-launch__barbers-label">Barbers</p>
                    {draft.barbers.map((barber, index) => (
                      <div key={barber.id ?? `new-${index}`} className="admin-launch__barber-row">
                        <input
                          className="input"
                          value={barber.name}
                          aria-label={`Barber ${index + 1} name`}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDraft((prev) => {
                              if (!prev) return prev;
                              const next = [...prev.barbers];
                              next[index] = { ...next[index]!, name: value };
                              return { ...prev, barbers: next };
                            });
                          }}
                          disabled={savingWorkspace}
                          maxLength={120}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setDraft((prev) => {
                              if (!prev || prev.barbers.length <= 1) return prev;
                              return {
                                ...prev,
                                barbers: prev.barbers.filter((_, i) => i !== index),
                              };
                            });
                          }}
                          disabled={savingWorkspace || draft.barbers.length <= 1}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() =>
                        setDraft((prev) =>
                          prev ? { ...prev, barbers: [...prev.barbers, { name: '' }] } : prev,
                        )
                      }
                      disabled={savingWorkspace}
                    >
                      Add barber
                    </button>
                  </div>

                  {workspaceError ? (
                    <p className="admin-onboarding__error" role="alert">
                      {workspaceError}
                    </p>
                  ) : null}

                  <div className="admin-launch__workspace-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={cancelEditWorkspace}
                      disabled={savingWorkspace}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => void saveWorkspace()}
                      disabled={savingWorkspace}
                      aria-busy={savingWorkspace}
                    >
                      {savingWorkspace ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {isGuest && workspace.name ? (
                    <div className="admin-launch__review-row">
                      <span className="admin-launch__review-label">Name</span>
                      <span className="admin-launch__review-value">{workspace.name}</span>
                    </div>
                  ) : null}
                  {workspace.email ? (
                    <div className="admin-launch__review-row">
                      <span className="admin-launch__review-label">Email</span>
                      <span className="admin-launch__review-value">{workspace.email}</span>
                    </div>
                  ) : null}
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Barbershop</span>
                    <span className="admin-launch__review-value">{workspace.shopName}</span>
                  </div>
                  {workspace.townCity ? (
                    <div className="admin-launch__review-row">
                      <span className="admin-launch__review-label">Town or city</span>
                      <span className="admin-launch__review-value">{workspace.townCity}</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="admin-onboarding__summary-card admin-launch__review">
              <p className="admin-launch__card-heading">Your plan</p>
              {ENABLE_SETUP_FEES && plan ? (
                <>
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Plan</span>
                    <span className="admin-launch__review-value">{plan.name}</span>
                  </div>
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Total setup fee</span>
                    <span className="admin-launch__review-value">{formatGbp(plan.setupTotalPence)}</span>
                  </div>
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Deposit due now</span>
                    <span className="admin-launch__review-value">{formatGbp(plan.depositPence)}</span>
                  </div>
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Remaining before go-live</span>
                    <span className="admin-launch__review-value">{formatGbp(plan.remainingPence)}</span>
                  </div>
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Ongoing Care</span>
                    <span className="admin-launch__review-value">
                      £{SAAS_MONTHLY_GBP}/month from go-live
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Subscription</span>
                    <span className="admin-launch__review-value">Monthly · one location</span>
                  </div>
                  <div className="admin-launch__review-row">
                    <span className="admin-launch__review-label">Billed</span>
                    <span className="admin-launch__review-value">£{SAAS_MONTHLY_GBP}/month</span>
                  </div>
                </>
              )}
            </div>
            <p className="admin-onboarding__description">
              {ENABLE_SETUP_FEES && plan
                ? `${formatGbp(plan.depositPence)} today. The remaining ${formatGbp(plan.remainingPence)} is due before launch. Your £${SAAS_MONTHLY_GBP}/month Ongoing Care starts only when you go live.`
                : `£${SAAS_MONTHLY_GBP}/month per physical location, billed today via Stripe. ${BILLING_CYCLE_SHORT} ${NO_PAUSE_SHORT} ${PRICE_VAT_DISCLAIMER}`}
            </p>
            <div className="admin-launch__next">
              <p className="admin-launch__next-heading">What happens next?</p>
              <p className="admin-launch__next-body">
                {ENABLE_SETUP_FEES
                  ? 'We review your saved setup, confirm your launch details and begin preparing your KERSIVO system. Your monthly Care does not start until go-live.'
                  : 'We review your details and begin preparing your booking website, admin dashboard and retail pickup shop. Nothing goes live without your review.'}
              </p>
            </div>
            <label className="admin-launch__terms">
              <input
                type="checkbox"
                name="termsAccepted"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                disabled={paying || editingWorkspace}
              />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  Terms
                </a>{' '}
                {ENABLE_SETUP_FEES
                  ? 'and understand the deposit starts my setup.'
                  : `and understand I am starting a £${SAAS_MONTHLY_GBP}/month subscription for one physical location.`}
              </span>
            </label>
          </section>
        ) : null}

        {error ? (
          <p className="admin-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="admin-onboarding__footer">
        <div className="admin-onboarding__footer-row">
          {showReview ? (
            <>
              <button
                type="button"
                className="btn btn--secondary btn--lg"
                onClick={goBackFromReview}
                disabled={paying || savingWorkspace}
              >
                {isGuest ? 'Back' : ENABLE_SETUP_FEES ? 'Change plan' : 'Back to KERSIVO'}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => void handlePay()}
                disabled={!termsAccepted || paying || editingWorkspace}
                aria-busy={paying}
              >
                {paying
                  ? 'Redirecting…'
                  : ENABLE_SETUP_FEES && plan
                    ? `Pay ${formatGbp(plan.depositPence)} Deposit`
                    : `Subscribe — £${SAAS_MONTHLY_GBP}/month`}
              </button>
            </>
          ) : null}

          {showGuestDetails ? (
            <>
              <button
                type="button"
                className="btn btn--secondary btn--lg"
                onClick={() => {
                  if (!ENABLE_SETUP_FEES || planFromQuery) {
                    window.location.assign('/#pricing');
                    return;
                  }
                  setGuestPhase('choose');
                  setWorkspaceError(null);
                }}
              >
                {!ENABLE_SETUP_FEES || planFromQuery ? 'Back to pricing' : 'Back'}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={continueGuestDetails}
                disabled={ENABLE_SETUP_FEES && !planId}
              >
                Continue
              </button>
            </>
          ) : null}

          {showChoosePlan ? (
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => {
                window.location.assign(isGuest || !ENABLE_SETUP_FEES ? '/' : '/admin');
              }}
            >
              {isGuest || !ENABLE_SETUP_FEES ? 'Back to KERSIVO' : 'Back to admin'}
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
