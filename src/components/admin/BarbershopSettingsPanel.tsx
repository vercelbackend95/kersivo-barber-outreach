import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkingHourRow } from './barbersTypes';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import AdminSectionHeader from './AdminSectionHeader';
import QrKitSettingsCard from './QrKitSettingsCard';
import LeaveKersivoCard from './LeaveKersivoCard';
import { ImagePlus, X } from '../lucide-react';
import { SHOP_PAUSE_REASON_MIN_LENGTH } from '@/lib/admin/shopPublicActivityConstants';
import {
  dispatchLaunchContextRefresh,
  STRIPE_RETURN_REFRESH_DELAYS_MS,
} from '@/lib/admin/launchContextRefresh';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import '@/styles/components/admin-barbershop-settings.css';

const WEEK_DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Identity = {
  name: string;
  townCity: string | null;
  logoUrl: string | null;
};

type GoogleBookingSetupState = {
  bookingUrl: string;
  destinationSource: 'starter_hosted' | 'full_hosted_fallback' | 'full_verified_own_domain';
  status: 'NOT_SET' | 'SETUP_STARTED' | 'MERCHANT_CONFIRMED' | 'UPDATE_REQUIRED';
  requiresUpdate: boolean;
  confirmedUrl: string | null;
  googleBusinessProfileUrl: string;
  productState: string;
};

type StarterPublicLaunchPreview = {
  ready: boolean;
  stripe: {
    blocker:
      | 'connect_missing'
      | 'connect_disconnected'
      | 'connect_requires_standard'
      | 'connect_not_ready'
      | null;
  };
  activeServiceCount: number;
  servicesBelowMinimum: Array<{ id: string; name: string; pricePence: number }>;
  activeBookableBarberCount?: number | null;
  bookableBarberLimit?: number;
};

function recordStarterUpgradeEvent(event: 'viewed' | 'clicked'): void {
  void fetch('/api/admin/analytics/starter-upgrade-event', {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, placement: 'barbershop_settings_payments' }),
  }).catch(() => {});
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

const STARTER_STRIPE_BLOCKER_COPY: Record<NonNullable<StarterPublicLaunchPreview['stripe']['blocker']>, string> = {
  connect_missing: 'Connect Stripe — Starter online bookings are paid through your own Stripe account.',
  connect_disconnected: 'Reconnect Stripe — your Stripe account is disconnected.',
  connect_requires_standard:
    'Connect Stripe Standard — Starter online bookings need a Stripe Standard account.',
  connect_not_ready: 'Finish Stripe setup — your Stripe account cannot take payments yet.',
};

