import React, { useEffect, useState } from 'react';
import { Store } from '../lucide-react';
import { ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import '@/styles/components/admin-sidebar-launch-cta.css';

type LaunchCtaKind = 'launch' | 'continue';

type LaunchContextPayload = {
  pending?: { plan?: string } | null;
};

const LAUNCH_STATE = {
  launch: {
    kind: 'launch' as const,
    status: 'READY TO LAUNCH',
    title: 'Launch My Barbershop',
    support: 'Your setup is ready.',
    href: '/admin/launch',
  },
  continue: {
    kind: 'continue' as const,
    status: 'IN PROGRESS',
    title: 'Continue Purchase',
    support: 'Complete your launch.',
    href: '/admin/launch?step=2',
  },
};

type AdminSidebarLaunchCtaProps = {
  isPublicDemo?: boolean;
};

export default function AdminSidebarLaunchCta({ isPublicDemo = false }: AdminSidebarLaunchCtaProps) {
  const [loading, setLoading] = useState(!isPublicDemo);
  const [kind, setKind] = useState<LaunchCtaKind>('launch');

  useEffect(() => {
    if (isPublicDemo) {
      setLoading(false);
      setKind('launch');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/setup/launch-context', { credentials: 'include' });
        if (cancelled) return;

        if (!response.ok) {
          setKind('launch');
          return;
        }

        const data = (await response.json()) as LaunchContextPayload;
        setKind(data.pending ? 'continue' : 'launch');
      } catch {
        if (!cancelled) setKind('launch');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPublicDemo]);

  const state = LAUNCH_STATE[kind];

  const handleClick = () => {
    if (loading) return;
    if (isPublicDemo) {
      window.dispatchEvent(
        new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT, {
          detail: { showAuth: true },
        }),
      );
      return;
    }
    window.location.assign(state.href);
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
        <span className="admin-sidebar-launch-cta__skeleton admin-sidebar-launch-cta__skeleton--support" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="admin-sidebar-launch-cta"
      onClick={handleClick}
      aria-label={`${state.status}: ${state.title}. ${state.support}`}
    >
      <span className="admin-sidebar-launch-cta__icon" aria-hidden="true">
        <Store width={18} height={18} />
      </span>
      <span className="admin-sidebar-launch-cta__body">
        <span className="admin-sidebar-launch-cta__status">{state.status}</span>
        <span className="admin-sidebar-launch-cta__title">{state.title}</span>
        <span className="admin-sidebar-launch-cta__support">{state.support}</span>
      </span>
    </button>
  );
}
