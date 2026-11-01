import React, { useState } from 'react';
import { ArrowRight, Check, Store } from '../lucide-react';
import {
  SETUP_OPTIONAL_TAG,
  SETUP_PHASE3_DISMISS,
  type SetupCardItemId,
  type SetupCardModel,
} from '@/lib/adminHub/setupCard';
import { LAUNCH_CONTEXT_REFRESH_EVENT } from '@/lib/admin/launchContextRefresh';
import '@/styles/components/admin-sidebar-launch-cta.css';

export type NextStepsCardModel = SetupCardModel & { liveUrl: string | null };

type AdminNextStepsCardProps = {
  card: NextStepsCardModel;
  placement?: 'sidebar' | 'mobile';
};

function extraLabel(item: NextStepsCardModel['items'][number], nextId: SetupCardItemId | null): string {
  if (item.done) return 'Done';
  if (item.optional) return SETUP_OPTIONAL_TAG;
  if (item.id === nextId) return 'Next';
  return 'To do';
}

export default function AdminNextStepsCard({ card, placement = 'sidebar' }: AdminNextStepsCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const percent = card.total ? Math.round((card.done / card.total) * 100) : 0;
  const titleId = `admin-next-steps-title-${placement}`;

  const refresh = () => {
    window.dispatchEvent(new CustomEvent(LAUNCH_CONTEXT_REFRESH_EVENT));
  };

  const post = async (path: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(path, { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Could not update this step.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this step.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={`admin-next-steps admin-next-steps--${placement}`}
      data-testid="admin-next-steps"
      data-placement={placement}
      aria-labelledby={titleId}
    >
      <div className="admin-sidebar-launch-cta admin-sidebar-launch-cta--conversion admin-next-steps__card">
        <span className="admin-sidebar-launch-cta__icon" aria-hidden="true">
          <Store width={18} height={18} />
        </span>
        <div className="admin-sidebar-launch-cta__body">
          <p className="admin-sidebar-launch-cta__status">{card.status}</p>
          <h2 className="admin-sidebar-launch-cta__title" id={titleId}>
            {card.title}
          </h2>
          <div
            className="admin-next-steps__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={card.total}
            aria-valuenow={card.done}
            aria-label={card.status}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <ul className="admin-next-steps__list">
            {card.items.map((item) => {
              const next = item.id === card.nextId;
              const extra = extraLabel(item, card.nextId);
              const viewSite = item.id === 'view-site';
              const href = item.href && item.href !== '#' ? item.href : undefined;
              return (
                <li key={item.id}>
                  <a
                    className={`admin-next-steps__item${item.done ? ' is-done' : next ? ' is-next' : ' is-todo'}`}
                    href={href ?? '#'}
                    target={viewSite && href ? '_blank' : undefined}
                    rel={viewSite && href ? 'noopener noreferrer' : undefined}
                    aria-label={`${item.label}, ${extra}`}
                    onClick={(event) => {
                      if (viewSite) {
                        if (!href) event.preventDefault();
                        void post('/api/admin/next-steps/view-site');
                      }
                    }}
                  >
                    <span className="admin-next-steps__mark" aria-hidden="true">
                      {item.done ? <Check width={11} height={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="admin-next-steps__label">{item.label}</span>
                    {next ? (
                      <span className="admin-next-steps__go" aria-hidden="true">
                        <ArrowRight width={13} height={13} />
                      </span>
                    ) : item.optional && !item.done ? (
                      <span className="admin-next-steps__tag">{SETUP_OPTIONAL_TAG}</span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="admin-next-steps__dismiss"
            disabled={busy}
            onClick={() => void post('/api/admin/next-steps/dismiss')}
          >
            {SETUP_PHASE3_DISMISS}
          </button>
          {error ? (
            <p className="admin-sidebar-launch-cta__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
