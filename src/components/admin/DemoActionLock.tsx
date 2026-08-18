import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';
import '@/styles/components/admin-login.css';

type DemoActionLockProps = {
  variant?: 'generic' | 'blackline';
};

export default function DemoActionLock({ variant = 'generic' }: DemoActionLockProps) {
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const isBlackline = variant === 'blackline';

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<{ showAuth?: boolean }>).detail;
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
        setOpen(false);
        setShowAuth(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="admin-demo-lock auth-gate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={showAuth ? 'private-demo-auth-title' : 'admin-demo-lock-title'}
      onClick={() => {
        setOpen(false);
        setShowAuth(false);
      }}
    >
      <div className="admin-demo-lock__card auth-gate-card" onClick={(e) => e.stopPropagation()}>
        {showAuth ? (
          <PrivateDemoAuthPanel
            embedded
            initialMode="signup"
            title="Log in or sign up"
            subtitle="Create a private demo admin for your shop — add barbers, services and bookings."
            signupButtonLabel="Create private demo"
            onClose={() => {
              setOpen(false);
              setShowAuth(false);
            }}
            onSuccess={() => {
              window.location.assign('/admin');
            }}
          />
        ) : (
          <>
            <button
              type="button"
              className="admin-demo-lock__close"
              aria-label="Close demo message"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <p id="admin-demo-lock-title" className="admin-demo-lock__title">
              {isBlackline ? 'Sample data' : 'Want to try this with your own shop?'}
            </p>
            <p className="admin-demo-lock__body">
              {isBlackline
                ? 'This BLACKLINE owner dashboard is read-only. Changes reset automatically and no real appointments, orders or payments are created.'
                : 'Create a private demo and add your barbers, services and bookings.'}
            </p>
            {isBlackline ? null : (
              <button
                type="button"
                className="btn btn--primary admin-demo-lock__cta"
                onClick={() => setShowAuth(true)}
              >
                Build My Demo
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
