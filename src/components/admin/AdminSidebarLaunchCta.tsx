import React, { useEffect, useMemo, useState } from 'react';
import { ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import AdminLaunchCtaButton from './AdminLaunchCtaButton';
import {
  demoLaunchProgress,
  emptyLaunchProgress,
  OWNER_LAUNCH_HREF,
  resolveLaunchCtaPresentation,
  resolveStarterLaunchCtaPresentation,
  STARTER_QR_KIT_SETTINGS_HREF,
  type LaunchProgress,
  type StarterLaunchState,
} from '@/lib/admin/launchCtaProgress';
import { LAUNCH_CONTEXT_REFRESH_EVENT } from '@/lib/admin/launchContextRefresh';
import { parseAdminSpaHref } from '@/lib/admin/sectionUrl';
import '@/styles/components/admin-sidebar-launch-cta.css';

type LaunchContextPayload = {
  pending?: { plan?: string } | null;
  paid?: boolean;
  paidHref?: string | null;
  progress?: LaunchProgress;
  productState?: string;
  starterLaunch?: StarterLaunchState | null;
};

type AdminSidebarLaunchCtaProps = {
  isPublicDemo?: boolean;
  onSpaSection?: (section: import('./AdminPanel').AdminSection) => void;
  /** Free Booking: the paid launch step opens the Full KERSIVO upgrade dialog instead. */
  onUpgrade?: () => void;
};

export default function AdminSidebarLaunchCta({
  isPublicDemo = false,
  onSpaSection,
  onUpgrade,
}: AdminSidebarLaunchCtaProps) {
  const [loading, setLoading] = useState(!isPublicDemo);
  const [progress, setProgress] = useState<LaunchProgress>(() =>
    isPublicDemo ? demoLaunchProgress() : emptyLaunchProgress(),
  );
  const [pending, setPending] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidHref, setPaidHref] = useState<string | null>(null);
  const [productState, setProductState] = useState<string | null>(null);
  const [starterLaunch, setStarterLaunch] = useState<StarterLaunchState | null>(null);
  const [starterActionBusy, setStarterActionBusy] = useState(false);
  const [starterActionError, setStarterActionError] = useState('');

  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (isPublicDemo) return;
    const onRefresh = () => setRefreshToken((token) => token + 1);
    window.addEventListener(LAUNCH_CONTEXT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(LAUNCH_CONTEXT_REFRESH_EVENT, onRefresh);
  }, [isPublicDemo]);

  useEffect(() => {
    if (isPublicDemo) {
      setProgress(demoLaunchProgress());
      setPending(false);
      setPaid(false);
      setPaidHref(null);
      setProductState(null);
      setStarterLaunch(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/setup/launch-context', { credentials: 'include' });
        if (cancelled) return;

        if (!response.ok) {
          setProgress(emptyLaunchProgress());
          setPending(false);
          setPaid(false);
          setPaidHref(null);
          setProductState(null);
          setStarterLaunch(null);
          return;
        }

        const data = (await response.json()) as LaunchContextPayload;
        if (data.progress?.steps?.length) {
          setProgress(data.progress);
        } else {
          setProgress(emptyLaunchProgress());
        }
        setPending(Boolean(data.pending));
        setPaid(Boolean(data.paid));
        setPaidHref(typeof data.paidHref === 'string' ? data.paidHref : null);
        setProductState(typeof data.productState === 'string' ? data.productState : null);
        setStarterLaunch(data.starterLaunch ?? null);
      } catch {
        if (!cancelled) {
          setProgress(emptyLaunchProgress());
          setPending(false);
          setPaid(false);
          setPaidHref(null);
          setProductState(null);
          setStarterLaunch(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPublicDemo, refreshToken]);

  const presentation = useMemo(
    () => resolveLaunchCtaPresentation({ progress, pending, paid, paidHref }),
    [progress, pending, paid, paidHref],
  );

  const starterPresentation = useMemo(
    () =>
      productState === 'FREE_BOOKING' && starterLaunch
        ? resolveStarterLaunchCtaPresentation(progress, starterLaunch)
        : null,
    [productState, progress, starterLaunch],
  );

  const handleClick = async () => {
    if (loading || starterActionBusy) return;
    if (isPublicDemo) {
      window.dispatchEvent(
        new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT, {
          detail: { showAuth: true },
        }),
      );
      return;
    }

    if (starterPresentation?.action === 'stripe') {
      setStarterActionBusy(true);
      setStarterActionError('');
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
          throw new Error(payload?.error || 'Could not start Stripe setup.');
        }
        window.location.assign(payload.url);
      } catch (error) {
        setStarterActionError(
          error instanceof Error ? error.message : 'Could not start Stripe setup.',
        );
        setStarterActionBusy(false);
      }
      return;
    }

    if (starterPresentation?.action === 'upgrade') {
      if (onUpgrade) onUpgrade();
      else window.location.assign('/admin/upgrade');
      return;
    }

    const targetHref =
      starterPresentation?.action === 'navigate'
        ? starterPresentation.href ?? '/admin'
        : presentation.href;

    if (onUpgrade && targetHref.startsWith(OWNER_LAUNCH_HREF)) {
      onUpgrade();
      return;
    }
    const spaSection = parseAdminSpaHref(targetHref);
    const onAdminSpa =
      window.location.pathname === '/admin' || window.location.pathname === '/admin-demo';
    if (spaSection && onAdminSpa && onSpaSection) {
      onSpaSection(spaSection);
      return;
    }
    window.location.assign(targetHref);
  };

  if (loading) {
    return (
      <div
        className="admin-sidebar-launch-cta admin-sidebar-launch-cta--loading"
        aria-busy="true"
        aria-label="Loading launch status"
      >
        <span className="admin-sidebar-launch-cta__skeleton admin-sidebar-launch-cta__skeleton--status" />
        <span className="admin-sidebar-launch-cta__skeleton admin-sidebar-launch-cta__skeleton--title" />
        <span className="admin-sidebar-launch-cta__skeleton admin-sidebar-launch-cta__skeleton--checklist" />
      </div>
    );
  }

  // Starter entitlement is authoritative: a stale paid marker after Full → Starter must not hide
  // the Starter launch / recovery CTA. Once live, the same card becomes the Full upgrade surface.
  if (starterPresentation && !isPublicDemo) {
    const checklist = starterPresentation.liveChecklist ?? progress.steps;
    const showQrAction =
      starterPresentation.action === 'upgrade' && !starterLaunch?.qrKitRequested;
    return (
      <div>
        <AdminLaunchCtaButton
          title={starterActionBusy ? 'Opening Stripe…' : starterPresentation.title}
          status={starterPresentation.status}
          supporting={starterPresentation.supporting || undefined}
          ariaLabel={`${starterPresentation.status}: ${starterPresentation.title}`}
          onClick={() => void handleClick()}
          conversion
        >
          <ul className="admin-sidebar-launch-cta__checklist">
            {checklist.map((step) => (
              <li
                key={step.id}
                className={`admin-sidebar-launch-cta__check${
                  step.done ? ' admin-sidebar-launch-cta__check--done' : ' admin-sidebar-launch-cta__check--todo'
                }`}
              >
                <span className="admin-sidebar-launch-cta__mark" aria-hidden="true">
                  {step.done ? '✓' : '○'}
                </span>
                <span className="admin-sidebar-launch-cta__check-label">{step.label}</span>
              </li>
            ))}
          </ul>
        </AdminLaunchCtaButton>
        {showQrAction ? (
          <button
            type="button"
            className="admin-sidebar-launch-cta__secondary"
            onClick={() => {
              const onAdminSpa = window.location.pathname === '/admin';
              if (onAdminSpa && onSpaSection) {
                onSpaSection('barbershop_settings');
                window.setTimeout(() => {
                  document.getElementById('qr-kit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
                return;
              }
              window.location.assign(STARTER_QR_KIT_SETTINGS_HREF);
            }}
          >
            Order QR Kit
          </button>
        ) : null}
        {starterActionError ? (
          <p className="admin-sidebar-launch-cta__error" role="alert">{starterActionError}</p>
        ) : null}
      </div>
    );
  }

  // Paying tenants (shopPaidAt / SaaS) — hide purchase / launch CTA entirely.
  if (paid && !isPublicDemo) {
    return null;
  }

  return (
    <AdminLaunchCtaButton
      title={presentation.title}
      status={presentation.status}
      ariaLabel={`${presentation.status}: ${presentation.title}. ${presentation.doneCount} of ${presentation.totalCount} complete.`}
      onClick={() => void handleClick()}
    >
      <ul className="admin-sidebar-launch-cta__checklist">
        {progress.steps.map((step) => (
          <li
            key={step.id}
            className={`admin-sidebar-launch-cta__check${
              step.done ? ' admin-sidebar-launch-cta__check--done' : ' admin-sidebar-launch-cta__check--todo'
            }`}
          >
            <span className="admin-sidebar-launch-cta__mark" aria-hidden="true">
              {step.done ? '✓' : '○'}
            </span>
            <span className="admin-sidebar-launch-cta__check-label">{step.label}</span>
          </li>
        ))}
      </ul>
    </AdminLaunchCtaButton>
  );
}
