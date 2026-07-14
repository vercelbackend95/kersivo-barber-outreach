import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';

export default function DemoActionLock() {
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      setShowAuth(false);
    };
    window.addEventListener(ADMIN_DEMO_BLOCKED_EVENT, show);
    return () => window.removeEventListener(ADMIN_DEMO_BLOCKED_EVENT, show);
  }, []);

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
      className="admin-demo-lock"
      role="dialog"
      aria-modal="true"
      aria-labelledby={showAuth ? 'private-demo-auth-title' : 'admin-demo-lock-title'}
      onClick={() => {
        setOpen(false);
        setShowAuth(false);
      }}
    >
      <div className="admin-demo-lock__card" onClick={(e) => e.stopPropagation()}>
        {showAuth ? (
          <PrivateDemoAuthPanel
            embedded
            initialMode="signup"
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
              Want to try this with your own shop?
            </p>
            <p className="admin-demo-lock__body">
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
      </div>
    </div>,
    document.body,
  );
}