function StarterLaunchBlockers({ preview }: { preview: StarterPublicLaunchPreview | null }) {
  if (!preview || preview.ready) return null;
  const stripeCopy = preview.stripe.blocker ? STARTER_STRIPE_BLOCKER_COPY[preview.stripe.blocker] : null;
  return (
    <div className="admin-barbershop-settings__card-copy" role="note" data-testid="starter-launch-blockers">
      <p>
        <strong>New online bookings will be paused on Starter until you fix:</strong>
      </p>
      <ul>
        {stripeCopy ? <li>{stripeCopy}</li> : null}
        {preview.activeServiceCount === 0 ? <li>Add at least one active service.</li> : null}
        {preview.servicesBelowMinimum.map((service) => (
          <li key={service.id}>
            {service.name} ({formatPence(service.pricePence)}) — raise to £5 or more, or make it inactive.
          </li>
        ))}
        {preview.bookableBarberLimit != null &&
        preview.activeBookableBarberCount != null &&
        preview.activeBookableBarberCount > preview.bookableBarberLimit ? (
          <li>
            {preview.activeBookableBarberCount} barbers take online bookings — Starter allows up to{' '}
            {preview.bookableBarberLimit}. Choose which {preview.bookableBarberLimit} stay bookable in Team.
          </li>
        ) : null}
      </ul>
      <p>Prices are never changed automatically. Your account, data and accepted bookings stay.</p>
    </div>
  );
}

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
  const [paymentControlsEditable, setPaymentControlsEditable] = useState(false);
  const [depositsCollectReady, setDepositsCollectReady] = useState(false);
  const [connectChargesEnabled, setConnectChargesEnabled] = useState(false);
  const [stripePaymentsReady, setStripePaymentsReady] = useState(false);
  const [stripeReturnParam] = useState(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('connect'),
  );
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

  const [googleBooking, setGoogleBooking] = useState<GoogleBookingSetupState | null>(null);
  const [googleBookingLoading, setGoogleBookingLoading] = useState(false);
  const [googleBookingBusy, setGoogleBookingBusy] = useState(false);
  const [googleBookingError, setGoogleBookingError] = useState('');
  const [googleBookingMessage, setGoogleBookingMessage] = useState('');

  const [billingPhase, setBillingPhase] = useState<string | null>(null);
  const [billingLabel, setBillingLabel] = useState<string | null>(null);
  const [hasBillingPortal, setHasBillingPortal] = useState(false);
  const [allowsDataExport, setAllowsDataExport] = useState(false);
  const [exportConsumed, setExportConsumed] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [canCancelSubscription, setCanCancelSubscription] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [postFullPlan, setPostFullPlan] = useState<string | null>(null);
  const [postFullTermsCurrent, setPostFullTermsCurrent] = useState(true);
  const [postFullPlanChoiceRequired, setPostFullPlanChoiceRequired] = useState(false);
  const [starterPublicLaunch, setStarterPublicLaunch] = useState<StarterPublicLaunchPreview | null>(null);
  const [fullEndsOn, setFullEndsOn] = useState<string | null>(null);
  const [showCancelChoices, setShowCancelChoices] = useState(false);
  const [starterTermsAccepted, setStarterTermsAccepted] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [cancelSubBusy, setCancelSubBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingMessage, setBillingMessage] = useState('');
  const starterPaymentUpgradeViewTracked = useRef(false);

  useEffect(() => {
    if (
      starterPaymentUpgradeViewTracked.current ||
      loading ||
      bookingProductState !== 'FREE_BOOKING' ||
      paymentControlsEditable
    ) {
      return;
    }
    starterPaymentUpgradeViewTracked.current = true;
    trackConsentedEvent(
      FUNNEL_EVENTS.starter_payment_settings_upgrade_viewed,
      { placement: 'barbershop_settings_payments' },
      'analytics',
    );
    recordStarterUpgradeEvent('viewed');
  }, [bookingProductState, loading, paymentControlsEditable]);

  const loadGoogleBooking = useCallback(async () => {
    setGoogleBookingLoading(true);
    setGoogleBookingError('');
    try {
      const response = await fetch('/api/admin/barbershop-settings/google-booking', {
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as
        | (GoogleBookingSetupState & { error?: string })
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload && 'error' in payload && payload.error
          ? payload.error
          : 'Could not load Google booking setup.');
      }
      setGoogleBooking(payload as GoogleBookingSetupState);
    } catch (error) {
      setGoogleBooking(null);
      setGoogleBookingError(
        error instanceof Error ? error.message : 'Could not load Google booking setup.',
      );
    } finally {
      setGoogleBookingLoading(false);
    }
  }, []);

  const updateGoogleBooking = useCallback(
    async (action: 'START_SETUP' | 'CONFIRM_CURRENT_URL' | 'RESET') => {
      if (googleBookingBusy) return null;
      setGoogleBookingBusy(true);
      setGoogleBookingError('');
      setGoogleBookingMessage('');
      try {
        const response = await fetch('/api/admin/barbershop-settings/google-booking', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const payload = (await response.json().catch(() => null)) as
          | (GoogleBookingSetupState & { error?: string })
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload && 'error' in payload && payload.error
            ? payload.error
            : 'Could not update Google booking setup.');
        }
        const next = payload as GoogleBookingSetupState;
        setGoogleBooking(next);
        if (action === 'CONFIRM_CURRENT_URL') {
          setGoogleBookingMessage('Google booking link marked as updated.');
        } else if (action === 'RESET') {
          setGoogleBookingMessage('Google booking setup reset.');
        }
        return next;
      } catch (error) {
        setGoogleBookingError(
          error instanceof Error ? error.message : 'Could not update Google booking setup.',
        );
        return null;
      } finally {
        setGoogleBookingBusy(false);
      }
    },
    [googleBookingBusy],
  );

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
        setPostFullTermsCurrent(true);
        setPostFullPlanChoiceRequired(false);
        setStarterPublicLaunch(null);
        setFullEndsOn(null);
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
        postFullTermsCurrent?: boolean;
        postFullPlanChoiceRequired?: boolean;
        starterPublicLaunch?: StarterPublicLaunchPreview | null;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || 'Could not load billing status.');
      }
      setStarterPublicLaunch(data?.starterPublicLaunch ?? null);

      setHasSubscription(Boolean(data?.hasSubscription));
      setHasBillingPortal(Boolean(data?.hasPortalAccess));
      setAllowsDataExport(Boolean(data?.allowsExport));
      setExportConsumed(Boolean(data?.exportConsumed));
      setCanCancelSubscription(Boolean(data?.canCancelSubscription));
      setCancelAtPeriodEnd(Boolean(data?.cancelAtPeriodEnd));
      setPostFullPlan(data?.postFullPlan ?? null);
      setPostFullTermsCurrent(data?.postFullTermsCurrent !== false);
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
      setFullEndsOn(data?.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : null);

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

  const loadDeposits = useCallback(async (): Promise<boolean> => {
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
        paymentControlsEditable?: boolean;
        starterPaymentPolicy?: {
          minimumOnlinePaymentPence?: number;
          payInFullAvailable?: boolean;
          publicPayAtShop?: boolean;
        } | null;
        depositsEnabled?: boolean;
        bookingPaymentsReady?: boolean;
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
      setPaymentControlsEditable(Boolean(payload?.paymentControlsEditable));
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
      setStripePaymentsReady(Boolean(payload?.bookingPaymentsReady));
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
      return Boolean(payload?.bookingPaymentsReady);
    } catch (error) {
      setDepositsError(error instanceof Error ? error.message : 'Could not load booking payment settings.');
      return false;
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
      // The deposits GET may persist fresher Connect state, so the sidebar re-reads afterwards.
      void loadDeposits().then(() => dispatchLaunchContextRefresh());
      void loadBilling();
      void loadGoogleBooking();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load barbershop settings.');
    } finally {
      setLoading(false);
    }
    // Intentionally omit onPauseChanged from deps — parent passes setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeposits, loadBilling, loadGoogleBooking]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const connect = stripeReturnParam;
    if (connect !== 'return' && connect !== 'refresh') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('connect');
    const next = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`,
    );

    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    void (async () => {
      if (connect === 'refresh') {
        await loadDeposits();
        if (cancelled) return;
        dispatchLaunchContextRefresh();
        setDepositsError('Stripe onboarding was interrupted. Click the Stripe button to continue.');
        return;
      }
      setDepositsMessage('Returned from Stripe — checking Connect status…');
      // Stripe readiness can lag the redirect slightly: bounded retries, never an endless poll.
      let previousDelay = 0;
      for (const delay of STRIPE_RETURN_REFRESH_DELAYS_MS) {
        if (delay > previousDelay) await wait(delay - previousDelay);
        previousDelay = delay;
        if (cancelled) return;
        const ready = await loadDeposits();
        if (cancelled) return;
        dispatchLaunchContextRefresh();
        if (ready) {
          setDepositsMessage('Stripe connected — ready for booking payments.');
          return;
        }
      }
      setDepositsMessage('Stripe is still finishing your account setup. Check back in a moment.');
    })();

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [loadDeposits, stripeReturnParam]);

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

        <section className="admin-barbershop-settings__card" aria-labelledby="bbs-deposits-title">
          <h2 id="bbs-deposits-title" className="admin-barbershop-settings__card-title">
            Booking payments
          </h2>
          {bookingProductState === 'FREE_BOOKING' ? (
            <p className="admin-barbershop-settings__card-copy">
              Starter keeps public booking payments simple: for services above £5, clients choose a
              £5 deposit or Pay in full. A £5 service is paid in full. Pay at shop is not available
              for customer-created Starter bookings; manual staff-created bookings may still be paid
              at the shop.
            </p>
          ) : (
            <p className="admin-barbershop-settings__card-copy">
              Choose whether clients pay at the shop, pay a £5 deposit online, or pay the full
              service price upfront when they book. Payments are refunded if the client cancels
              inside your policy window or you cancel. On a late cancel or no-show you keep the
              deposit, or up to £5 of a full upfront payment.
            </p>
          )}
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
                {stripePaymentsReady ? null : canManagePayouts ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    data-stripe-connect-action
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
                    {depositsBusy
                      ? 'Opening Stripe…'
                      : connectDisconnected
                        ? 'Reconnect Stripe'
                        : connectAccountLinked
                          ? 'Finish Stripe setup'
                          : 'Connect Stripe'}
                  </button>
                ) : (
                  <p className="admin-barbershop-settings__card-copy" role="status">
                    The shop owner connects Stripe and manages booking payment settings. You can
                    see the current status below.
                  </p>
                )}
                <span className="muted" data-stripe-connect-status>
                  {stripePaymentsReady
                    ? '✓ Stripe connected — ready for booking payments'
                    : connectDisconnected
                      ? 'Stripe disconnected — reconnect to take online payments'
                      : connectAccountLinked
                        ? 'Stripe setup not finished yet'
                        : 'Not connected'}
                </span>
              </div>
              {paymentControlsEditable ? (
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
  
              ) : bookingProductState === 'FREE_BOOKING' ? (
                <div className="admin-barbershop-settings__starter-payment-policy" data-starter-payment-policy>
                  <p><strong>Starter payment setup</strong></p>
                  <ul>
                    <li>£5 online payment required</li>
                    <li>Pay in full available</li>
                    <li>Public Pay at shop unavailable</li>
                    <li>0% KERSIVO commission</li>
                  </ul>
                  <p className="admin-barbershop-settings__card-copy">
                    Want full control over how clients pay? Full KERSIVO unlocks Pay at shop, £5
                    deposit and full-payment controls.
                  </p>
                  <a
                    className="btn btn--primary"
                    href="/admin/upgrade"
                    onClick={() => {
                      trackConsentedEvent(
                        FUNNEL_EVENTS.starter_payment_settings_upgrade_clicked,
                        { placement: 'barbershop_settings_payments' },
                        'analytics',
                      );
                      recordStarterUpgradeEvent('clicked');
                    }}
                  >
                    Unlock payment controls — £39/month
                  </a>
                </div>
              ) : null}
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

        <section
          className="admin-barbershop-settings__card"
          aria-labelledby="bbs-google-booking-title"
          data-google-booking-card
        >
          <h2 id="bbs-google-booking-title" className="admin-barbershop-settings__card-title">
            Google booking link
          </h2>
          <p className="admin-barbershop-settings__card-copy">
            Add your KERSIVO booking page to your Google Business Profile so customers can reach
            your booking flow from Google Search or Maps where Google makes booking links available.
          </p>

          {googleBookingLoading ? (
            <p className="muted" role="status">Loading Google booking setup…</p>
          ) : googleBooking ? (
            <>
              <p className="admin-barbershop-settings__card-copy" role="status">
                Status:{' '}
                <strong data-google-booking-status={googleBooking.status}>
                  {googleBooking.status === 'MERCHANT_CONFIRMED'
                    ? 'Merchant confirmed'
                    : googleBooking.status === 'SETUP_STARTED'
                      ? 'Setup started'
                      : googleBooking.status === 'UPDATE_REQUIRED'
                        ? 'Update required'
                        : 'Not set'}
                </strong>
              </p>

              {googleBooking.requiresUpdate ? (
                <p className="admin-inline-error" role="alert" data-google-booking-update-required>
                  Your KERSIVO booking destination has changed. Update the booking link in Google
                  to the URL below, then confirm it here again.
                </p>
              ) : null}

              <div className="field">
                <label className="field__label" htmlFor="bbs-google-booking-url">
                  Booking URL
                </label>
                <input
                  id="bbs-google-booking-url"
                  className="input"
                  value={googleBooking.bookingUrl}
                  readOnly
                  spellCheck={false}
                />
              </div>

              <div className="admin-barbershop-settings__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={googleBookingBusy}
                  onClick={async () => {
                    setGoogleBookingError('');
                    setGoogleBookingMessage('');
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(googleBooking.bookingUrl);
                      } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = googleBooking.bookingUrl;
                        textarea.setAttribute('readonly', '');
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        textarea.remove();
                      }
                      setGoogleBookingMessage('Booking link copied.');
                    } catch {
                      setGoogleBookingError('Could not copy the booking link. Select and copy it manually.');
                    }
                  }}
                >
                  Copy booking link
                </button>

                <a
                  className="btn btn--secondary"
                  href={googleBooking.googleBusinessProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    if (
                      googleBooking.status !== 'MERCHANT_CONFIRMED' ||
                      googleBooking.requiresUpdate
                    ) {
                      void updateGoogleBooking('START_SETUP');
                    }
                  }}
                >
                  Open Google Business Profile
                </a>

                {googleBooking.status !== 'MERCHANT_CONFIRMED' || googleBooking.requiresUpdate ? (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={googleBookingBusy}
                    onClick={() => void updateGoogleBooking('CONFIRM_CURRENT_URL')}
                  >
                    {googleBookingBusy ? 'Saving…' : "I've updated Google"}
                  </button>
                ) : null}
              </div>

              <ol className="admin-barbershop-settings__card-copy">
                <li>Open the Google account that manages your Business Profile.</li>
                <li>Find the booking, appointment or links section for this location.</li>
                <li>Add or replace the booking link with the exact URL shown above.</li>
                <li>Save the change in Google, then return here and confirm it.</li>
              </ol>

              {googleBooking.destinationSource === 'full_hosted_fallback' ? (
                <p className="muted" data-google-full-hosted-fallback>
                  Your KERSIVO-hosted booking link remains active while your Full site/domain is
                  being prepared. Once booking on your own domain is verified live, KERSIVO will
                  flag the Google link here for updating.
                </p>
              ) : null}
              {googleBooking.destinationSource === 'full_verified_own_domain' ? (
                <p className="muted" data-google-full-own-domain>
                  Booking on your own domain is live. This is your live Full KERSIVO booking
                  destination. KERSIVO does not edit Google for you — update the link there yourself.
                </p>
              ) : null}

              <p className="muted">
                Google controls Business Profile eligibility and where booking actions appear.
                KERSIVO provides the booking destination but cannot guarantee that Google displays
                a Book button in a particular placement.
              </p>
            </>
          ) : null}

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

        <QrKitSettingsCard />

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
            {hasSubscription ? (
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
            ) : null}
            {(showCancelChoices || postFullPlanChoiceRequired) ? (
              <div className="admin-barbershop-settings__cancel-choice" role="group" aria-label="After Full KERSIVO">
                <p className="admin-barbershop-settings__card-copy">
                  What should happen when your paid Full KERSIVO period ends
                  {fullEndsOn ? ` on ${fullEndsOn}` : ''}?
                </p>
                {postFullPlan === 'STARTER' && !postFullTermsCurrent ? (
                  <p className="admin-barbershop-settings__card-copy" role="status" data-testid="starter-terms-refresh">
                    <strong>KERSIVO Terms have been updated.</strong> Re-accept the current Terms to keep
                    KERSIVO Starter as your post-Full plan.
                  </p>
                ) : null}
                <div className="admin-barbershop-settings__card-copy" data-testid="starter-downgrade-summary">
                  <p>
                    <strong>KERSIVO Starter</strong> starts after your paid Full period: £0/month, 0% KERSIVO
                    commission. Your account, team (up to 4 bookable barbers), services, clients and accepted
                    bookings stay.
                  </p>
                  <p>
                    Starter online bookings take a fixed £5 payment through your own Stripe account (clients
                    may pay in full). Every active service must be £5 or more. No Pay at shop for online
                    bookings.
                  </p>
                  <p>
                    Reports, Retail, Advanced Clients, SMS, Assistant and your own domain lock. QR codes and
                    your Google booking link use your KERSIVO-hosted booking page.
                  </p>
                </div>
                <StarterLaunchBlockers preview={starterPublicLaunch} />
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
              <>
                <p className="admin-barbershop-settings__card-copy" role="status">
                  After Full ends: <strong>KERSIVO Starter — £0/month</strong>.
                </p>
                <StarterLaunchBlockers preview={starterPublicLaunch} />
              </>
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

        <LeaveKersivoCard />

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
