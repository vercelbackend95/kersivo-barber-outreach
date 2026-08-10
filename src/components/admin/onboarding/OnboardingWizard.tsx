import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, ImagePlus } from '../../lucide-react';
import PrivateDemoAuthPanel from '../PrivateDemoAuthPanel';
import {
  DAY_LABELS,
  DEFAULT_HOURS,
  formatGbp,
  orderedHoursForDisplay,
  parseGbpToPence,
  readJsonError,
  SERVICE_PRESETS,
  type OnboardingBarber,
  type OnboardingHoursRow,
  type OnboardingService,
  type OnboardingState,
} from './onboardingTypes';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7]; // Mon–Sun (dayOfWeek 1–7)

const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_HINT = 'JPG, PNG or WEBP · max 2MB';

function validateLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return 'Use a JPG, PNG, or WEBP image.';
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return 'Logo is too large. Maximum size is 2MB.';
  }
  return null;
}

function progressStepNumber(step: number) {
  // Welcome (0) is intro; setup steps 1–6 map to "Step N of 6"
  return Math.min(6, Math.max(1, step));
}

function matchPresetKey(name: string) {
  const normalized = name.trim().toLowerCase();
  return SERVICE_PRESETS.find((preset) => preset.name.toLowerCase() === normalized)?.key ?? null;
}

