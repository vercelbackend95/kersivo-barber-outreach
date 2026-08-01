import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from '../lucide-react';
import { SkeletonNextAppointmentsStrip } from '../skeleton';
import AdminDemoPill from './AdminDemoPill';

export type MobileNextAppointmentItem = {
  id: string;
  barberName: string;
  serviceName: string;
  startAt: string;
  relativeLabel: string;
};

type AdminMobileNextAppointmentsStripProps = {
  appointments: MobileNextAppointmentItem[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  formatStartTime: (iso: string) => string;
  connectionStateLabel: string;
  isDemo?: boolean;
  /** True until the first successful bookings load — never show empty state while loading. */
  isLoading?: boolean;
};

export default function AdminMobileNextAppointmentsStrip({
  appointments,
  isExpanded,
  onToggleExpanded,
  formatStartTime,
  connectionStateLabel,
  isDemo = false,
  isLoading = false,
}: AdminMobileNextAppointmentsStripProps) {
  const listDomId = `admin-mobile-next-strip-list-${useId().replace(/:/g, '')}`;
  const MAX_VISIBLE_APPOINTMENTS = 4;
  const hasExpandableContent = appointments.length > 1;
  const listRef = useRef<HTMLUListElement | null>(null);
  const metaRowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [toggleTop, setToggleTop] = useState<number | null>(null);

  const visibleAppointments = useMemo(
    () => appointments.slice(0, hasExpandableContent ? MAX_VISIBLE_APPOINTMENTS : 1),
    [appointments, hasExpandableContent],
  );

  const targetToggleIndex = hasExpandableContent
    ? (isExpanded ? Math.max(0, visibleAppointments.length - 1) : 0)
    : 0;

  useLayoutEffect(() => {
    if (!hasExpandableContent) {
      setToggleTop(null);
      return;
    }

    const updateTogglePosition = () => {
      const listEl = listRef.current;
      const rowEl = metaRowRefs.current[targetToggleIndex];
      if (!listEl || !rowEl) return;
      const listRect = listEl.getBoundingClientRect();
      const rowRect = rowEl.getBoundingClientRect();
      const nextTop = rowRect.top - listRect.top + rowRect.height / 2;
      setToggleTop((prev) => (prev != null && Math.abs(prev - nextTop) < 0.5 ? prev : nextTop));
    };

    const rafId = window.requestAnimationFrame(updateTogglePosition);
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(updateTogglePosition);
    });

    if (listRef.current) resizeObserver.observe(listRef.current);
    metaRowRefs.current.forEach((node) => {
      if (node) resizeObserver.observe(node);
    });

    window.addEventListener('resize', updateTogglePosition);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateTogglePosition);
    };
  }, [hasExpandableContent, targetToggleIndex, visibleAppointments.length, isExpanded]);

  const effectiveLabel = isDemo ? 'LIVE' : connectionStateLabel;
  const liveModifier =
    effectiveLabel === 'LIVE'
      ? 'live'
      : effectiveLabel === 'OFFLINE'
        ? 'offline'
        : 'connecting';

  const renderAppointmentBody = (appointment: MobileNextAppointmentItem, index: number) => (
    <>
      <p className="admin-mobile-next-strip-main">
        <span className="admin-mobile-next-strip-barber">{appointment.barberName}</span>
        <span className="admin-mobile-next-strip-dot" aria-hidden="true">·</span>
        <span className="admin-mobile-next-strip-service">{appointment.serviceName}</span>
      </p>
      <div
        className="admin-mobile-next-strip-meta-row admin-mobile-next-strip-meta-row--with-pill"
        ref={(node) => {
          metaRowRefs.current[index] = node;
        }}
      >
        <p className="admin-mobile-next-strip-meta admin-mobile-next-strip-meta--with-pill">
          <span>{formatStartTime(appointment.startAt)}</span>
          <span className="admin-mobile-next-strip-dot" aria-hidden="true">·</span>
          <span>{appointment.relativeLabel}</span>
        </p>
      </div>
    </>
  );

  return (
    <section className="admin-mobile-next-strip" aria-label="Upcoming appointments">
      <div className="admin-mobile-next-strip-head">
        <p className="admin-mobile-next-strip-kicker">Next appointments</p>
        <span className="admin-mobile-next-strip-status">
          {isDemo ? <AdminDemoPill /> : null}
          <span className={`admin-mobile-next-strip-live admin-mobile-next-strip-live--${liveModifier}`}>
            <span
              className={`admin-mobile-next-strip-live-dot${liveModifier === 'live' ? ' admin-mobile-next-strip-live-dot--pulse' : ''}`}
              aria-hidden="true"
            />
            <span>{effectiveLabel}</span>
          </span>
        </span>
      </div>

      {isLoading ? (
        <SkeletonNextAppointmentsStrip rows={2} />
      ) : (
      <ul className="admin-mobile-next-strip-list" id={listDomId} ref={listRef}>
        {visibleAppointments.length > 0 ? (
          visibleAppointments.map((appointment, index) => {
            const isDrawerExtra = index >= 1;
            const clipOpen = isDrawerExtra && isExpanded;
            return (
              <li
                key={appointment.id}
                className={`admin-mobile-next-strip-item${index === 0 ? ' admin-mobile-next-strip-item--primary' : ''}${isDrawerExtra ? ' admin-mobile-next-strip-item--drawer-extra' : ''}${clipOpen ? ' admin-mobile-next-strip-item--drawer-open' : ''}`}
              >
                {isDrawerExtra ? (
                  <div
                    className={`admin-mobile-next-strip-item-clip${clipOpen ? ' admin-mobile-next-strip-item-clip--open' : ''}`}
                  >
                    <div className="admin-mobile-next-strip-item-clip-inner">
                      {renderAppointmentBody(appointment, index)}
                    </div>
                  </div>
                ) : (
                  renderAppointmentBody(appointment, index)
                )}
              </li>
            );
          })
        ) : (
          <li className="admin-mobile-next-strip-item admin-mobile-next-strip-item--empty">
            <p className="admin-mobile-next-strip-main">No upcoming bookings</p>
          </li>
        )}
        {hasExpandableContent && toggleTop != null ? (
          <li className="admin-mobile-next-strip-toggle-float-wrap" aria-hidden="true">
            <div className="admin-mobile-next-strip-toggle-float" style={{ top: `${toggleTop}px` }}>
              <button
                type="button"
                className="admin-mobile-next-strip-toggle"
                onClick={onToggleExpanded}
                aria-expanded={isExpanded}
                aria-controls={listDomId}
                aria-label={isExpanded ? 'Collapse upcoming appointments' : 'Show more upcoming appointments'}
              >
                <ChevronDown width={11} height={11} aria-hidden="true" strokeWidth={2.25} />
              </button>
            </div>
          </li>
        ) : null}
      </ul>
      )}
    </section>
  );
}
