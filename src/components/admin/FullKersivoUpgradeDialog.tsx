import React, { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from '../lucide-react';
import type { SerializedKersivoAccess } from '@/lib/shop/kersivoAccess';
import { FULL_KERSIVO_FEATURE_LABELS, type FullKersivoFeature } from '@/lib/admin/productLocks';
import '@/styles/components/admin-login.css';
import '@/styles/components/admin-demo.css';
import '@/styles/components/admin-full-kersivo-upgrade.css';

/**
 * Temporary, non-destructive upgrade destination until authenticated one-click upgrade
 * checkout exists. Never starts a subscription checkout from here.
 */
export const FULL_KERSIVO_UPGRADE_HREF = '/pricing';

export const FULL_KERSIVO_UPGRADE_COPY = {
  heading: 'Unlock Full KERSIVO',
  body: 'Upgrade to access Reports, Clients, Retail, Assistant and your full booking history.',
  price: '£39/month per location',
  fee: '0% KERSIVO platform fee on booking and retail payments. Stripe processing fees apply.',
  cta: 'Upgrade to Full KERSIVO',
  dismiss: 'Not now',
} as const;

type AdminProductLocks = {
  /** Null when nothing is plan-locked (Full, demo, preview, legacy access). */
  gate: SerializedKersivoAccess | null;
  openUpgrade: (feature: FullKersivoFeature) => void;
};

const AdminProductLockContext = createContext<AdminProductLocks>({
  gate: null,
  openUpgrade: () => {},
});

export const AdminProductLockProvider = AdminProductLockContext.Provider;

export function useAdminProductLocks(): AdminProductLocks {
  return useContext(AdminProductLockContext);
}

function UpgradeCopy({
  feature,
  titleId,
  descId,
  onDismiss,
}: {
  feature: FullKersivoFeature;
  titleId: string;
  descId: string;
  onDismiss?: () => void;
}) {
  return (
    <>
      <p className="admin-full-upgrade__eyebrow">
        <Lock width={13} height={13} aria-hidden="true" />
        {FULL_KERSIVO_FEATURE_LABELS[feature]}
      </p>
      <p id={titleId} className="admin-demo-lock__title">
        {FULL_KERSIVO_UPGRADE_COPY.heading}
      </p>
      <p id={descId} className="admin-demo-lock__body">
        {FULL_KERSIVO_UPGRADE_COPY.body}
      </p>
      <p className="admin-full-upgrade__price">{FULL_KERSIVO_UPGRADE_COPY.price}</p>
      <p className="admin-full-upgrade__fee">{FULL_KERSIVO_UPGRADE_COPY.fee}</p>
      <div className="admin-full-upgrade__actions">
        <a
          className="btn btn--primary admin-demo-lock__cta"
          href={FULL_KERSIVO_UPGRADE_HREF}
          data-upgrade-feature={feature}
        >
          {FULL_KERSIVO_UPGRADE_COPY.cta}
        </a>
        {onDismiss ? (
          <button type="button" className="admin-demo-lock__explore" onClick={onDismiss}>
            {FULL_KERSIVO_UPGRADE_COPY.dismiss}
          </button>
        ) : null}
      </div>
    </>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type FullKersivoUpgradeDialogProps = {
  /** What was clicked; null = closed. */
  feature: FullKersivoFeature | null;
  onClose: () => void;
};

/** The single Full KERSIVO upgrade dialog used by every plan lock in the dashboard. */
export default function FullKersivoUpgradeDialog({ feature, onClose }: FullKersivoUpgradeDialogProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const open = feature !== null;

  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement ? active : null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = overlayRef.current;
      if (!root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      window.cancelAnimationFrame(frame);
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!feature || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="admin-demo-lock auth-gate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-kersivo-upgrade-title"
      aria-describedby="full-kersivo-upgrade-desc"
      onClick={onClose}
    >
      <div className="admin-demo-lock__card auth-gate-card" onClick={(event) => event.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          className="admin-demo-lock__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <UpgradeCopy
          feature={feature}
          titleId="full-kersivo-upgrade-title"
          descId="full-kersivo-upgrade-desc"
          onDismiss={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}

/** In-place lock for a plan-locked section reached by URL (deep link / back-forward). */
export function FullKersivoLockedSection({ feature }: { feature: FullKersivoFeature }) {
  return (
    <section
      className="admin-full-upgrade-section"
      aria-labelledby="full-kersivo-locked-title"
      data-locked-feature={feature}
    >
      <div className="auth-gate-card admin-full-upgrade-section__card">
        <UpgradeCopy
          feature={feature}
          titleId="full-kersivo-locked-title"
          descId="full-kersivo-locked-desc"
        />
      </div>
    </section>
  );
}
