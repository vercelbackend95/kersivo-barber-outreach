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

type QrKitState = {
  eligible: boolean;
  reasons: string[];
  existingRequest: {
    requestedAt: string;
    status: string;
  } | null;
  includedPlacements: string[];
  windowTargetMm: { width: number; height: number };
  rebookTargetMm: { width: number; height: number };
};

type GoogleBookingState = {
  bookingUrl: string | null;
  needsPreparation: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
  staleConfirmation: boolean;
  googleBusinessProfileUrl: string;
};

type PauseState = {
  paused: boolean;
  pausedNow: boolean;
  pausedAt: string | null;
  from: string | null;
  until: string | null;
  reason: string | null;
  locked?: boolean;
  lockedMessage?: string | null;
};

const EMPTY_PAUSE: PauseState = {
  paused: false,
  pausedNow: false,
  pausedAt: null,
  from: null,
  until: null,
  reason: null,
  locked: false,
  lockedMessage: null,
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
  const [bookingPaymentMode, setBookingPaymentMode] = useState<'NONE' | 'DEPOSIT' | 'FULL'>('NONE');
  const [bookingPaymentsAvailable, setBookingPaymentsAvailable] = useState(false);
  const [bookingProductState, setBookingProductState] = useState<string | null>(null);
  const [depositsCollectReady, setDepositsCollectReady] = useState(false);
  const [connectChargesEnabled, setConnectChargesEnabled] = useState(false);
  const [connectAccountLinked, setConnectAccountLinked] = useState(false);
  const [connectDisconnected, setConnectDisconnected] = useState(false);
  const [canManagePayouts, setCanManagePayouts] = useState(false);
  const [depositsBusy, setDepositsBusy] = useState(false);
  const [depositsError, setDepositsError] = useState('');
  const [depositsMessage, setDepositsMessage] = useState('');
  const [retailEnabled, setRetailEnabled] = useState(false);
  const [retailSellReady, setRetailSellReady] = useState(false);
  const [retailGateReason, setRetailGateReason] = useState<string | null>(null);
  const [publicShopUrl, setPublicShopUrl] = useState<string | null>(null);
  const [retailBusy, setRetailBusy] = useState(false);
  const [retailError, setRetailError] = useState('');
  const [retailMessage, setRetailMessage] = useState('');
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
  const [postFullPlan, setPostFullPlan] = useState<string | null>(null);
  const [postFullPlanChoiceRequired, setPostFullPlanChoiceRequired] = useState(false);
  const [showCancelChoices, setShowCancelChoices] = useState(false);
  const [starterTermsAccepted, setStarterTermsAccepted] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [cancelSubBusy, setCancelSubBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingMessage, setBillingMessage] = useState('');

  const [googleBooking, setGoogleBooking] = useState<GoogleBookingState | null>(null);
  const [googleBookingAvailable, setGoogleBookingAvailable] = useState(true);
  const [googleBookingBusy, setGoogleBookingBusy] = useState(false);
  const [googleBookingError, setGoogleBookingError] = useState('');
  const [googleBookingMessage, setGoogleBookingMessage] = useState('');

  const [qrKit, setQrKit] = useState<QrKitState | null>(null);
  const [qrKitAvailable, setQrKitAvailable] = useState(true);
  const [qrKitBusy, setQrKitBusy] = useState(false);
  const [qrKitError, setQrKitError] = useState('');
  const [qrKitMessage, setQrKitMessage] = useState('');
  const [qrContactName, setQrContactName] = useState('');
  const [qrPhone, setQrPhone] = useState('');
  const [qrAddressLine1, setQrAddressLine1] = useState('');
  const [qrAddressLine2, setQrAddressLine2] = useState('');
  const [qrTownCity, setQrTownCity] = useState('');
  const [qrPostcode, setQrPostcode] = useState('');

  const loadQrKit = useCallback(async () => {
    setQrKitError('');
    try {
      const response = await fetch('/api/admin/qr-kit', { credentials: 'include' });
      const payload = (await response.json().catch(() => null)) as
        | (QrKitState & { error?: string })
        | null;
      if (response.status === 403) {
        setQrKitAvailable(false);
        setQrKit(null);
        return;
      }
      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Could not load QR Kit eligibility.');
      }
      setQrKitAvailable(true);
      setQrKit(payload);
    } catch (error) {
      setQrKitError(error instanceof Error ? error.message : 'Could not load QR Kit eligibility.');
    }
  }, []);

  const requestQrKit = useCallback(async () => {
    if (qrKitBusy) return;
    setQrKitBusy(true);
    setQrKitError('');
    setQrKitMessage('');
    try {
      const response = await fetch('/api/admin/qr-kit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryContactName: qrContactName,
          deliveryPhone: qrPhone,
          addressLine1: qrAddressLine1,
          addressLine2: qrAddressLine2,
          townCity: qrTownCity,
          postcode: qrPostcode,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        code?: string;
        request?: { requestedAt?: string; status?: string };
        includedPlacements?: string[];
      } | null;
      if (!response.ok) {
        if (response.status === 409 && payload?.code === 'QR_KIT_ALREADY_REQUESTED') {
          await loadQrKit();
          setQrKitMessage('Your included initial QR Kit request is already on file.');
          return;
        }
        throw new Error(payload?.error || 'Could not request your QR Kit.');
      }
      setQrKitMessage('QR Kit request received. Check your email for the delivery confirmation.');
      await loadQrKit();
    } catch (error) {
      setQrKitError(error instanceof Error ? error.message : 'Could not request your QR Kit.');
    } finally {
      setQrKitBusy(false);
    }
  }, [
    loadQrKit,
    qrAddressLine1,
    qrAddressLine2,
    qrContactName,
    qrKitBusy,
    qrPhone,
    qrPostcode,
    qrTownCity,
  ]);

  const loadGoogleBooking = useCallback(async () => {
    setGoogleBookingError('');
    try {
      const response = await fetch('/api/admin/google-booking', { credentials: 'include' });
      const payload = (await response.json().catch(() => null)) as
        | (GoogleBookingState & { error?: string })
        | null;
      if (response.status === 403) {
        setGoogleBookingAvailable(false);
        setGoogleBooking(null);
        return;
      }
      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Could not load Google booking setup.');
      }
      setGoogleBookingAvailable(true);
      setGoogleBooking(payload);
    } catch (error) {
      setGoogleBookingError(
        error instanceof Error ? error.message : 'Could not load Google booking setup.',
      );
    }
  }, []);

  const updateGoogleBooking = useCallback(async (action: 'prepare' | 'confirm') => {
    if (googleBookingBusy) return;
    setGoogleBookingBusy(true);
    setGoogleBookingError('');
    setGoogleBookingMessage('');
    try {
      const response = await fetch('/api/admin/google-booking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (GoogleBookingState & { error?: string })
        | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Could not update Google booking setup.');
      }
      setGoogleBooking(payload);
      setGoogleBookingMessage(
        action === 'confirm'
          ? 'Google booking link marked as added.'
          : 'Your stable KERSIVO booking link is ready.',
      );
    } catch (error) {
      setGoogleBookingError(
        error instanceof Error ? error.message : 'Could not update Google booking setup.',
      );
    } finally {
      setGoogleBookingBusy(false);
    }
  }, [googleBookingBusy]);

  const copyGoogleBookingUrl = useCallback(async () => {
    const url = googleBooking?.bookingUrl;
    if (!url) return;
    setGoogleBookingError('');
    setGoogleBookingMessage('');
    try {
      await navigator.clipboard.writeText(url);
      setGoogleBookingMessage('Booking link copied.');
    } catch {
      setGoogleBookingError('Could not copy the link. Select the URL and copy it manually.');
    }
  }, [googleBooking?.bookingUrl]);

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
        setPostFullPlan(null);
        setPostFullPlanChoiceRequired(false);
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
        postFullPlan?: string | null;
        postFullPlanChosenAt?: string | null;
        postFullPlanChoiceRequired?: boolean;
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
      setPostFullPlan(data?.postFullPlan ?? null);
      setPostFullPlanChoiceRequired(Boolean(data?.postFullPlanChoiceRequired));
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

  const choosePostFullPlan = useCallback(
    async (choice: 'STARTER' | 'LEAVE') => {
      if (cancelSubBusy) return;
      if (choice === 'STARTER' && !starterTermsAccepted) {
        setBillingError('Please accept the Terms to continue on KERSIVO Starter.');
        return;
      }

      setCancelSubBusy(true);
      setBillingError('');
      setBillingMessage('');
      try {
        if (!cancelAtPeriodEnd && billingPhase !== 'canceled') {
          const cancelResponse = await fetch('/api/setup/cancel-subscription', {
            method: 'POST',
            credentials: 'include',
          });
          const cancelPayload = (await cancelResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (!cancelResponse.ok) {
            throw new Error(cancelPayload?.error || 'Unable to cancel subscription.');
          }
        }

        const choiceResponse = await fetch('/api/setup/post-full-plan', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            choice,
            termsAccepted: choice === 'STARTER' ? starterTermsAccepted : false,
          }),
        });
        const choicePayload = (await choiceResponse.json().catch(() => null)) as {
          error?: string;
          currentPeriodEnd?: string | null;
        } | null;
        if (!choiceResponse.ok) {
          throw new Error(choicePayload?.error || 'Unable to save your post-Full choice.');
        }

        setShowCancelChoices(false);
        setStarterTermsAccepted(false);
        setBillingMessage(
          choice === 'STARTER'
            ? 'Full KERSIVO will remain active until the paid period ends, then KERSIVO Starter will continue at £0/month.'
            : 'Full KERSIVO will remain active until the paid period ends, then the KERSIVO service will end.',
        );
        await loadBilling();
      } catch (error) {
        setBillingError(error instanceof Error ? error.message : 'Unable to save cancellation choice.');
      } finally {
        setCancelSubBusy(false);
      }
    },
    [billingPhase, cancelAtPeriodEnd, cancelSubBusy, loadBilling, starterTermsAccepted],
  );

  const loadDeposits = useCallback(async () => {
    setDepositsError('');
    setRetailError('');
    try {
      const [depositsResponse, retailResponse] = await Promise.all([
        fetch('/api/admin/barbershop-settings/deposits', { credentials: 'include' }),
        fetch('/api/admin/barbershop-settings/retail', { credentials: 'include' }),
      ]);
      const payload = (await depositsResponse.json().catch(() => null)) as {
        error?: string;
        paid?: boolean;
        productState?: string;
        bookingPaymentMode?: string;
        bookingPaymentsAvailable?: boolean;
        depositsEnabled?: boolean;
        collectReady?: boolean;
        canManagePayouts?: boolean;
        connect?: {
          accountId?: string | null;
          accountLinked?: boolean;
          accountType?: string | null;
          chargesEnabled?: boolean;
          disconnected?: boolean;
        };
        policy?: {
          cancellationWindowHours: number;
          rescheduleWindowHours: number;
          maxClientReschedules: number;
        };
      } | null;
      if (!depositsResponse.ok) throw new Error(payload?.error || 'Could not load booking payment settings.');
      setDepositsPaid(Boolean(payload?.paid));
      setBookingPaymentsAvailable(Boolean(payload?.bookingPaymentsAvailable));
      setBookingProductState(payload?.productState ?? null);
      setBookingPaymentMode(
        payload?.bookingPaymentMode === 'DEPOSIT' || payload?.bookingPaymentMode === 'FULL'
          ? payload.bookingPaymentMode
          : payload?.bookingPaymentMode === 'NONE'
            ? 'NONE'
            : payload?.depositsEnabled
              ? 'DEPOSIT'
              : 'NONE',
      );
      setDepositsCollectReady(Boolean(payload?.collectReady));
      setConnectChargesEnabled(Boolean(payload?.connect?.chargesEnabled));
      setConnectAccountLinked(Boolean(payload?.connect?.accountLinked));
      setConnectDisconnected(Boolean(payload?.connect?.disconnected));
      setCanManagePayouts(Boolean(payload?.canManagePayouts));
      setPolicySummary(payload?.policy ?? null);

      const retailPayload = (await retailResponse.json().catch(() => null)) as {
        error?: string;
        retailEnabled?: boolean;
        sellReady?: boolean;
        publicShopUrl?: string;
        gate?: { ok?: boolean; reason?: string };
      } | null;
      if (retailResponse.ok) {
        setRetailEnabled(Boolean(retailPayload?.retailEnabled));
        setRetailSellReady(Boolean(retailPayload?.sellReady));
        setPublicShopUrl(
          typeof retailPayload?.publicShopUrl === 'string' ? retailPayload.publicShopUrl : null,
        );
        setRetailGateReason(
          retailPayload?.gate?.ok ? null : retailPayload?.gate?.reason ?? null,
        );
      }
    } catch (error) {
      setDepositsError(error instanceof Error ? error.message : 'Could not load booking payment settings.');
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
      setQrTownCity((current) => current || payload?.identity?.townCity || '');
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
      // Do not block the settings shell on independent integrations — failures stay in their cards.
      void loadDeposits();
      void loadBilling();
      void loadGoogleBooking();
      void loadQrKit();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load barbershop settings.');
    } finally {
      setLoading(false);
    }
    // Intentionally omit onPauseChanged from deps — parent passes setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeposits, loadBilling, loadGoogleBooking, loadQrKit]);

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
          {pause.locked ? (
            <>
              <p className="admin-barbershop-settings__card-copy">
                {pause.lockedMessage ||
                  'Public booking stays off for this preview shop. Subscribe to launch and go live.'}
              </p>
              <p className="admin-barbershop-settings__pause-banner" role="status">
                Public bookings and retail stay off until you subscribe.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}

          {pauseError ? (
            <p className="admin-inline-error" role="alert">
              {pauseError}
            </p>
          ) : null}
        </section>

        {googleBookingAvailable ? (
          <section className="admin-barbershop-settings__card" aria-labelledby="bbs-google-booking-title">
            <div className="admin-barbershop-settings__summary-top">
              <div>
                <h2 id="bbs-google-booking-title" className="admin-barbershop-settings__card-title">
                  Google booking
                </h2>
                <p className="admin-barbershop-settings__card-copy">
                  Add your KERSIVO booking link to your Google Business Profile so customers can
                  reach your booking page directly from your business listing.
                </p>
              </div>
              <span
                className={`admin-barbershop-settings__integration-status${googleBooking?.confirmed ? ' is-confirmed' : ''}`}
                role="status"
              >
                {googleBooking?.confirmed ? 'Added to Google' : 'Not set up'}
              </span>
            </div>

            {!googleBooking?.bookingUrl ? (
              <div className="admin-barbershop-settings__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={googleBookingBusy}
                  onClick={() => void updateGoogleBooking('prepare')}
                >
                  {googleBookingBusy ? 'Preparing…' : 'Prepare booking link'}
                </button>
              </div>
            ) : (
              <>
                <div className="admin-barbershop-settings__google-link">
                  <label className="field__label" htmlFor="bbs-google-booking-url">
                    Your booking URL
                  </label>
                  <div className="admin-barbershop-settings__google-link-row">
                    <input
                      id="bbs-google-booking-url"
                      className="input"
                      value={googleBooking.bookingUrl}
                      readOnly
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => void copyGoogleBookingUrl()}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <ol className="admin-barbershop-settings__google-steps">
                  <li>Open your Google Business Profile.</li>
                  <li>Select <strong>Booking</strong>, then <strong>Add link</strong>.</li>
                  <li>Paste the KERSIVO booking URL above and save.</li>
                </ol>

                <div className="admin-barbershop-settings__actions admin-barbershop-settings__actions--wrap">
                  <a
                    className="btn btn--secondary"
                    href={googleBooking.googleBusinessProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Google Business Profile
                  </a>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={googleBookingBusy || googleBooking.confirmed}
                    onClick={() => void updateGoogleBooking('confirm')}
                  >
                    {googleBooking.confirmed
                      ? 'Link added'
                      : googleBookingBusy
                        ? 'Saving…'
                        : 'I’ve added the link'}
                  </button>
                </div>

                {googleBooking.confirmed ? (
                  <p className="admin-barbershop-settings__card-copy">
                    KERSIVO has recorded that this exact booking URL was added to Google.
                  </p>
                ) : googleBooking.staleConfirmation ? (
                  <p className="admin-barbershop-settings__pause-banner" role="status">
                    Your booking destination changed. Update the link in Google and confirm it again.
                  </p>
                ) : null}

                <p className="admin-barbershop-settings__card-copy">
                  Google controls where and how booking links appear on Business Profiles. This
                  setup does not guarantee a native Google booking button.
                </p>
              </>
            )}

            {googleBookingError ? (
              <p className="admin-inline-error" role="alert">
                {googleBookingError}
              </p>
            ) : null}
            {googleBookingMessage ? (
              <p className="admin-inline-success" role="status">
                {googleBookingMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {qrKitAvailable ? (
          <section className="admin-barbershop-settings__card" aria-labelledby="bbs-qr-kit-title">
            <div className="admin-barbershop-settings__summary-top">
              <div>
                <h2 id="bbs-qr-kit-title" className="admin-barbershop-settings__card-title">
                  Booking QR Kit
                </h2>
                <p className="admin-barbershop-settings__card-copy">
                  One included initial physical QR Kit is available for an eligible verified UK
                  barbershop location. KERSIVO handles the QR design, printing and fulfilment.
                </p>
              </div>
              <span className="admin-barbershop-settings__integration-status">
                {qrKit?.existingRequest ? 'Request received' : qrKit?.eligible ? 'Eligible' : 'Setup required'}
              </span>
            </div>

            {qrKit?.existingRequest ? (
              <>
                <p className="admin-inline-success" role="status">
                  Request received on{' '}
                  {new Date(qrKit.existingRequest.requestedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  .
                </p>
                <p className="admin-barbershop-settings__card-copy">
                  KERSIVO will complete the business and delivery-detail checks before print and
                  dispatch. We’ll contact you if anything needs clarification.
                </p>
              </>
            ) : qrKit?.eligible ? (
              <>
                <div className="admin-barbershop-settings__qr-kit-preview" aria-label="Included QR Kit">
                  <div>
                    <strong>WINDOW</strong>
                    <span>Approx. 150 × 170 mm</span>
                    <small>BOOK ONLINE · Scan to book</small>
                  </div>
                  <div>
                    <strong>REBOOK</strong>
                    <span>Approx. 100 × 100 mm</span>
                    <small>REBOOK BEFORE YOU LEAVE · Scan to book</small>
                  </div>
                </div>

                <div className="admin-barbershop-settings__fields">
                  <div className="field">
                    <label className="field__label" htmlFor="bbs-qr-contact">Delivery contact name</label>
                    <input
                      id="bbs-qr-contact"
                      className="input"
                      value={qrContactName}
                      maxLength={120}
                      autoComplete="name"
                      onChange={(event) => setQrContactName(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="bbs-qr-phone">Phone number</label>
                    <input
                      id="bbs-qr-phone"
                      className="input"
                      value={qrPhone}
                      maxLength={40}
                      autoComplete="tel"
                      onChange={(event) => setQrPhone(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="bbs-qr-address1">Address line 1</label>
                    <input
                      id="bbs-qr-address1"
                      className="input"
                      value={qrAddressLine1}
                      maxLength={160}
                      autoComplete="address-line1"
                      onChange={(event) => setQrAddressLine1(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="bbs-qr-address2">
                      Address line 2 <span className="field__hint">(optional)</span>
                    </label>
                    <input
                      id="bbs-qr-address2"
                      className="input"
                      value={qrAddressLine2}
                      maxLength={160}
                      autoComplete="address-line2"
                      onChange={(event) => setQrAddressLine2(event.target.value)}
                    />
                  </div>
                  <div className="admin-barbershop-settings__qr-address-row">
                    <div className="field">
                      <label className="field__label" htmlFor="bbs-qr-town">Town or city</label>
                      <input
                        id="bbs-qr-town"
                        className="input"
                        value={qrTownCity}
                        maxLength={120}
                        autoComplete="address-level2"
                        onChange={(event) => setQrTownCity(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="bbs-qr-postcode">UK postcode</label>
                      <input
                        id="bbs-qr-postcode"
                        className="input"
                        value={qrPostcode}
                        maxLength={12}
                        autoComplete="postal-code"
                        onChange={(event) => setQrPostcode(event.target.value.toUpperCase())}
                      />
                    </div>
                  </div>
                </div>

                <p className="admin-barbershop-settings__card-copy">
                  Marketing consent is not required. These details are used for QR Kit verification
                  and fulfilment.
                </p>
                <div className="admin-barbershop-settings__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={
                      qrKitBusy ||
                      qrContactName.trim().length < 2 ||
                      qrPhone.trim().length < 7 ||
                      qrAddressLine1.trim().length < 3 ||
                      qrTownCity.trim().length < 2 ||
                      qrPostcode.trim().length < 5
                    }
                    onClick={() => void requestQrKit()}
                  >
                    {qrKitBusy ? 'Requesting…' : 'Get my Booking QR Kit'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="admin-barbershop-settings__card-copy">
                  Finish the required booking setup before claiming the included initial QR Kit.
                </p>
                {qrKit?.reasons?.length ? (
                  <ul className="admin-barbershop-settings__qr-requirements">
                    {qrKit.reasons.map((reason) => (
                      <li key={reason}>
                        {reason === 'active_barber_required'
                          ? 'Add at least one active bookable barber.'
                          : reason === 'active_service_required'
                            ? 'Add at least one active service.'
                            : reason === 'availability_required'
                              ? 'Configure active barber availability.'
                              : reason === 'terms_acceptance_required'
                                ? 'Accept the applicable KERSIVO Terms.'
                                : reason === 'shop_identity_required'
                                  ? 'Complete your barbershop identity.'
                                  : 'Complete the remaining setup requirement.'}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}

            {qrKitError ? (
              <p className="admin-inline-error" role="alert">{qrKitError}</p>
            ) : null}
            {qrKitMessage ? (
              <p className="admin-inline-success" role="status">{qrKitMessage}</p>
            ) : null}
          </section>
        ) : null}

        <section className="admin-barbershop-settings__card" aria-labelledby="bbs-deposits-title">
          <h2 id="bbs-deposits-title" className="admin-barbershop-settings__card-title">
            Booking payments
          </h2>
          <p className="admin-barbershop-settings__card-copy">
            Choose whether clients pay at the shop, pay a £5 deposit online (services under £5 are
            paid in full), or pay the full service price upfront when they book. Payments are
            refunded if the client cancels inside your policy window or you cancel. On a late
            cancel or no-show you keep the deposit, or up to £5 of a full upfront payment.
          </p>
          {bookingProductState === 'FREE_BOOKING' ? (
            <p className="admin-barbershop-settings__card-copy" data-booking-payments-fee-copy>
              KERSIVO Starter: £0/month · 0% KERSIVO commission on booking payments. Stripe
              processing fees apply.
            </p>
          ) : bookingProductState === 'FULL_KERSIVO' ? (
            <p className="admin-barbershop-settings__card-copy" data-booking-payments-fee-copy>
              KERSIVO charges 0% platform fee on booking payments. Stripe processing fees apply.
            </p>
          ) : null}
          {!bookingPaymentsAvailable ? (
            <p className="admin-barbershop-settings__card-copy" role="status">
              Available once KERSIVO Starter or Full KERSIVO is active.
            </p>
          ) : (
            <>
              <div className="admin-barbershop-settings__actions">
                {canManagePayouts ? (
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
                    {connectDisconnected
                      ? 'Reconnect Stripe'
                      : connectAccountLinked
                        ? 'Continue Stripe Connect'
                        : 'Connect Stripe'}
                  </button>
                ) : (
                  <p className="admin-barbershop-settings__card-copy" role="status">
                    The shop owner connects Stripe and manages booking payment settings. You can
                    see the current status below.
                  </p>
                )}
                <span className="muted">
                  {connectDisconnected
                    ? 'Stripe disconnected — reconnect to take online payments'
                    : connectChargesEnabled
                      ? 'Stripe ready for booking payments'
                      : connectAccountLinked
                        ? 'Finish Stripe onboarding'
                        : 'Not connected'}
                </span>
              </div>
              <fieldset
                className="field"
                style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: '0.35rem' }}
                disabled={depositsBusy || !canManagePayouts}
              >
                <legend className="sr-only">Booking payment option</legend>
                {(
                  [
                    { mode: 'NONE', label: 'Pay at shop' },
                    { mode: 'DEPOSIT', label: 'Require £5 deposit' },
                    { mode: 'FULL', label: 'Require full payment upfront' },
                  ] as const
                ).map((option) => {
                  const checked = option.mode === bookingPaymentMode;
                  return (
                    <label
                      key={option.mode}
                      style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    >
                      <input
                        type="radio"
                        name="bbs-booking-payment-mode"
                        value={option.mode}
                        checked={checked}
                        disabled={option.mode !== 'NONE' && !connectChargesEnabled && !checked}
                        onChange={async () => {
                          if (checked) return;
                          setDepositsBusy(true);
                          setDepositsError('');
                          setDepositsMessage('');
                          try {
                            const response = await fetch('/api/admin/barbershop-settings/deposits', {
                              method: 'PATCH',
                              credentials: 'include',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ bookingPaymentMode: option.mode }),
                            });
                            const payload = (await response.json().catch(() => null)) as {
                              error?: string;
                              bookingPaymentMode?: string;
                            } | null;
                            if (!response.ok) {
                              throw new Error(payload?.error || 'Could not update booking payments.');
                            }
                            const nextMode =
                              payload?.bookingPaymentMode === 'DEPOSIT' || payload?.bookingPaymentMode === 'FULL'
                                ? payload.bookingPaymentMode
                                : 'NONE';
                            setBookingPaymentMode(nextMode);
                            setDepositsMessage(
                              nextMode === 'DEPOSIT'
                                ? '£5 deposit required on online bookings.'
                                : nextMode === 'FULL'
                                  ? 'Full payment required upfront on online bookings.'
                                  : 'Clients pay at the shop.',
                            );
                            await loadDeposits();
                          } catch (error) {
                            setDepositsError(
                              error instanceof Error ? error.message : 'Could not update booking payments.',
                            );
                          } finally {
                            setDepositsBusy(false);
                          }
                        }}
                      />
                      <span>
                        {option.label}
                        {!canManagePayouts && checked ? ' (owner only)' : ''}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              {depositsPaid ? (
              <label className="field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={retailEnabled}
                  disabled={
                    retailBusy ||
                    depositsBusy ||
                    !canManagePayouts ||
                    (!connectChargesEnabled && !retailEnabled) ||
                    !depositsPaid
                  }
                  onChange={async (event) => {
                    const next = event.target.checked;
                    setRetailBusy(true);
                    setRetailError('');
                    setRetailMessage('');
                    try {
                      const response = await fetch('/api/admin/barbershop-settings/retail', {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ retailEnabled: next }),
                      });
                      const payload = (await response.json().catch(() => null)) as {
                        error?: string;
                        retailEnabled?: boolean;
                        sellReady?: boolean;
                        publicShopUrl?: string;
                        gate?: { ok?: boolean; reason?: string };
                      } | null;
                      if (!response.ok) {
                        throw new Error(payload?.error || 'Could not update retail checkout.');
                      }
                      setRetailEnabled(Boolean(payload?.retailEnabled));
                      setRetailSellReady(Boolean(payload?.sellReady));
                      setPublicShopUrl(
                        typeof payload?.publicShopUrl === 'string' ? payload.publicShopUrl : null,
                      );
                      setRetailGateReason(payload?.gate?.ok ? null : payload?.gate?.reason ?? null);
                      setRetailMessage(
                        payload?.retailEnabled
                          ? 'Public retail checkout is on — customers pay your Stripe account.'
                          : 'Public retail checkout turned off.',
                      );
                      await loadDeposits();
                    } catch (error) {
                      setRetailError(
                        error instanceof Error ? error.message : 'Could not update retail checkout.',
                      );
                    } finally {
                      setRetailBusy(false);
                    }
                  }}
                />
                <span>
                  Accept online retail checkout (pickup)
                  {!canManagePayouts ? ' (owner only)' : ''}
                </span>
              </label>
              ) : null}
              {depositsPaid && retailGateReason && !retailSellReady ? (
                <p className="admin-barbershop-settings__card-copy" role="status">
                  Retail blocked: {retailGateReason.replaceAll('_', ' ')}
                </p>
              ) : null}
              {depositsPaid && publicShopUrl ? (
                <p className="admin-barbershop-settings__card-copy">
                  Public shop link:{' '}
                  <a href={publicShopUrl} target="_blank" rel="noreferrer">
                    {publicShopUrl}
                  </a>
                </p>
              ) : null}
              {policySummary ? (
                <p className="admin-barbershop-settings__card-copy">
                  Policy: cancel/reschedule windows {policySummary.cancellationWindowHours}h /{' '}
                  {policySummary.rescheduleWindowHours}h · max {policySummary.maxClientReschedules}{' '}
                  client reschedules · collect ready: {depositsCollectReady ? 'yes' : 'no'} · retail
                  ready: {retailSellReady ? 'yes' : 'no'}
                </p>
              ) : null}
            </>
          )}
          {retailMessage ? (
            <p className="admin-inline-success" role="status">
              {retailMessage}
            </p>
          ) : null}
          {retailError ? (
            <p className="admin-inline-error" role="alert">
              {retailError}
            </p>
          ) : null}
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
              onClick={() => {
                if (!canCancelSubscription || cancelSubBusy || cancelAtPeriodEnd) return;
                setBillingError('');
                setBillingMessage('');
                setShowCancelChoices(true);
              }}
            >
              {cancelAtPeriodEnd ? 'Cancellation scheduled' : 'Cancel subscription'}
            </button>
            {(showCancelChoices || postFullPlanChoiceRequired) ? (
              <div className="admin-barbershop-settings__cancel-choice" role="group" aria-label="After Full KERSIVO">
                <p className="admin-barbershop-settings__card-copy">
                  What should happen when your paid Full KERSIVO period ends?
                </p>
                <label className="admin-barbershop-settings__card-copy">
                  <input
                    type="checkbox"
                    checked={starterTermsAccepted}
                    onChange={(event) => setStarterTermsAccepted(event.target.checked)}
                  />{' '}
                  I agree to the Terms if I continue on KERSIVO Starter.
                </label>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={cancelSubBusy}
                  onClick={() => void choosePostFullPlan('STARTER')}
                >
                  {cancelSubBusy ? 'Saving…' : 'Continue on KERSIVO Starter — £0/month'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={cancelSubBusy}
                  onClick={() => void choosePostFullPlan('LEAVE')}
                >
                  Leave KERSIVO after the paid period
                </button>
                {showCancelChoices && !postFullPlanChoiceRequired ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={cancelSubBusy}
                    onClick={() => setShowCancelChoices(false)}
                  >
                    Keep Full KERSIVO
                  </button>
                ) : null}
              </div>
            ) : postFullPlan === 'STARTER' && cancelAtPeriodEnd ? (
              <p className="admin-barbershop-settings__card-copy" role="status">
                After Full ends: <strong>KERSIVO Starter — £0/month</strong>.
              </p>
            ) : postFullPlan === 'LEAVE' && cancelAtPeriodEnd ? (
              <p className="admin-barbershop-settings__card-copy" role="status">
                After Full ends: <strong>Leave KERSIVO</strong>.
              </p>
            ) : null}
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
