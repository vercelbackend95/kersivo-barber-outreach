import React, { useEffect, useState } from 'react';
import {
  DAY_LABELS,
  formatGbp,
  orderedHoursForDisplay,
  readJsonError,
  type OnboardingState,
} from '@/components/admin/onboarding/onboardingTypes';

type Panel = 'bookings' | 'team' | 'services' | 'hours';

export default function PreviewDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [state, setState] = useState<OnboardingState | null>(null);
  const [panel, setPanel] = useState<Panel>('bookings');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/preview/onboarding', { credentials: 'include' });
        if (response.status === 401 || response.status === 403) {
          if (!cancelled) {
            setState(null);
            setError('Preview session required.');
          }
          return;
        }
        if (!response.ok) {
          throw new Error(await readJsonError(response));
        }
        const payload = (await response.json()) as OnboardingState;
        if (!cancelled) setState(payload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your preview dashboard.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="preview-dashboard">
        <div className="preview-dashboard__loading" role="status">
          Loading your dashboard…
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="preview-dashboard">
        <header className="preview-dashboard__top">
          <div className="preview-dashboard__brand">
            <img className="preview-dashboard__kersivo-logo" src="/images/logo_nobg.png" alt="" />
            <span className="preview-dashboard__brand-name">Kersivo</span>
          </div>
        </header>
        <main className="preview-dashboard__main">
          <section className="preview-dashboard__gate surface">
            <h1 className="preview-dashboard__title">Preview session expired</h1>
            <p className="preview-dashboard__lede">
              {error === 'Preview session required.'
                ? 'Build your barbershop again to open this dashboard.'
                : error || 'Start a new shop preview to continue.'}
            </p>
            <a className="btn btn--primary btn--lg" href="/preview/onboarding">
              Build my barbershop
            </a>
          </section>
        </main>
      </div>
    );
  }

  const shopHours = state.shopHours?.length ? state.shopHours : state.hours;
  const hoursRows = orderedHoursForDisplay(shopHours);

  return (
    <div className="preview-dashboard">
      <header className="preview-dashboard__top">
        <div className="preview-dashboard__shop">
          {state.shop.logoUrl ? (
            <img className="preview-dashboard__shop-logo" src={state.shop.logoUrl} alt="" />
          ) : (
            <img className="preview-dashboard__kersivo-logo" src="/images/logo_nobg.png" alt="" />
          )}
          <div>
            <p className="preview-dashboard__eyebrow">Your barbershop preview</p>
            <h1 className="preview-dashboard__shop-name">{state.shop.name}</h1>
            {state.shop.townCity ? (
              <p className="preview-dashboard__meta">{state.shop.townCity}</p>
            ) : null}
          </div>
        </div>
        <a className="btn btn--secondary" href="/admin/launch">
          Get started — £39/month
        </a>
      </header>

      <nav className="preview-dashboard__nav" aria-label="Preview sections">
        {(
          [
            ['bookings', 'Bookings'],
            ['team', 'Team'],
            ['services', 'Services'],
            ['hours', 'Hours'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`preview-dashboard__nav-btn${panel === id ? ' is-active' : ''}`}
            onClick={() => setPanel(id)}
            aria-current={panel === id ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="preview-dashboard__main">
        {panel === 'bookings' ? (
          <section className="surface preview-dashboard__panel">
            <header className="admin-section-header">
              <div className="admin-section-header-copy">
                <h2 className="admin-section-header-title">Bookings</h2>
                <p className="admin-section-header-desc">
                  Live bookings will appear here after you subscribe and go live.
                </p>
              </div>
            </header>
            <div className="empty-state">
              <p className="empty-state__title">No bookings yet</p>
              <p className="empty-state__description">
                Your calendar is empty — this preview is private until you subscribe.
              </p>
            </div>
          </section>
        ) : null}

        {panel === 'team' ? (
          <section className="surface preview-dashboard__panel">
            <header className="admin-section-header">
              <div className="admin-section-header-copy">
                <h2 className="admin-section-header-title">Team</h2>
                <p className="admin-section-header-desc">Barbers from your preview setup.</p>
              </div>
            </header>
            <ul className="preview-dashboard__list">
              {state.barbers.map((barber) => (
                <li key={barber.id} className="preview-dashboard__list-item">
                  {barber.avatarUrl ? (
                    <img className="preview-dashboard__avatar" src={barber.avatarUrl} alt="" />
                  ) : (
                    <span className="preview-dashboard__avatar preview-dashboard__avatar--fallback" aria-hidden="true">
                      {barber.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="preview-dashboard__list-title">{barber.name}</p>
                    <p className="preview-dashboard__meta">
                      {barber.intendedRole === 'MANAGER' ? 'Manager' : 'Barber'}
                      {barber.isActive ? '' : ' · offline'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {panel === 'services' ? (
          <section className="surface preview-dashboard__panel">
            <header className="admin-section-header">
              <div className="admin-section-header-copy">
                <h2 className="admin-section-header-title">Services</h2>
                <p className="admin-section-header-desc">Menu from your preview setup.</p>
              </div>
            </header>
            <ul className="preview-dashboard__list">
              {state.services.map((service) => (
                <li key={service.id} className="preview-dashboard__list-item preview-dashboard__list-item--row">
                  <div>
                    <p className="preview-dashboard__list-title">{service.name}</p>
                    <p className="preview-dashboard__meta">{service.durationMinutes} min</p>
                  </div>
                  <p className="preview-dashboard__price">{formatGbp(service.pricePence)}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {panel === 'hours' ? (
          <section className="surface preview-dashboard__panel">
            <header className="admin-section-header">
              <div className="admin-section-header-copy">
                <h2 className="admin-section-header-title">Hours</h2>
                <p className="admin-section-header-desc">Opening hours from your preview setup.</p>
              </div>
            </header>
            <ul className="preview-dashboard__list">
              {hoursRows.map((row) => (
                <li key={row.dayOfWeek} className="preview-dashboard__list-item preview-dashboard__list-item--row">
                  <p className="preview-dashboard__list-title">{DAY_LABELS[row.dayOfWeek]}</p>
                  <p className="preview-dashboard__meta">
                    {row.active ? `${row.startTime}–${row.endTime}` : 'Closed'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
