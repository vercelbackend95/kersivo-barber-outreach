import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkingHourRow } from './barbersTypes';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import AdminSectionHeader from './AdminSectionHeader';
import { ImagePlus, X } from '../lucide-react';
import { SHOP_PAUSE_REASON_MIN_LENGTH } from '@/lib/admin/shopPublicActivityConstants';
import '@/styles/components/admin-barbershop-settings.css';

const WEEK_DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Identity = {
  name: string;
  townCity: string | null;
  logoUrl: string | null;
};

type PauseState = {
  paused: boolean;
  pausedNow: boolean;
  pausedAt: string | null;
  from: string | null;
  until: string | null;
  reason: string | null;
};

const EMPTY_PAUSE: PauseState = {
  paused: false,
  pausedNow: false,
  pausedAt: null,
  from: null,
  until: null,
  reason: null,
};

export type BarbershopSettingsPanelProps = {
  onIdentitySaved?: (identity: Identity) => void;
  onPauseChanged?: (paused: boolean) => void;
};

function formatPauseDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function BarbershopSettingsPanel({
  onIdentitySaved,
  onPauseChanged,
}: BarbershopSettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [townCity, setTownCity] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState('');
  const [identityMessage, setIdentityMessage] = useState('');

  const [hours, setHours] = useState<WorkingHourRow[]>([]);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursError, setHoursError] = useState('');

  const [pause, setPause] = useState<PauseState>(EMPTY_PAUSE);
  const [pauseFrom, setPauseFrom] = useState('');
  const [pauseUntil, setPauseUntil] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [pauseSaving, setPauseSaving] = useState(false);
  const [pauseError, setPauseError] = useState('');
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);

  const [depositsPaid, setDepositsPaid] = useState(false);
  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [depositsCollectReady, setDepositsCollectReady] = useState(false);
  const [connectChargesEnabled, setConnectChargesEnabled] = useState(false);
  const [connectAccountId, setConnectAccountId] = useState<string | null>(null);
  const [depositsBusy, setDepositsBusy] = useState(false);
  const [depositsError, setDepositsError] = useState('');
  const [depositsMessage, setDepositsMessage] = useState('');
  const [policySummary, setPolicySummary] = useState<{
    cancellationWindowHours: number;
    rescheduleWindowHours: number;
    maxClientReschedules: number;
  } | null>(null);

  const [billingPhase, setBillingPhase] = useState<string | null>(null);
  const [billingLabel, setBillingLabel] = useState<string | null>(null);
  const [hasBillingPortal, setHasBillingPortal] = useState(false);
  const [allowsDataExport, setAllowsDataExport] = useState(false);
  const [exportConsumed, setExportConsumed] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [canCancelSubscription, setCanCancelSubscription] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [cancelSubBusy, setCancelSubBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingMessage, setBillingMessage] = useState('');

  const loadBilling = useCallback(async () => {
    setBillingError('');
    try {
      const response = await fetch('/api/setup/billing-status', { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        setHasSubscription(false);
        setHasBillingPortal(false);
        setAllowsDataExport(false);
        setExportConsumed(false);
        setCanCancelSubscription(false);
        setCancelAtPeriodEnd(false);
        setBillingPhase(null);
        setBillingLabel(null);
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        hasSubscription?: boolean;
        hasPortalAccess?: boolean;
        allowsExport?: boolean;
        exportConsumed?: boolean;
        phase?: string | null;
        cancelAtPeriodEnd?: boolean;
        currentPeriodEnd?: string | null;
        graceEndsAt?: string | null;
        retentionEndsAt?: string | null;
        grantsAccess?: boolean;
        canCancelSubscription?: boolean;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || 'Could not load billing status.');
      }

      setHasSubscription(Boolean(data?.hasSubscription));
      setHasBillingPortal(Boolean(data?.hasPortalAccess));
      setAllowsDataExport(Boolean(data?.allowsExport));
      setExportConsumed(Boolean(data?.exportConsumed));
      setCanCancelSubscription(Boolean(data?.canCancelSubscription));
      setCancelAtPeriodEnd(Boolean(data?.cancelAtPeriodEnd));
      setBillingPhase(data?.phase ?? null);

      const formatDate = (iso: string) => {
        const end = new Date(iso);
        if (Number.isNaN(end.getTime())) return null;
        return end.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      if (!data?.hasSubscription) {
        setBillingLabel(null);
        return;
      }
      if (data.phase === 'canceled' && data.retentionEndsAt) {
        const formatted = formatDate(data.retentionEndsAt);
        setBillingLabel(formatted ? `Canceled — export until ${formatted}` : 'Canceled');
        return;
      }
      if (data.phase === 'suspended') {
        setBillingLabel('Suspended — update billing');
        return;
      }
      if (data.phase === 'grace' && data.graceEndsAt) {
        const formatted = formatDate(data.graceEndsAt);
        setBillingLabel(formatted ? `Past due — grace until ${formatted}` : 'Past due');
        return;
      }
      if (data.cancelAtPeriodEnd && data.currentPeriodEnd) {
        const formatted = formatDate(data.currentPeriodEnd);
        if (formatted) {
          setBillingLabel(`Cancels on ${formatted}`);
          return;
        }
      }
      if (data.grantsAccess || data.phase === 'active') {
        setBillingLabel('Active');
        return;
      }
      setBillingLabel(null);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Could not load billing status.');
    }
  }, []);

  const loadDeposits = useCallback(async () => {
    setDepositsError('');
    try {
      const response = await fetch('/api/admin/barbershop-settings/deposits', { credentials: 'include' });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        paid?: boolean;
        depositsEnabled?: boolean;
        collectReady?: boolean;
        connect?: { accountId?: string | null; chargesEnabled?: boolean };
        policy?: {
          cancellationWindowHours: number;
          rescheduleWindowHours: number;
          maxClientReschedules: number;
        };
      } | null;
      if (!response.ok) throw new Error(payload?.error || 'Could not load deposits settings.');
      setDepositsPaid(Boolean(payload?.paid));
      setDepositsEnabled(Boolean(payload?.depositsEnabled));
      setDepositsCollectReady(Boolean(payload?.collectReady));
      setConnectChargesEnabled(Boolean(payload?.connect?.chargesEnabled));
      setConnectAccountId(payload?.connect?.accountId ?? null);
      setPolicySummary(payload?.policy ?? null);
    } catch (error) {
      setDepositsError(error instanceof Error ? error.message : 'Could not load deposits settings.');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/admin/barbershop-settings', { credentials: 'include' });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        identity?: Identity;
        hours?: WorkingHourRow[];
        pause?: PauseState;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not load barbershop settings.');
      }
      setName(payload?.identity?.name ?? '');
      setTownCity(payload?.identity?.townCity ?? '');
      setLogoUrl(payload?.identity?.logoUrl ?? null);
      setLogoPreview(payload?.identity?.logoUrl ?? null);
      setLogoFile(null);
      setClearLogo(false);
      setHours(payload?.hours ?? []);
      const nextPause = payload?.pause
        ? {
            ...EMPTY_PAUSE,
            ...payload.pause,
            pausedNow: Boolean(payload.pause.pausedNow),
          }
        : EMPTY_PAUSE;
      setPause(nextPause);
      setPauseFrom(nextPause.from ?? '');
      setPauseUntil(nextPause.until ?? '');
      setPauseReason(nextPause.reason ?? '');
      onPauseChanged?.(nextPause.pausedNow);
      // Do not block the settings shell on deposits/Stripe — failures stay in the deposits card.
      void loadDeposits();
      void loadBilling();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load barbershop settings.');
    } finally {
      setLoading(false);
    }
    // Intentionally omit onPauseChanged from deps — parent passes setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeposits, loadBilling]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get('connect');
    if (connect !== 'return' && connect !== 'refresh') return;
    if (connect === 'return') {
      setDepositsMessage('Returned from Stripe — checking Connect status…');
      void loadDeposits();
    } else {
      setDepositsError('Stripe onboarding was interrupted. Click Connect Stripe to continue.');
    }
    params.delete('connect');
    const next = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${next ? `?${next}` : ''}`,
    );
  }, [loadDeposits]);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  const pauseFormValid = useMemo(() => {
    if (!pauseFrom || !pauseUntil) return false;
    if (pauseFrom > pauseUntil) return false;
    return pauseReason.trim().length >= SHOP_PAUSE_REASON_MIN_LENGTH;
  }, [pauseFrom, pauseUntil, pauseReason]);

  async function saveIdentity() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setIdentityError('Barbershop name is required.');
      return;
    }
    setIdentitySaving(true);
    setIdentityError('');
    setIdentityMessage('');
    try {
      let response: Response;
      if (logoFile) {
        const form = new FormData();
        form.set('name', trimmedName);
        form.set('townCity', townCity.trim());
        form.set('logo', logoFile);
        response = await fetch('/api/admin/barbershop-settings/identity', {
          method: 'PUT',
          credentials: 'include',
          body: form,
        });
      } else {
        response = await fetch('/api/admin/barbershop-settings/identity', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            townCity: townCity.trim() || null,
            clearLogo,
          }),
        });
      }
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        identity?: Identity;
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Could not save identity.',
        );
      }
      const next = payload?.identity ?? {
        name: trimmedName,
        townCity: townCity.trim() || null,
        logoUrl: clearLogo ? null : logoUrl,
      };
      setName(next.name);
      setTownCity(next.townCity ?? '');
      setLogoUrl(next.logoUrl);
      setLogoPreview(next.logoUrl);
      setLogoFile(null);
      setClearLogo(false);
      setIdentityMessage('Saved.');
      onIdentitySaved?.(next);
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : 'Could not save identity.');
    } finally {
      setIdentitySaving(false);
    }
  }

  async function saveHours(rules?: WorkingHourRow[]): Promise<boolean> {
    const nextRules = rules ?? hours;
    setHoursSaving(true);
    setHoursError('');
    try {
      const response = await fetch('/api/admin/barbershop-settings/hours', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: nextRules }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        hours?: WorkingHourRow[];
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Could not save opening hours.',
        );
      }
      if (payload?.hours) setHours(payload.hours);
      return true;
    } catch (error) {
      setHoursError(error instanceof Error ? error.message : 'Could not save opening hours.');
      return false;
    } finally {
      setHoursSaving(false);
    }
  }

  async function applyPause(body: Record<string, unknown>) {
    setPauseSaving(true);
    setPauseError('');
    try {
      const response = await fetch('/api/admin/barbershop-settings/pause', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string | { formErrors?: string[] };
        pause?: PauseState;
      } | null;
      if (!response.ok) {
        const err = payload?.error;
        throw new Error(
          typeof err === 'string' ? err : 'Could not update pause.',
        );
      }
      const next = payload?.pause
        ? { ...EMPTY_PAUSE, ...payload.pause, pausedNow: Boolean(payload.pause.pausedNow) }
        : EMPTY_PAUSE;
      setPause(next);
      setPauseFrom(next.from ?? '');
      setPauseUntil(next.until ?? '');
      setPauseReason(next.reason ?? '');
      onPauseChanged?.(next.pausedNow);
      setPauseConfirmOpen(false);
    } catch (error) {
      setPauseError(error instanceof Error ? error.message : 'Could not update pause.');
    } finally {
      setPauseSaving(false);
    }
  }

  function openPauseConfirm() {
    setPauseError('');
    if (!pauseFormValid) {
      setPauseError(
        pauseFrom && pauseUntil && pauseFrom > pauseUntil
          ? 'Start date must be on or before the end date.'
          : `Add dates and a customer-facing reason (at least ${SHOP_PAUSE_REASON_MIN_LENGTH} characters).`,
      );
      return;
    }
    setPauseConfirmOpen(true);
  }

  if (loading) {
    return (
      <section className="admin-barbershop-settings" aria-busy="true">
        <p className="muted">Loading barbershop settings…</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="admin-barbershop-settings">
        <p className="admin-inline-error" role="alert">
          {loadError}
        </p>
        <button type="button" className="btn btn--secondary" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="admin-barbershop-settings">
      <AdminSectionHeader
        title="Barbershop settings"
        description="Identity, opening hours, and public availability for your whole barbershop."
      />

      <div className="admin-barbershop-settings__stack">
        <section className="admin-barbershop-settings__card" aria-labelledby="bbs-identity-title">
          <h2 id="bbs-identity-title" className="admin-barbershop-settings__card-title">
            Identity
          </h2>
          <div className="admin-barbershop-settings__fields">
            <div className="field">
              <label className="field__label" htmlFor="bbs-name">
                Barbershop name
              </label>
              <input
                id="bbs-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="organization"
                maxLength={120}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="bbs-town">
                Town or city <span className="field__hint">(optional)</span>
              </label>
              <input
                id="bbs-town"
                className="input"
                value={townCity}
                onChange={(event) => setTownCity(event.target.value)}
                autoComplete="address-level2"
                maxLength={120}
              />
            </div>
            <div className="field admin-barbershop-settings__logo-field">
              <span className="field__label" id="bbs-logo-label">
                Logo
              </span>
              <div className="admin-barbershop-settings__logo-row">
                <div className="admin-barbershop-settings__logo-preview" aria-hidden="true">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" width={72} height={72} />
                  ) : (
                    <ImagePlus width={28} height={28} />
                  )}
                </div>
                <div className="admin-barbershop-settings__logo-actions">
                  <label className="btn btn--secondary" htmlFor="bbs-logo-input">
                    Upload logo
                  </label>
                  <input
                    id="bbs-logo-input"
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-labelledby="bbs-logo-label"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) return;
                      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
                      setLogoFile(file);
                      setClearLogo(false);
                      setLogoPreview(URL.createObjectURL(file));
                      event.target.value = '';
                    }}
                  />
                  {logoPreview || logoUrl ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
                        setLogoFile(null);
                        setLogoPreview(null);
                        setClearLogo(true);
                      }}
                    >
                      <X width={14} height={14} aria-hidden />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {identityError ? (
            <p className="admin-inline-error" role="alert">
              {identityError}
            </p>
          ) : null}
          {identityMessage ? <p className="admin-inline-success">{identityMessage}</p> : null}
          <div className="admin-barbershop-settings__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={identitySaving}
              onClick={() => void saveIdentity()}
            >
              {identitySaving ? 'Saving…' : 'Save identity'}
            </button>
          </div>
        </section>

        <section className="admin-barbershop-settings__card" aria-labelledby="bbs-hours-title">
          <h2 id="bbs-hours-title" className="admin-barbershop-settings__card-title">
            Opening hours
          </h2>
          <p className="admin-barbershop-settings__card-copy">
            Staff working hours cannot go outside these times. Changes auto-save.
          </p>
          <BarberWorkingHoursEditor
            weekDays={WEEK_DAYS}
            workingHours={hours}
            loading={false}
            saving={hoursSaving}
            saveError={hoursError}
            onSetWorkingHours={setHours}
            onSave={saveHours}
            persistToServer
            hideHeader
            layout="profile"
            helperText="Tap any day to set open hours or mark closed."
          />
        </section>

        <section className="admin-barbershop-settings__card" aria-labelledby="bbs-pause-title">
          <h2 id="bbs-pause-title" className="admin-barbershop-settings__card-title">
            Shop pause
          </h2>
          <p className="admin-barbershop-settings__card-copy">
            Temporarily close public bookings and retail for a date range (e.g. renovation). Admin
            tools stay available.
          </p>

          {pause.paused ? (
            <>
              <p className="admin-barbershop-settings__pause-banner" role="status">
                {pause.pausedNow
                  ? 'Public bookings and retail are blocked today.'
                  : 'A pause is scheduled.'}{' '}
                Closed {formatPauseDate(pause.from)} – {formatPauseDate(pause.until)}.
                {pause.reason ? (
                  <>
                    {' '}
                    Customers see: “{pause.reason}”
                  </>
                ) : null}
              </p>
              <div className="admin-barbershop-settings__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={pauseSaving}
                  onClick={() => void applyPause({ paused: false })}
                >
                  {pauseSaving ? 'Resuming…' : 'Resume'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="admin-barbershop-settings__pause-dates">
                <div className="field">
                  <label className="field__label" htmlFor="bbs-pause-from">
                    From
                  </label>
                  <input
                    id="bbs-pause-from"
                    className="input"
                    type="date"
                    value={pauseFrom}
                    onChange={(event) => setPauseFrom(event.target.value)}
                    disabled={pauseSaving}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="bbs-pause-until">
                    Until
                  </label>
                  <input
                    id="bbs-pause-until"
                    className="input"
                    type="date"
                    value={pauseUntil}
                    onChange={(event) => setPauseUntil(event.target.value)}
                    disabled={pauseSaving}
                  />
                </div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="bbs-pause-reason">
                  Message for customers <span className="field__hint">(required)</span>
                </label>
                <textarea
                  id="bbs-pause-reason"
                  className="input admin-barbershop-settings__pause-reason"
                  rows={3}
                  value={pauseReason}
                  maxLength={400}
                  disabled={pauseSaving}
                  onChange={(event) => setPauseReason(event.target.value)}
                  placeholder="e.g. Closed for renovation — we’ll reopen on 5 Aug."
                />
                <p className="admin-barbershop-settings__card-copy">
                  Shown on your public booking form as the reason those dates cannot be booked.
                </p>
              </div>
              <div className="admin-barbershop-settings__actions">
                <button
                  type="button"
                  className="btn btn--destructive"
                  disabled={pauseSaving || !pauseFormValid}
                  onClick={openPauseConfirm}
                >
                  Pause
                </button>
              </div>
            </>
          )}

          {pauseError ? (
            <p className="admin-inline-error" role="alert">
              {pauseError}
            </p>
          ) : null}
        </section>

        <section className="admin-barbershop-settings__card" aria-labelledby="bbs-deposits-title">
          <h2 id="bbs-deposits-title" className="admin-barbershop-settings__card-title">
            Booking deposits
          </h2>
          <p className="admin-barbershop-settings__card-copy">
            Optional £5 online booking deposit via your Stripe account. Off for demos and unpaid
            shops. Refund if the client cancels inside the policy window; forfeit on late cancel /
            no-show; always refund on shop cancel.
          </p>
          {!depositsPaid ? (
            <p className="admin-barbershop-settings__card-copy" role="status">
              Available after your KERSIVO subscription is active.
            </p>
          ) : (
            <>
              <div className="admin-barbershop-settings__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={depositsBusy}
                  onClick={async () => {
                    setDepositsBusy(true);
                    setDepositsError('');
                    setDepositsMessage('');
                    try {
                      const response = await fetch('/api/admin/barbershop-settings/deposits', {
                        method: 'POST',
                        credentials: 'include',
                      });
                      const payload = (await response.json().catch(() => null)) as {
                        error?: string;
                        url?: string;
                      } | null;
                      if (!response.ok || !payload?.url) {
                        throw new Error(payload?.error || 'Could not start Stripe Connect.');
                      }
                      window.location.assign(payload.url);
                    } catch (error) {
                      setDepositsError(
                        error instanceof Error ? error.message : 'Stripe Connect failed.',
                      );
                      setDepositsBusy(false);
                    }
                  }}
                >
                  {connectAccountId ? 'Continue Stripe Connect' : 'Connect Stripe'}
                </button>
                <span className="muted">
                  {connectChargesEnabled
                    ? 'Stripe ready for deposits'
                    : connectAccountId
                      ? 'Finish Stripe onboarding'
                      : 'Not connected'}
                </span>
              </div>
              <label className="field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={depositsEnabled}
                  disabled={depositsBusy || (!connectChargesEnabled && !depositsEnabled)}
                  onChange={async (event) => {
                    const next = event.target.checked;
                    setDepositsBusy(true);
                    setDepositsError('');
                    setDepositsMessage('');
                    try {
                      const response = await fetch('/api/admin/barbershop-settings/deposits', {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ depositsEnabled: next }),
                      });
                      const payload = (await response.json().catch(() => null)) as {
                        error?: string;
                        depositsEnabled?: boolean;
                      } | null;
                      if (!response.ok) {
                        throw new Error(payload?.error || 'Could not update deposits.');
                      }
                      setDepositsEnabled(Boolean(payload?.depositsEnabled));
                      setDepositsMessage(
                        payload?.depositsEnabled
                          ? '£5 deposits required on online bookings.'
                          : 'Deposits turned off.',
                      );
                      await loadDeposits();
                    } catch (error) {
                      setDepositsError(
                        error instanceof Error ? error.message : 'Could not update deposits.',
                      );
                    } finally {
                      setDepositsBusy(false);
                    }
                  }}
                />
                <span>Require £5 deposit on online bookings</span>
              </label>
              {policySummary ? (
                <p className="admin-barbershop-settings__card-copy">
                  Policy: cancel/reschedule windows {policySummary.cancellationWindowHours}h /{' '}
                  {policySummary.rescheduleWindowHours}h · max {policySummary.maxClientReschedules}{' '}
                  client reschedules · collect ready: {depositsCollectReady ? 'yes' : 'no'}
                </p>
              ) : null}
            </>
          )}
          {depositsError ? (
            <p className="admin-inline-error" role="alert">
              {depositsError}
            </p>
          ) : null}
          {depositsMessage ? (
            <p className="muted" role="status">
              {depositsMessage}
            </p>
          ) : null}
        </section>

        <section className="admin-barbershop-settings__card" aria-labelledby="bbs-billing-title">
          <h2 id="bbs-billing-title" className="admin-barbershop-settings__card-title">
            Subscription &amp; data
          </h2>
          <p className="admin-barbershop-settings__card-copy">
            Manage your KERSIVO subscription in Stripe (cancel at period end, payment method,
            invoices). Download a one-time CSV of clients and booking history while subscribed, or
            for 30 days after cancellation. Account deletion is blocked until the subscription is
            canceled and no longer billable.
          </p>
          {hasSubscription ? (
            <p className="admin-barbershop-settings__card-copy" role="status">
              Status: <strong>{billingLabel || billingPhase || 'Unknown'}</strong>
            </p>
          ) : (
            <p className="admin-barbershop-settings__card-copy" role="status">
              No active KERSIVO subscription on file for this shop.
            </p>
          )}
          <div className="admin-barbershop-settings__actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!hasBillingPortal || billingBusy}
              onClick={async () => {
                if (!hasBillingPortal || billingBusy) return;
                setBillingBusy(true);
                setBillingError('');
                setBillingMessage('');
                try {
                  const response = await fetch('/api/setup/billing-portal', {
                    method: 'POST',
                    credentials: 'include',
                  });
                  const payload = (await response.json().catch(() => null)) as {
                    url?: string;
                    error?: string;
                  } | null;
                  if (!response.ok || !payload?.url) {
                    throw new Error(payload?.error || 'Unable to open billing portal.');
                  }
                  window.location.assign(payload.url);
                } catch (error) {
                  setBillingError(
                    error instanceof Error ? error.message : 'Unable to open billing portal.',
                  );
                  setBillingBusy(false);
                }
              }}
            >
              {billingBusy ? 'Opening billing…' : 'Manage billing'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!canCancelSubscription || cancelSubBusy || cancelAtPeriodEnd}
              onClick={async () => {
                if (!canCancelSubscription || cancelSubBusy || cancelAtPeriodEnd) return;
                setCancelSubBusy(true);
                setBillingError('');
                setBillingMessage('');
                try {
                  const response = await fetch('/api/setup/cancel-subscription', {
                    method: 'POST',
                    credentials: 'include',
                  });
                  const payload = (await response.json().catch(() => null)) as {
                    error?: string;
                    currentPeriodEnd?: string | null;
                    alreadyScheduled?: boolean;
                  } | null;
                  if (!response.ok) {
                    throw new Error(payload?.error || 'Unable to cancel subscription.');
                  }
                  setCanCancelSubscription(false);
                  setCancelAtPeriodEnd(true);
                  const end = payload?.currentPeriodEnd
                    ? new Date(payload.currentPeriodEnd).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : null;
                  setBillingMessage(
                    end
                      ? `Subscription will cancel at period end (${end}).`
                      : 'Subscription will cancel at period end.',
                  );
                  await loadBilling();
                } catch (error) {
                  setBillingError(
                    error instanceof Error ? error.message : 'Unable to cancel subscription.',
                  );
                } finally {
                  setCancelSubBusy(false);
                }
              }}
            >
              {cancelSubBusy
                ? 'Canceling…'
                : cancelAtPeriodEnd
                  ? 'Cancellation scheduled'
                  : 'Cancel subscription'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!allowsDataExport || exportBusy || exportConsumed}
              onClick={async () => {
                if (!allowsDataExport || exportBusy || exportConsumed) return;
                setExportBusy(true);
                setBillingError('');
                setBillingMessage('');
                try {
                  const response = await fetch('/api/setup/data-export', { credentials: 'include' });
                  if (response.status === 409) {
                    setExportConsumed(true);
                    setAllowsDataExport(false);
                    setBillingMessage('CSV export was already downloaded for this subscription.');
                    return;
                  }
                  if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(payload?.error || 'Could not download CSV.');
                  }
                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = `kersivo-clients-${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(anchor);
                  anchor.click();
                  anchor.remove();
                  URL.revokeObjectURL(url);
                  setExportConsumed(true);
                  setAllowsDataExport(false);
                  setBillingMessage('CSV downloaded. This one-time export is now marked as used.');
                  await loadBilling();
                } catch (error) {
                  setBillingError(error instanceof Error ? error.message : 'Could not download CSV.');
                } finally {
                  setExportBusy(false);
                }
              }}
            >
              {exportBusy
                ? 'Preparing CSV…'
                : exportConsumed
                  ? 'CSV already downloaded'
                  : 'Download client CSV'}
            </button>
          </div>
          {!hasBillingPortal && hasSubscription ? (
            <p className="muted" role="status">
              Billing portal is unavailable until a Stripe customer is linked to this subscription.
            </p>
          ) : null}
          {exportConsumed ? (
            <p className="muted" role="status">
              The free one-time CSV export has already been used for this subscription.
            </p>
          ) : null}
          {billingError ? (
            <p className="admin-inline-error" role="alert">
              {billingError}
            </p>
          ) : null}
          {billingMessage ? (
            <p className="muted" role="status">
              {billingMessage}
            </p>
          ) : null}
        </section>

        <section
          className="admin-barbershop-settings__card admin-barbershop-settings__card--muted"
          aria-labelledby="bbs-appearance-title"
        >
          <h2 id="bbs-appearance-title" className="admin-barbershop-settings__card-title">
            Appearance
          </h2>
          <p className="admin-barbershop-settings__card-copy">
            Themes for the Kersivo dashboard — coming soon.
          </p>
          <button type="button" className="btn btn--secondary" disabled>
            Themes
          </button>
        </section>
      </div>

      {pauseConfirmOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="admin-barbershop-settings__confirm-layer" role="presentation">
              <button
                type="button"
                className="admin-barbershop-settings__confirm-backdrop"
                aria-label="Close pause confirmation"
                disabled={pauseSaving}
                onClick={() => {
                  if (pauseSaving) return;
                  setPauseConfirmOpen(false);
                }}
              />
              <div
                className="admin-barbershop-settings__confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bbs-pause-confirm-title"
                aria-describedby="bbs-pause-confirm-desc"
              >
                <h3 id="bbs-pause-confirm-title" className="admin-barbershop-settings__confirm-title">
                  Pause public bookings?
                </h3>
                <div id="bbs-pause-confirm-desc" className="admin-barbershop-settings__confirm-body">
                  <p>
                    From <strong>{formatPauseDate(pauseFrom)}</strong> to{' '}
                    <strong>{formatPauseDate(pauseUntil)}</strong>, customers cannot book online and
                    retail checkout is closed on days inside that range. Your admin dashboard stays
                    available.
                  </p>
                  <p>
                    They will see this message:{' '}
                    <strong>“{pauseReason.trim()}”</strong>
                  </p>
                </div>
                <div className="admin-barbershop-settings__confirm-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={pauseSaving}
                    onClick={() => setPauseConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--destructive"
                    disabled={pauseSaving}
                    onClick={() =>
                      void applyPause({
                        paused: true,
                        from: pauseFrom,
                        until: pauseUntil,
                        reason: pauseReason.trim(),
                      })
                    }
                  >
                    {pauseSaving ? 'Pausing…' : 'Confirm Pause'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
