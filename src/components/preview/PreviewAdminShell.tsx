import React, { useEffect, useState } from 'react';
import AdminPanel from '@/components/admin/AdminPanel';

/**
 * Real AdminPanel for guest preview cookie sessions.
 * Soft subscribe CTA sits above the panel; missing cookie links back to onboarding.
 */
export default function PreviewAdminShell() {
  const [gate, setGate] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        if (cancelled) return;
        if (!response.ok) {
          setGate('denied');
          return;
        }
        setGate('ok');
      } catch {
        if (!cancelled) setGate('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate === 'loading') {
    return (
      <div className="preview-admin-shell preview-admin-shell--loading" role="status">
        Loading your dashboard…
      </div>
    );
  }

  if (gate === 'denied') {
    return (
      <div className="preview-admin-shell preview-admin-shell--gate">
        <h1 className="preview-admin-shell__title">Preview session expired</h1>
        <p className="preview-admin-shell__lede">
          Build your barbershop again to open the real KERSIVO admin for your shop.
        </p>
        <a className="btn btn--primary btn--lg" href="/preview/onboarding">
          Build my barbershop
        </a>
      </div>
    );
  }

  return (
    <div className="preview-admin-shell">
      <div className="preview-admin-shell__banner">
        <p className="preview-admin-shell__banner-copy">
          This is your live admin preview. Subscribe to keep the shop and go live.
        </p>
        <a className="btn btn--secondary btn--sm" href="/admin/launch">
          Get started — £39/month
        </a>
      </div>
      <AdminPanel />
    </div>
  );
}
