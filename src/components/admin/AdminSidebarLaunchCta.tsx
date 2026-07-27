import React, { useEffect, useMemo, useState } from 'react';
import { Store } from '../lucide-react';
import { ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import {
  demoLaunchProgress,
  emptyLaunchProgress,
  resolveLaunchCtaPresentation,
  type LaunchProgress,
} from '@/lib/admin/launchCtaProgress';
import '@/styles/components/admin-sidebar-launch-cta.css';

type LaunchContextPayload = {
  pending?: { plan?: string } | null;
  paid?: boolean;
  paidHref?: string | null;
  progress?: LaunchProgress;
};

type AdminSidebarLaunchCtaProps = {
  isPublicDemo?: boolean;
};

export default function AdminSidebarLaunchCta({ isPublicDemo = false }: AdminSidebarLaunchCtaProps) {
  const [loading, setLoading] = useState(!isPublicDemo);
  const [progress, setProgress] = useState<LaunchProgress>(() =>
    isPublicDemo ? demoLaunchProgress() : emptyLaunchProgress(),
  );
  const [pending, setPending] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidHref, setPaidHref] = useState<string | null>(null);

  useEffect(() => {
    if (isPublicDemo) {
      setProgress(demoLaunchProgress());
      setPending(false);
      setPaid(false);
      setPaidHref(null);
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
      } catch {
        if (!cancelled) {
          setProgress(emptyLaunchProgress());
          setPending(false);
          setPaid(false);
          setPaidHref(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPublicDemo]);

  const presentation = useMemo(
    () => resolveLaunchCtaPresentation({ progress, pending, paid, paidHref }),
    [progress, pending, paid, paidHref],
  );

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
    window.location.assign(presentation.href);
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

  return (
    <button
      type="button"
      className="admin-sidebar-launch-cta"
      onClick={handleClick}
      aria-label={`${presentation.status}: ${presentation.title}. ${presentation.doneCount} of ${presentation.totalCount} complete.`}
    >
      <span className="admin-sidebar-launch-cta__icon" aria-hidden="true">
        <Store width={18} height={18} />
      </span>
      <span className="admin-sidebar-launch-cta__body">
        <span className="admin-sidebar-launch-cta__status">{presentation.status}</span>
        <span className="admin-sidebar-launch-cta__title">{presentation.title}</span>
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
      </span>
    </button>
  );
}