function OnboardingSwitch({
  checked,
  onCheckedChange,
  label,
  labelledBy,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  labelledBy?: string;
}) {
  return (
    <span className="admin-onboarding__switch-wrap">
      {label ? <span className="admin-onboarding__switch-text">{label}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        className={`admin-onboarding__switch${checked ? ' is-on' : ' is-off'}`}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="admin-onboarding__switch-thumb" aria-hidden="true" />
      </button>
    </span>
  );
}

function buildServicesFromState(state: OnboardingState | null): OnboardingService[] {
  const existing = state?.services ?? [];
  const usedIds = new Set<string>();

  const presets: OnboardingService[] = SERVICE_PRESETS.map((preset) => {
    const match = existing.find(
      (service) =>
        !usedIds.has(service.id) &&
        (service.name.toLowerCase() === preset.name.toLowerCase() || matchPresetKey(service.name) === preset.key),
    );
    if (match) usedIds.add(match.id);
    return {
      id: match?.id,
      key: preset.key,
      name: match?.name ?? preset.name,
      pricePence: match?.pricePence ?? preset.pricePence,
      durationMinutes: match?.durationMinutes ?? preset.durationMinutes,
      selected: Boolean(match),
      isCustom: false,
    };
  });

  const customs: OnboardingService[] = existing
    .filter((service) => !usedIds.has(service.id))
    .map((service, index) => ({
      id: service.id,
      key: `custom-${service.id || index}`,
      name: service.name,
      pricePence: service.pricePence,
      durationMinutes: service.durationMinutes,
      selected: true,
      isCustom: true,
    }));

  return [...presets, ...customs];
}

type OnboardingWizardProps = {
  /** `guest` = no Better Auth; cookie-bound `/api/preview/onboarding/*`. */
  mode?: 'session' | 'guest';
};

export default function OnboardingWizard({ mode = 'session' }: OnboardingWizardProps) {
  const isGuest = mode === 'guest';
  const apiBase = isGuest ? '/api/preview/onboarding' : '/api/admin/onboarding';

  const [authReady, setAuthReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);

  const [step, setStep] = useState(0);
  const [state, setState] = useState<OnboardingState | null>(null);

  const [shopName, setShopName] = useState('');
  const [townCity, setTownCity] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState('');
  const [shopNameError, setShopNameError] = useState('');

  const [teamMode, setTeamMode] = useState<'solo' | 'team' | null>(null);
  const [barbers, setBarbers] = useState<OnboardingBarber[]>([{ name: '' }]);
  const [barberErrors, setBarberErrors] = useState<string[]>([]);

  const [services, setServices] = useState<OnboardingService[]>(() => buildServicesFromState(null));
  const [servicesError, setServicesError] = useState('');
  /** String drafts while price/duration fields are focused — avoids toFixed/number snap on each keystroke. */
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>({});

  const [hours, setHours] = useState<OnboardingHoursRow[]>(DEFAULT_HOURS);
  const [shopHours, setShopHours] = useState<OnboardingHoursRow[]>(DEFAULT_HOURS);
  const [applyToAllBarbers, setApplyToAllBarbers] = useState(true);
  const [hoursError, setHoursError] = useState('');
  const [shopHoursError, setShopHoursError] = useState('');

  const isReopen = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('reopen') === '1';
  }, []);

  const applyState = useCallback((next: OnboardingState) => {
    setState(next);
    setStep(next.onboardingCurrentStep);
    setShopName(next.shop.name || '');
    setTownCity(next.shop.townCity || '');
    setLogoUrl(next.shop.logoUrl);
    setLogoPreview(next.shop.logoUrl);
    setLogoFile(null);
    setLogoError('');

    if (next.barbers.length > 0) {
      setBarbers(
        next.barbers.map((barber) => ({
          id: barber.id,
          name: barber.name,
          avatarUrl: barber.avatarUrl,
          onlineBookings: barber.isActive !== false,
          intendedRole: barber.intendedRole === 'MANAGER' ? 'MANAGER' : 'BARBER',
        })),
      );
      setTeamMode(next.barbers.length > 1 ? 'team' : 'solo');
    } else if (next.user?.name) {
      setBarbers([{ name: next.user.name, avatarUrl: next.user.image, onlineBookings: true }]);
    }

    setServices(buildServicesFromState(next));
    setShopHours(next.shopHours?.length === 7 ? next.shopHours : DEFAULT_HOURS);
    // Prefill barber hours from shop hours when barber hours are still defaults / empty of active days.
    const nextHours = next.hours?.length === 7 ? next.hours : null;
    const nextShop = next.shopHours?.length === 7 ? next.shopHours : null;
    if (nextHours && nextHours.some((row) => row.active)) {
      setHours(nextHours);
    } else if (nextShop) {
      setHours(nextShop);
    } else {
      setHours(DEFAULT_HOURS);
    }
  }, []);

  const loadOnboarding = useCallback(async () => {
    setLoading(true);
    setError('');
    let redirectingAway = false;
    try {
      let response = await fetch(apiBase, { credentials: 'include' });

      if (isGuest && (response.status === 401 || response.status === 403)) {
        response = await fetch(`${apiBase}/start`, {
          method: 'POST',
          credentials: 'include',
        });
      }

      if (response.status === 401 || response.status === 403) {
        setHasAccess(false);
        setAuthReady(true);
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError(await readJsonError(response));
        setHasAccess(isGuest);
        setAuthReady(true);
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as OnboardingState;
      setHasAccess(true);

      if (payload.onboardingCompleted && !isReopen) {
        redirectingAway = true;
        window.location.assign('/admin');
        return;
      }

      applyState(payload);
    } catch {
      setError('Could not load your workspace setup. Please refresh.');
    } finally {
      if (!redirectingAway) {
        setAuthReady(true);
        setLoading(false);
      }
    }
  }, [apiBase, applyState, isGuest, isReopen]);

  useEffect(() => {
    void loadOnboarding();
  }, [loadOnboarding]);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  const setupProgressVisible = step >= 1 && step <= 6 && !finished;

  const validateHours = useCallback((rows: OnboardingHoursRow[]) => {
    for (const row of rows) {
      if (!row.active) continue;
      const [sh, sm] = row.startTime.split(':').map(Number);
      const [eh, em] = row.endTime.split(':').map(Number);
      if (sh * 60 + sm >= eh * 60 + em) {
        return `${DAY_LABELS[row.dayOfWeek]}: end time must be later than start time.`;
      }
    }
    return '';
  }, []);

  const sessionExpiredMessage = isGuest
    ? 'Your preview session expired. Please refresh to start again.'
    : 'Your session expired. Please sign in again.';

  const persistStepOnly = async (nextStep: number) => {
    const response = await fetch(apiBase, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: nextStep }),
    });
    if (response.status === 401) {
      setHasAccess(false);
      throw new Error(sessionExpiredMessage);
    }
    if (!response.ok) throw new Error(await readJsonError(response));
    const payload = (await response.json()) as OnboardingState;
    applyState(payload);
    setStep(nextStep);
  };

  const saveShop = async () => {
    const name = shopName.trim();
    if (!name) {
      setShopNameError('Barbershop name is required.');
      return;
    }
    setShopNameError('');
    setSaving(true);
    setError('');
    try {
      let response: Response;
      if (logoFile) {
        const form = new FormData();
        form.set('name', name);
        form.set('townCity', townCity.trim());
        form.set('logo', logoFile);
        response = await fetch(`${apiBase}/shop`, {
          method: 'PUT',
          credentials: 'include',
          body: form,
        });
      } else {
        response = await fetch(`${apiBase}/shop`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            townCity: townCity.trim() || null,
            logoUrl: logoUrl || null,
          }),
        });
      }
      if (response.status === 401) {
        setHasAccess(false);
        throw new Error(sessionExpiredMessage);
      }
      if (!response.ok) throw new Error(await readJsonError(response));
      const payload = (await response.json()) as OnboardingState;
      applyState(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save shop details.');
    } finally {
      setSaving(false);
    }
  };

  const saveBarbers = async () => {
    if (!teamMode) {
      setError('Choose whether it is just you or a team.');
      return;
    }
    const cleaned = barbers.map((barber) => ({ ...barber, name: barber.name.trim() }));
    const errors = cleaned.map((barber) => (barber.name ? '' : 'Barber name is required.'));
    setBarberErrors(errors);
    if (errors.some(Boolean)) {
      setError('Enter a name for each barber.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const hasFiles = cleaned.some((barber) => barber.avatarFile);
      const toPayload = (barber: (typeof cleaned)[number], index: number) => {
        const entry: {
          id?: string;
          name: string;
          avatarUrl?: string | null;
          onlineBookings: boolean;
          intendedRole?: 'MANAGER' | 'BARBER';
        } = {
          id: barber.id,
          name: barber.name,
          onlineBookings: cleaned.length === 1 ? true : barber.onlineBookings !== false,
        };
        if (index > 0) {
          entry.intendedRole = barber.intendedRole === 'MANAGER' ? 'MANAGER' : 'BARBER';
        }
        if (!barber.avatarFile && barber.avatarUrl && !barber.avatarUrl.startsWith('blob:')) {
          entry.avatarUrl = barber.avatarUrl;
        }
        return entry;
      };
      let response: Response;
      if (hasFiles) {
        const form = new FormData();
        form.set('barbers', JSON.stringify(cleaned.map((b, i) => toPayload(b, i))));
        cleaned.forEach((barber, index) => {
          if (barber.avatarFile) form.set(`avatar_${index}`, barber.avatarFile);
        });
        response = await fetch(`${apiBase}/barbers`, {
          method: 'PUT',
          credentials: 'include',
          body: form,
        });
      } else {
        response = await fetch(`${apiBase}/barbers`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barbers: cleaned.map((b, i) => toPayload(b, i)),
          }),
        });
      }
      if (response.status === 401) {
        setHasAccess(false);
        throw new Error(sessionExpiredMessage);
      }
      if (!response.ok) throw new Error(await readJsonError(response));
      const payload = (await response.json()) as OnboardingState;
      applyState(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save barbers.');
    } finally {
      setSaving(false);
    }
  };

  const commitServicePriceDraft = useCallback((draft: string | undefined, fallbackPence: number) => {
    if (draft === undefined) return fallbackPence;
    const pence = parseGbpToPence(draft);
    return Number.isNaN(pence) ? fallbackPence : pence;
  }, []);

  const commitServiceDurationDraft = useCallback((draft: string | undefined, fallbackMinutes: number) => {
    if (draft === undefined) return fallbackMinutes;
    if (draft.trim() === '') return fallbackMinutes;
    const next = Number(draft);
    if (!Number.isFinite(next)) return fallbackMinutes;
    return Math.min(480, Math.max(5, Math.round(next)));
  }, []);

  const saveServices = async () => {
    const withDrafts = services.map((service) => ({
      ...service,
      pricePence: commitServicePriceDraft(priceDrafts[service.key], service.pricePence),
      durationMinutes: commitServiceDurationDraft(durationDrafts[service.key], service.durationMinutes),
    }));
    setServices(withDrafts);
    setPriceDrafts({});
    setDurationDrafts({});

    const selected = withDrafts.filter((service) => service.selected);
    if (selected.length === 0) {
      setServicesError('Select at least one service.');
      return;
    }
    for (const service of selected) {
      if (!service.name.trim()) {
        setServicesError('Every selected service needs a name.');
        return;
      }
      if (!Number.isFinite(service.pricePence) || service.pricePence < 0) {
        setServicesError('Enter a valid price for each selected service.');
        return;
      }
      if (!Number.isFinite(service.durationMinutes) || service.durationMinutes < 5) {
        setServicesError('Duration must be at least 5 minutes.');
        return;
      }
    }
    setServicesError('');
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/services`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selected.map((service) => ({
            id: service.id,
            name: service.name.trim(),
            pricePence: service.pricePence,
            durationMinutes: service.durationMinutes,
            selected: true,
          })),
        }),
      });
      if (response.status === 401) {
        setHasAccess(false);
        throw new Error(sessionExpiredMessage);
      }
      if (!response.ok) throw new Error(await readJsonError(response));
      const payload = (await response.json()) as OnboardingState;
      applyState(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save services.');
    } finally {
      setSaving(false);
    }
  };

  const saveShopHours = async () => {
    const validation = validateHours(shopHours);
    if (validation) {
      setShopHoursError(validation);
      return;
    }
    if (!shopHours.some((row) => row.active)) {
      setShopHoursError('Open the shop on at least one day.');
      return;
    }
    setShopHoursError('');
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/shop-hours`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: shopHours }),
      });
      if (response.status === 401) {
        setHasAccess(false);
        throw new Error(sessionExpiredMessage);
      }
      if (!response.ok) throw new Error(await readJsonError(response));
      const payload = (await response.json()) as OnboardingState;
      applyState(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save shop opening hours.');
    } finally {
      setSaving(false);
    }
  };

  const saveHours = async () => {
    const validation = validateHours(hours);
    if (validation) {
      setHoursError(validation);
      return;
    }
    // Client-side ⊆ shop hours check
    for (const row of hours) {
      if (!row.active) continue;
      const shopRow = shopHours.find((item) => item.dayOfWeek === row.dayOfWeek);
      if (!shopRow?.active) {
        setHoursError(`${DAY_LABELS[row.dayOfWeek]}: the shop is closed that day.`);
        return;
      }
      const [sh, sm] = shopRow.startTime.split(':').map(Number);
      const [eh, em] = shopRow.endTime.split(':').map(Number);
      const [bh, bm] = row.startTime.split(':').map(Number);
      const [beH, beM] = row.endTime.split(':').map(Number);
      const shopStart = sh * 60 + sm;
      const shopEnd = eh * 60 + em;
      const barberStart = bh * 60 + bm;
      const barberEnd = beH * 60 + beM;
      if (barberStart < shopStart || barberEnd > shopEnd) {
        setHoursError(
          `${DAY_LABELS[row.dayOfWeek]}: must be within shop hours (${shopRow.startTime}–${shopRow.endTime}).`,
        );
        return;
      }
    }
    setHoursError('');
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/hours`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: hours, applyToAllBarbers }),
      });
      if (response.status === 401) {
        setHasAccess(false);
        throw new Error(sessionExpiredMessage);
      }
      if (!response.ok) throw new Error(await readJsonError(response));
      const payload = (await response.json()) as OnboardingState;
      applyState(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save working hours.');
    } finally {
      setSaving(false);
    }
  };

  const completeOnboarding = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 401) {
        setHasAccess(false);
        throw new Error(sessionExpiredMessage);
      }
      if (!response.ok) throw new Error(await readJsonError(response));
      window.location.assign('/admin/test-book');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup.');
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    if (saving) return;
    if (step === 0) {
      setSaving(true);
      setError('');
      try {
        await persistStepOnly(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start setup.');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 1) return saveShop();
    if (step === 2) return saveShopHours();
    if (step === 3) return saveBarbers();
    if (step === 4) return saveServices();
    if (step === 5) return saveHours();
    if (step === 6) return completeOnboarding();
  };

  const handleBack = () => {
    if (saving || step <= 0) return;
    setError('');
    setStep((current) => current - 1);
  };

  const primaryLabel = useMemo(() => {
    if (step === 0) return 'Start setup';
    if (step === 6) return 'Continue to test booking';
    return 'Continue';
  }, [step]);

  if (!authReady || loading) {
    return (
      <div className="admin-onboarding">
        <div className="admin-onboarding__loading" role="status">
          Loading your workspace setup…
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (isGuest) {
      return (
        <div className="admin-onboarding">
          <header className="admin-onboarding__header">
            <div className="admin-onboarding__brand">
              <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
              <span className="admin-onboarding__brand-name">Kersivo</span>
            </div>
          </header>
          <main className="admin-onboarding__main admin-onboarding__main--welcome">
            <section>
              <h1 className="admin-onboarding__title">Couldn’t start your preview</h1>
              <p className="admin-onboarding__description">
                {error || 'Please refresh the page and try again.'}
              </p>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  void loadOnboarding();
                }}
              >
                Try again
              </button>
            </section>
          </main>
        </div>
      );
    }

    return (
      <>
        <div
          className="admin-onboarding admin-onboarding--auth-preview"
          aria-hidden="true"
          inert
        >
          <header className="admin-onboarding__header">
            <div className="admin-onboarding__brand">
              <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
              <span className="admin-onboarding__brand-name">Kersivo</span>
            </div>
          </header>
          <main className="admin-onboarding__main admin-onboarding__main--welcome">
            <section>
              <h1 className="admin-onboarding__title">Let’s build your barbershop setup</h1>
              <p className="admin-onboarding__description">
                Add your shop, team and services to create your KERSIVO workspace. It takes around 5
                minutes.
              </p>
            </section>
          </main>
          <footer className="admin-onboarding__footer">
            <div className="admin-onboarding__footer-row">
              <button type="button" className="btn btn--secondary btn--lg" tabIndex={-1}>
                Back
              </button>
              <button type="button" className="btn btn--primary btn--lg" tabIndex={-1}>
                Start setup
              </button>
            </div>
          </footer>
        </div>
        <div
          className="auth-gate-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="private-demo-auth-title"
        >
          <div className="auth-gate-card">
            <PrivateDemoAuthPanel
              embedded
              initialMode="signup"
              onSuccess={() => {
                window.location.assign('/admin/onboarding');
              }}
            />
          </div>
        </div>
      </>
    );
  }

  if (finished) {
    return (
      <div className="admin-onboarding">
        <header className="admin-onboarding__header">
          <div className="admin-onboarding__brand">
            <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
            <span className="admin-onboarding__brand-name">Kersivo</span>
          </div>
        </header>
        <main className="admin-onboarding__main admin-onboarding__success">
          <h1 className="admin-onboarding__title">Your workspace is ready</h1>
          <p className="admin-onboarding__description">
            {isGuest
              ? 'Your barbershop preview is ready. Book a test appointment to see how your timeline works.'
              : 'You can now explore your dashboard and continue building your KERSIVO setup.'}
          </p>
          <div className="admin-onboarding__footer" style={{ position: 'static', background: 'none' }}>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => {
                window.location.assign(
                  isGuest ? '/admin/test-book' : '/admin?section=bookings_dashboard',
                );
              }}
            >
              {isGuest ? 'Continue to test booking' : 'Go to dashboard'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-onboarding">
      <header className="admin-onboarding__header">
        <div className="admin-onboarding__brand">
          <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
          <span className="admin-onboarding__brand-name">Kersivo</span>
        </div>
        {setupProgressVisible ? (
          <div>
            <div className="admin-onboarding__progress-meta">
              <p className="admin-onboarding__progress-text" id="onboarding-progress-label">
                Step {progressStepNumber(step)} of 6
              </p>
            </div>
            <div
              className="admin-onboarding__progress-track"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={progressStepNumber(step)}
              aria-labelledby="onboarding-progress-label"
            >
              <div
                className="admin-onboarding__progress-fill"
                style={{ width: `${(progressStepNumber(step) / 6) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <main className={`admin-onboarding__main${step === 0 ? ' admin-onboarding__main--welcome' : ''}`}>
        {error ? (
          <p className="admin-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        {step === 0 ? (
          <section aria-labelledby="onboarding-welcome-title">
            <h1 id="onboarding-welcome-title" className="admin-onboarding__title">
              Let’s build your barbershop setup
            </h1>
            <p className="admin-onboarding__description">
              Add your shop, team and services to create your KERSIVO workspace. It takes around 5 minutes.
            </p>
          </section>
        ) : null}

        {step === 1 ? (
          <section aria-labelledby="onboarding-shop-title" className="admin-onboarding__stack">
            <div>
              <h1 id="onboarding-shop-title" className="admin-onboarding__title">
                Tell us about your shop
              </h1>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="onboarding-shop-name">
                Barbershop name
              </label>
              <input
                id="onboarding-shop-name"
                className={`input${shopNameError ? ' input--error' : ''}`}
                value={shopName}
                onChange={(event) => {
                  setShopName(event.target.value);
                  if (shopNameError) setShopNameError('');
                }}
                autoComplete="organization"
                required
                aria-invalid={Boolean(shopNameError)}
                aria-describedby={shopNameError ? 'onboarding-shop-name-error' : undefined}
              />
              {shopNameError ? (
                <p id="onboarding-shop-name-error" className="field__error" role="alert">
                  {shopNameError}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="onboarding-town-city">
                Town or city <span className="field__hint">(optional)</span>
              </label>
              <input
                id="onboarding-town-city"
                className="input"
                value={townCity}
                onChange={(event) => setTownCity(event.target.value)}
                autoComplete="address-level2"
              />
            </div>
            <div className="field admin-onboarding__file">
              <span className="field__label" id="onboarding-logo-label">
                Logo upload <span className="field__hint">(optional)</span>
              </span>
              <input
                id="onboarding-logo"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-labelledby="onboarding-logo-label"
                aria-describedby="onboarding-logo-hint"
                aria-invalid={Boolean(logoError)}
                onChange={(event) => {
                  const input = event.target;
                  const file = input.files?.[0] ?? null;
                  if (!file) {
                    setLogoFile(null);
                    setLogoError('');
                    if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
                    setLogoPreview(logoUrl);
                    return;
                  }
                  const validationError = validateLogoFile(file);
                  if (validationError) {
                    setLogoError(validationError);
                    setLogoFile(null);
                    input.value = '';
                    return;
                  }
                  setLogoError('');
                  setLogoFile(file);
                  if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
                  setLogoPreview(URL.createObjectURL(file));
                }}
              />
              <label
                htmlFor="onboarding-logo"
                className={`admin-onboarding__upload-tile admin-onboarding__upload-tile--logo${logoPreview ? ' has-preview' : ''}`}
              >
                {logoPreview ? (
                  <>
                    <img className="admin-onboarding__upload-preview admin-onboarding__upload-preview--contain" src={logoPreview} alt="" />
                    <span className="admin-onboarding__upload-overlay">Change</span>
                  </>
                ) : (
                  <>
                    <ImagePlus width={22} height={22} aria-hidden="true" />
                    <span className="admin-onboarding__upload-caption">Add logo</span>
                  </>
                )}
              </label>
              <span id="onboarding-logo-hint" className="field__hint admin-onboarding__file-hint">
                {LOGO_HINT}
              </span>
              {logoError ? <p className="field__error">{logoError}</p> : null}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="onboarding-shop-hours-title" className="admin-onboarding__stack">
            <div>
              <h1 id="onboarding-shop-hours-title" className="admin-onboarding__title">
                When the shop is open?
              </h1>
              <p className="admin-onboarding__description">
                Set your salon opening hours. Staff working hours cannot go outside these times.
              </p>
            </div>
            {shopHoursError ? (
              <p className="admin-onboarding__error" role="alert">
                {shopHoursError}
              </p>
            ) : null}
            {DAY_ORDER.map((dayOfWeek) => {
              const row =
                shopHours.find((item) => item.dayOfWeek === dayOfWeek) ??
                DEFAULT_HOURS.find((item) => item.dayOfWeek === dayOfWeek)!;
              return (
                <div
                  key={dayOfWeek}
                  className={`admin-onboarding__hours-row${row.active ? '' : ' is-closed'}`}
                >
                  <div className="admin-onboarding__hours-top">
                    <strong>{DAY_LABELS[dayOfWeek]}</strong>
                    <OnboardingSwitch
                      checked={row.active}
                      label={row.active ? 'Open' : 'Closed'}
                      onCheckedChange={(active) => {
                        setShopHours((current) =>
                          current.map((item) =>
                            item.dayOfWeek === dayOfWeek ? { ...item, active } : item,
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="admin-onboarding__hours-times">
                    <div className="field">
                      <label className="field__label" htmlFor={`shop-hours-start-${dayOfWeek}`}>
                        Start
                      </label>
                      <input
                        id={`shop-hours-start-${dayOfWeek}`}
                        className="input"
                        type="time"
                        value={row.startTime}
                        disabled={!row.active}
                        onChange={(event) => {
                          setShopHours((current) =>
                            current.map((item) =>
                              item.dayOfWeek === dayOfWeek
                                ? { ...item, startTime: event.target.value }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`shop-hours-end-${dayOfWeek}`}>
                        End
                      </label>
                      <input
                        id={`shop-hours-end-${dayOfWeek}`}
                        className="input"
                        type="time"
                        value={row.endTime}
                        disabled={!row.active}
                        onChange={(event) => {
                          setShopHours((current) =>
                            current.map((item) =>
                              item.dayOfWeek === dayOfWeek
                                ? { ...item, endTime: event.target.value }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        {step === 3 ? (
          <section aria-labelledby="onboarding-barbers-title" className="admin-onboarding__stack">
            <div>
              <h1 id="onboarding-barbers-title" className="admin-onboarding__title">
                Who takes bookings at your shop?
              </h1>
            </div>
            <div className="admin-onboarding__choice-grid" role="group" aria-label="Team size">
              <button
                type="button"
                className={`admin-onboarding__choice${teamMode === 'solo' ? ' is-selected' : ''}`}
                aria-pressed={teamMode === 'solo'}
                onClick={() => {
                  setTeamMode('solo');
                  setBarbers([
                    {
                      id: barbers[0]?.id,
                      name: barbers[0]?.name || state?.user?.name || '',
                      avatarUrl: barbers[0]?.avatarUrl || state?.user?.image || null,
                      onlineBookings: true,
                    },
                  ]);
                }}
              >
                <span className="admin-onboarding__choice-title">Just me</span>
                <span className="admin-onboarding__choice-hint">I’ll take all the bookings for now</span>
              </button>
              <button
                type="button"
                className={`admin-onboarding__choice${teamMode === 'team' ? ' is-selected' : ''}`}
                aria-pressed={teamMode === 'team'}
                onClick={() => {
                  setTeamMode('team');
                  setBarbers((current) => {
                    if (current.length === 0) {
                      return [
                        {
                          name: state?.user?.name || '',
                          avatarUrl: state?.user?.image || null,
                          onlineBookings: true,
                        },
                      ];
                    }
                    return current.map((item, index) =>
                      index === 0
                        ? {
                            ...item,
                            name: item.name || state?.user?.name || '',
                            avatarUrl: item.avatarUrl || state?.user?.image || null,
                            onlineBookings: item.onlineBookings !== false,
                          }
                        : { ...item, onlineBookings: item.onlineBookings !== false },
                    );
                  });
                }}
              >
                <span className="admin-onboarding__choice-title">I have a team</span>
                <span className="admin-onboarding__choice-hint">Add your first barber now — more can come later</span>
              </button>
            </div>

            {teamMode ? (
              <div className="admin-onboarding__stack">
                {barbers.map((barber, index) => (
                  <div key={barber.id || `barber-${index}`} className="admin-onboarding__barber-card">
                    <div className="admin-onboarding__barber-card-head">
                      {index === 0 ? (
                        <span className="admin-team__role-pill admin-team__role-pill--owner">Owner</span>
                      ) : (
                        <div
                          className="admin-onboarding__role-toggle"
                          role="group"
                          aria-label={`Role for ${barber.name || `team member ${index + 1}`}`}
                        >
                          <button
                            type="button"
                            className={`admin-onboarding__role-option${
                              (barber.intendedRole ?? 'BARBER') === 'BARBER' ? ' is-selected' : ''
                            }`}
                            aria-pressed={(barber.intendedRole ?? 'BARBER') === 'BARBER'}
                            onClick={() => {
                              setBarbers((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, intendedRole: 'BARBER' } : item,
                                ),
                              );
                            }}
                          >
                            Barber
                          </button>
                          <button
                            type="button"
                            className={`admin-onboarding__role-option${
                              barber.intendedRole === 'MANAGER' ? ' is-selected' : ''
                            }`}
                            aria-pressed={barber.intendedRole === 'MANAGER'}
                            onClick={() => {
                              setBarbers((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, intendedRole: 'MANAGER' } : item,
                                ),
                              );
                            }}
                          >
                            Manager
                          </button>
                        </div>
                      )}
                      {teamMode === 'team' && index > 0 ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setBarbers((current) => current.filter((_, itemIndex) => itemIndex !== index));
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`onboarding-barber-name-${index}`}>
                        {index === 0 ? 'Your name' : 'Name'}
                      </label>
                      <input
                        id={`onboarding-barber-name-${index}`}
                        className={`input${barberErrors[index] ? ' input--error' : ''}`}
                        value={barber.name}
                        onChange={(event) => {
                          setBarbers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item,
                            ),
                          );
                        }}
                        aria-invalid={Boolean(barberErrors[index])}
                      />
                      {barberErrors[index] ? (
                        <p className="field__error" role="alert">
                          {barberErrors[index]}
                        </p>
                      ) : null}
                    </div>
                    <div className="field admin-onboarding__file">
                      <span className="field__label" id={`onboarding-barber-avatar-label-${index}`}>
                        Profile photo <span className="field__hint">(optional)</span>
                      </span>
                      <input
                        id={`onboarding-barber-avatar-${index}`}
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-labelledby={`onboarding-barber-avatar-label-${index}`}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          const preview = file ? URL.createObjectURL(file) : barber.avatarUrl || null;
                          setBarbers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, avatarFile: file, avatarUrl: preview }
                                : item,
                            ),
                          );
                        }}
                      />
                      <label
                        htmlFor={`onboarding-barber-avatar-${index}`}
                        className={`admin-onboarding__upload-tile${barber.avatarUrl ? ' has-preview' : ''}`}
                      >
                        {barber.avatarUrl ? (
                          <>
                            <img className="admin-onboarding__upload-preview" src={barber.avatarUrl} alt="" />
                            <span className="admin-onboarding__upload-overlay">Change</span>
                          </>
                        ) : (
                          <>
                            <Camera width={22} height={22} aria-hidden="true" />
                            <span className="admin-onboarding__upload-caption">Add photo</span>
                          </>
                        )}
                      </label>
                    </div>
                    {barbers.length > 1 ? (
                      <label className="admin-onboarding__bookings-toggle" htmlFor={`onboarding-barber-bookings-${index}`}>
                        <input
                          id={`onboarding-barber-bookings-${index}`}
                          type="checkbox"
                          checked={barber.onlineBookings !== false}
                          onChange={(event) => {
                            setBarbers((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, onlineBookings: event.target.checked }
                                  : item,
                              ),
                            );
                          }}
                        />
                        <span>Accept online bookings</span>
                      </label>
                    ) : null}
                  </div>
                ))}
                {teamMode === 'team' ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() =>
                      setBarbers((current) => [
                        ...current,
                        { name: '', onlineBookings: true, intendedRole: 'BARBER' },
                      ])
                    }
                  >
                    Add another barber
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section aria-labelledby="onboarding-services-title" className="admin-onboarding__stack">
            <div>
              <h1 id="onboarding-services-title" className="admin-onboarding__title">
                What can clients book?
              </h1>
              <p className="admin-onboarding__description">Select services and adjust price or duration as needed.</p>
            </div>
            {servicesError ? (
              <p className="admin-onboarding__error" role="alert">
                {servicesError}
              </p>
            ) : null}
            {services.map((service) => (
              <div
                key={service.key}
                className={`admin-onboarding__service-card${service.selected ? ' is-selected' : ''}`}
              >
                <div className="admin-onboarding__service-head">
                  <span className="admin-onboarding__service-name" id={`service-toggle-label-${service.key}`}>
                    {service.name.trim() || (service.isCustom ? 'Custom service' : 'Service')}
                  </span>
                  <OnboardingSwitch
                    checked={service.selected}
                    label={service.selected ? 'On' : 'Off'}
                    labelledBy={`service-toggle-label-${service.key}`}
                    onCheckedChange={(selected) => {
                      setServices((current) =>
                        current.map((item) =>
                          item.key === service.key ? { ...item, selected } : item,
                        ),
                      );
                    }}
                  />
                </div>
                {service.selected ? (
                  <div className="admin-onboarding__service-fields">
                    <div className="field">
                      <label className="field__label" htmlFor={`service-name-${service.key}`}>
                        Service name
                      </label>
                      <input
                        id={`service-name-${service.key}`}
                        className="input"
                        value={service.name}
                        onChange={(event) => {
                          setServices((current) =>
                            current.map((item) =>
                              item.key === service.key ? { ...item, name: event.target.value } : item,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`service-price-${service.key}`}>
                        Price (GBP)
                      </label>
                      <input
                        id={`service-price-${service.key}`}
                        className="input"
                        inputMode="decimal"
                        value={
                          priceDrafts[service.key] ?? (service.pricePence / 100).toFixed(2)
                        }
                        onFocus={() => {
                          setPriceDrafts((current) =>
                            current[service.key] !== undefined
                              ? current
                              : { ...current, [service.key]: (service.pricePence / 100).toFixed(2) },
                          );
                        }}
                        onChange={(event) => {
                          const next = event.target.value;
                          setPriceDrafts((current) => ({ ...current, [service.key]: next }));
                        }}
                        onBlur={() => {
                          const draft = priceDrafts[service.key];
                          const pence = commitServicePriceDraft(draft, service.pricePence);
                          setServices((current) =>
                            current.map((item) =>
                              item.key === service.key ? { ...item, pricePence: pence } : item,
                            ),
                          );
                          setPriceDrafts((current) => {
                            const { [service.key]: _removed, ...rest } = current;
                            return rest;
                          });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`service-duration-${service.key}`}>
                        Duration (min)
                      </label>
                      <input
                        id={`service-duration-${service.key}`}
                        className="input"
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        inputMode="numeric"
                        value={
                          durationDrafts[service.key] ?? String(service.durationMinutes)
                        }
                        onFocus={() => {
                          setDurationDrafts((current) =>
                            current[service.key] !== undefined
                              ? current
                              : { ...current, [service.key]: String(service.durationMinutes) },
                          );
                        }}
                        onChange={(event) => {
                          setDurationDrafts((current) => ({
                            ...current,
                            [service.key]: event.target.value,
                          }));
                        }}
                        onBlur={() => {
                          const draft = durationDrafts[service.key];
                          const minutes = commitServiceDurationDraft(draft, service.durationMinutes);
                          setServices((current) =>
                            current.map((item) =>
                              item.key === service.key ? { ...item, durationMinutes: minutes } : item,
                            ),
                          );
                          setDurationDrafts((current) => {
                            const { [service.key]: _removed, ...rest } = current;
                            return rest;
                          });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="admin-onboarding__summary-value">
                    {formatGbp(service.pricePence)} · {service.durationMinutes} min
                  </p>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setServices((current) => [
                  ...current,
                  {
                    key: `custom-${Date.now()}`,
                    name: '',
                    pricePence: 2500,
                    durationMinutes: 30,
                    selected: true,
                    isCustom: true,
                  },
                ]);
              }}
            >
              Add a custom service
            </button>
          </section>
        ) : null}

        {step === 5 ? (
          <section aria-labelledby="onboarding-hours-title" className="admin-onboarding__stack">
            <div>
              <h1 id="onboarding-hours-title" className="admin-onboarding__title">
                Barber working hours
              </h1>
              <p className="admin-onboarding__description">
                Set when barbers can take bookings. Times must stay within shop opening hours.
              </p>
            </div>
            {hoursError ? (
              <p className="admin-onboarding__error" role="alert">
                {hoursError}
              </p>
            ) : null}
            <div className="admin-onboarding__apply-row">
              <span className="admin-onboarding__apply-label" id="onboarding-apply-hours-label">
                Apply these hours to all members
              </span>
              <OnboardingSwitch
                checked={applyToAllBarbers}
                onCheckedChange={setApplyToAllBarbers}
                labelledBy="onboarding-apply-hours-label"
              />
            </div>
            {DAY_ORDER.map((dayOfWeek) => {
              const row =
                hours.find((item) => item.dayOfWeek === dayOfWeek) ??
                DEFAULT_HOURS.find((item) => item.dayOfWeek === dayOfWeek)!;
              return (
                <div
                  key={dayOfWeek}
                  className={`admin-onboarding__hours-row${row.active ? '' : ' is-closed'}`}
                >
                  <div className="admin-onboarding__hours-top">
                    <strong>{DAY_LABELS[dayOfWeek]}</strong>
                    <OnboardingSwitch
                      checked={row.active}
                      label={row.active ? 'Open' : 'Closed'}
                      onCheckedChange={(active) => {
                        setHours((current) =>
                          current.map((item) =>
                            item.dayOfWeek === dayOfWeek ? { ...item, active } : item,
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="admin-onboarding__hours-times">
                    <div className="field">
                      <label className="field__label" htmlFor={`hours-start-${dayOfWeek}`}>
                        Start
                      </label>
                      <input
                        id={`hours-start-${dayOfWeek}`}
                        className="input"
                        type="time"
                        value={row.startTime}
                        disabled={!row.active}
                        onChange={(event) => {
                          setHours((current) =>
                            current.map((item) =>
                              item.dayOfWeek === dayOfWeek
                                ? { ...item, startTime: event.target.value }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`hours-end-${dayOfWeek}`}>
                        End
                      </label>
                      <input
                        id={`hours-end-${dayOfWeek}`}
                        className="input"
                        type="time"
                        value={row.endTime}
                        disabled={!row.active}
                        onChange={(event) => {
                          setHours((current) =>
                            current.map((item) =>
                              item.dayOfWeek === dayOfWeek ? { ...item, endTime: event.target.value } : item,
                            ),
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        {step === 6 ? (
          <section aria-labelledby="onboarding-review-title" className="admin-onboarding__stack">
            <div>
              <h1 id="onboarding-review-title" className="admin-onboarding__title">
                Your KERSIVO workspace is ready
              </h1>
              <p className="admin-onboarding__description">Review your setup, then finish to open your dashboard.</p>
            </div>

            <article className="admin-onboarding__summary-card">
              <div className="admin-onboarding__summary-top">
                <p className="admin-onboarding__summary-label">Barbershop</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(1)}>
                  Edit
                </button>
              </div>
              <p className="admin-onboarding__summary-value">
                {state?.shop.name || shopName}
                {state?.shop.townCity || townCity
                  ? ` · ${state?.shop.townCity || townCity}`
                  : ''}
              </p>
            </article>

            <article className="admin-onboarding__summary-card">
              <div className="admin-onboarding__summary-top">
                <p className="admin-onboarding__summary-label">Shop opening hours</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(2)}>
                  Edit
                </button>
              </div>
              <div className="admin-onboarding__hours-summary" role="list">
                {orderedHoursForDisplay(
                  state?.shopHours?.length === 7 ? state.shopHours : shopHours,
                ).map((day) => (
                  <div key={day.dayOfWeek} className="admin-onboarding__hours-summary-row" role="listitem">
                    <span className="admin-onboarding__hours-summary-day">{day.label}</span>
                    <span className="admin-onboarding__hours-summary-time">
                      {day.active ? `${day.startTime}–${day.endTime}` : 'Closed'}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="admin-onboarding__summary-card">
              <div className="admin-onboarding__summary-top">
                <p className="admin-onboarding__summary-label">Barbers</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(3)}>
                  Edit
                </button>
              </div>
              <p className="admin-onboarding__summary-value">
                {(state?.barbers.length ?? barbers.length) || 0} barber
                {(state?.barbers.length ?? barbers.length) === 1 ? '' : 's'}
                {state?.barbers?.length
                  ? ` — ${state.barbers.map((barber) => barber.name).join(', ')}`
                  : ''}
              </p>
            </article>

            <article className="admin-onboarding__summary-card">
              <div className="admin-onboarding__summary-top">
                <p className="admin-onboarding__summary-label">Services</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(4)}>
                  Edit
                </button>
              </div>
              {(state?.services?.length ?? 0) > 0 ? (
                <div className="admin-onboarding__services-summary" role="list">
                  {(state?.services ?? []).map((service) => (
                    <div key={service.id} className="admin-onboarding__services-summary-row" role="listitem">
                      <span className="admin-onboarding__services-summary-name">{service.name}</span>
                      <span className="admin-onboarding__services-summary-price">
                        {formatGbp(service.pricePence)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="admin-onboarding__summary-value">None selected</p>
              )}
            </article>

            <article className="admin-onboarding__summary-card">
              <div className="admin-onboarding__summary-top">
                <p className="admin-onboarding__summary-label">Barber working hours</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(5)}>
                  Edit
                </button>
              </div>
              <div className="admin-onboarding__hours-summary" role="list">
                {orderedHoursForDisplay(state?.hours?.length === 7 ? state.hours : hours).map((day) => (
                  <div key={day.dayOfWeek} className="admin-onboarding__hours-summary-row" role="listitem">
                    <span className="admin-onboarding__hours-summary-day">{day.label}</span>
                    <span className="admin-onboarding__hours-summary-time">
                      {day.active ? `${day.startTime}–${day.endTime}` : 'Closed'}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}
      </main>

      <footer className="admin-onboarding__footer">
        <div className="admin-onboarding__footer-row">
          {step > 0 ? (
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={handleBack}
              disabled={saving}
            >
              Back
            </button>
          ) : isReopen ? (
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => {
                try {
                  sessionStorage.setItem('kersivo_skip_onboarding_gate', '1');
                } catch {
                  /* ignore */
                }
                window.location.assign('/admin');
              }}
              disabled={saving}
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => {
              void handleContinue();
            }}
            disabled={saving || (step === 3 && !teamMode)}
            aria-busy={saving}
          >
            {saving ? 'Saving…' : primaryLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}
