import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OWNER_LAUNCH_HREF } from '@/lib/admin/launchCtaProgress';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { ArrowRight, Shield, Store } from '../lucide-react';
import { ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';
import '@/styles/components/admin-login.css';
import '@/styles/components/admin-demo.css';

type DemoActionLockProps = {
  variant?: 'generic' | 'blackline';
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function DemoActionLock({ variant = 'generic' }: DemoActionLockProps) {
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const isBlackline = variant === 'blackline';

  const dismiss = useCallback(() => {
    setOpen(false);
    setShowAuth(false);
  }, []);

  const onCreateClick = useCallback(() => {
    trackConsentedEvent(
      FUNNEL_EVENTS.blackline_admin_create_system_click,
      { source: 'admin_demo_lock' },
      'analytics',
    );
  }, []);

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<{ showAuth?: boolean }>).detail;
      const active = document.activeElement;
      if (active instanceof HTMLElement) triggerRef.current = active;
      setOpen(true);
      setShowAuth(!isBlackline && Boolean(detail?.showAuth));
    };
    window.addEventListener(ADMIN_DEMO_BLOCKED_EVENT, show);
    return () => window.removeEventListener(ADMIN_DEMO_BLOCKED_EVENT, show);
  }, [isBlackline]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = overlayRef.current;
      if (!root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true',
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const frame = window.requestAnimationFrame(() => {
      closeRef.current?.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.cancelAnimationFrame(frame);
    };
  }, [open, dismiss, showAuth]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    triggerRef.current?.focus();
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="admin-demo-lock auth-gate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={showAuth ? 'private-demo-auth-title' : 'admin-demo-lock-title'}
      aria-describedby={showAuth ? undefined : 'admin-demo-lock-desc'}
      onClick={dismiss}
    >
      <div
        className={`admin-demo-lock__card auth-gate-card${isBlackline ? ' admin-demo-lock__card--blackline' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showAuth ? (
          <PrivateDemoAuthPanel
            embedded
            initialMode="signup"
            title="Log in or sign up"
            subtitle="Create a private demo admin for your shop — add barbers, services and bookings."
            signupButtonLabel="Create private demo"
            onClose={dismiss}
            onSuccess={() => {
              window.location.assign('/admin');
            }}
          />
        ) : (
          <>
            <button
              ref={closeRef}
              type="button"
              className="admin-demo-lock__close"
              aria-label="Close demo message"
              onClick={dismiss}
            >
              ×
            </button>
            {isBlackline ? (
              <>
                <p className="admin-demo-lock__eyebrow">
                  <Shield width={14} height={14} aria-hidden="true" />
                  DEMO MODE
                </p>
                <p id="admin-demo-lock-title" className="admin-demo-lock__title">
                  Sample data
                </p>
                <p id="admin-demo-lock-desc" className="admin-demo-lock__body">
                  This BLACKLINE owner dashboard is read-only. Changes reset automatically and no real
                  appointments, orders or payments are created.
                </p>
                <hr className="admin-demo-lock__rule" />
                <p className="admin-demo-lock__convert-title">Ready to make it yours?</p>
                <p className="admin-demo-lock__convert-body">
                  Create your own KERSIVO barbershop and customise your services, products, team and
                  opening hours.
                </p>
                <a
                  className="admin-demo-lock__create"
                  href={OWNER_LAUNCH_HREF}
                  data-astro-reload=""
                  onClick={onCreateClick}
                >
                  <Store width={16} height={16} aria-hidden="true" />
                  CREATE MY BARBERSHOP
                  <ArrowRight width={16} height={16} aria-hidden="true" />
                </a>
                <button type="button" className="admin-demo-lock__explore" onClick={dismiss}>
                  Continue exploring
                </button>
              </>
            ) : (
              <>
                <p id="admin-demo-lock-title" className="admin-demo-lock__title">
                  Want to try this with your own shop?
                </p>
                <p id="admin-demo-lock-desc" className="admin-demo-lock__body">
                  Create a private demo and add your barbers, services and bookings.
                </p>
                <button
                  type="button"
                  className="btn btn--primary admin-demo-lock__cta"
                  onClick={() => setShowAuth(true)}
                >
                  Build My Demo
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
