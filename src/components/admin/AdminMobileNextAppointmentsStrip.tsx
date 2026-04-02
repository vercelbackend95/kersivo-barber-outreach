import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from '../lucide-react';

const DRAWER_TRANSITION_MS = 320;

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
};

export default function AdminMobileNextAppointmentsStrip({
  appointments,
  isExpanded,
  onToggleExpanded,
  formatStartTime,
  connectionStateLabel,
}: AdminMobileNextAppointmentsStripProps) {
  const hasExpandableContent = appointments.length > 1;
  const [drawerCollapsing, setDrawerCollapsing] = useState(false);
  const [extrasClipOpen, setExtrasClipOpen] = useState(false);
  const collapseTimerRef = useRef<number | null>(null);
  /** Same-render guard so the first paint after collapse still lists extras (avoids instant unmount). */
  const prevIsExpandedRef = useRef(isExpanded);

  const collapseArmed =
    prevIsExpandedRef.current && !isExpanded && hasExpandableContent;
  const effectiveExpanded = isExpanded || drawerCollapsing || collapseArmed;

  const visibleAppointments = useMemo(
    () => appointments.slice(0, effectiveExpanded ? 4 : 1),
    [appointments, effectiveExpanded],
  );

  useLayoutEffect(() => {
    if (isExpanded) {
      if (collapseTimerRef.current != null) {
        window.clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      setDrawerCollapsing(false);
    } else if (prevIsExpandedRef.current && hasExpandableContent) {
      setDrawerCollapsing(true);
      if (collapseTimerRef.current != null) {
        window.clearTimeout(collapseTimerRef.current);
      }
      collapseTimerRef.current = window.setTimeout(() => {
        setDrawerCollapsing(false);
        collapseTimerRef.current = null;
      }, DRAWER_TRANSITION_MS);
    }
    prevIsExpandedRef.current = isExpanded;
  }, [isExpanded, hasExpandableContent]);

  useEffect(
    () => () => {
      if (collapseTimerRef.current != null) {
        window.clearTimeout(collapseTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const extraCount = visibleAppointments.length - 1;
    if (extraCount <= 0) {
      setExtrasClipOpen(false);
      return;
    }
    if (!isExpanded || drawerCollapsing) {
      setExtrasClipOpen(false);
      return;
    }
    setExtrasClipOpen(false);
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setExtrasClipOpen(true));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [isExpanded, drawerCollapsing, visibleAppointments.length]);

  const liveModifier =
    connectionStateLabel === 'LIVE'
      ? 'live'
      : connectionStateLabel === 'OFFLINE'
        ? 'offline'
        : 'connecting';

  /** Pill shares the meta row with the first booking when collapsed, last visible when expanded. */
  const pillMetaRowIndex = !effectiveExpanded ? 0 : Math.max(0, visibleAppointments.length - 1);

  const renderAppointmentBody = (appointment: MobileNextAppointmentItem, showPillOnThisRow: boolean) => (
    <>
      <p className="admin-mobile-next-strip-main">
        <span className="admin-mobile-next-strip-barber">{appointment.barberName}</span>
        <span className="admin-mobile-next-strip-dot" aria-hidden="true">·</span>
        <span className="admin-mobile-next-strip-service">{appointment.serviceName}</span>
      </p>
      {showPillOnThisRow ? (
        <div className="admin-mobile-next-strip-meta-row admin-mobile-next-strip-meta-row--with-pill">
          <p className="admin-mobile-next-strip-meta admin-mobile-next-strip-meta--with-pill">
            <span>{formatStartTime(appointment.startAt)}</span>
            <span className="admin-mobile-next-strip-dot" aria-hidden="true">·</span>
            <span>{appointment.relativeLabel}</span>
          </p>
          <div className="admin-mobile-next-strip-toggle-anchor">
            <button
              type="button"
              className="admin-mobile-next-strip-toggle"
              onClick={onToggleExpanded}
              aria-expanded={isExpanded}
              aria-controls="admin-mobile-next-strip-list"
              aria-label={isExpanded ? 'Collapse upcoming appointments' : 'Show more upcoming appointments'}
            >
              <ChevronDown width={11} height={11} aria-hidden="true" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      ) : (
        <p className="admin-mobile-next-strip-meta">
          <span>{formatStartTime(appointment.startAt)}</span>
          <span className="admin-mobile-next-strip-dot" aria-hidden="true">·</span>
          <span>{appointment.relativeLabel}</span>
        </p>
      )}
    </>
  );

  return (
    <section className="admin-mobile-next-strip" aria-label="Upcoming appointments">
      <div className="admin-mobile-next-strip-head">
        <p className="admin-mobile-next-strip-kicker">Next appointments</p>
        <span className={`admin-mobile-next-strip-live admin-mobile-next-strip-live--${liveModifier}`}>
          <span
            className={`admin-mobile-next-strip-live-dot${liveModifier === 'live' ? ' admin-mobile-next-strip-live-dot--pulse' : ''}`}
            aria-hidden="true"
          />
          <span>{connectionStateLabel}</span>
        </span>
      </div>

      <ul className="admin-mobile-next-strip-list" id="admin-mobile-next-strip-list">
        {visibleAppointments.length > 0 ? (
          visibleAppointments.map((appointment, index) => {
            const showPillOnThisRow = hasExpandableContent && index === pillMetaRowIndex;
            const isDrawerExtra = index >= 1;
            const clipOpen = isDrawerExtra && extrasClipOpen && !drawerCollapsing;
            return (
              <li
                key={appointment.id}
                className={`admin-mobile-next-strip-item${index === 0 ? ' admin-mobile-next-strip-item--primary' : ''}${isDrawerExtra ? ' admin-mobile-next-strip-item--drawer-extra' : ''}`}
              >
                {isDrawerExtra ? (
                  <div
                    className={`admin-mobile-next-strip-item-clip${clipOpen ? ' admin-mobile-next-strip-item-clip--open' : ''}`}
                  >
                    <div className="admin-mobile-next-strip-item-clip-inner">
                      {renderAppointmentBody(appointment, showPillOnThisRow)}
                    </div>
                  </div>
                ) : (
                  renderAppointmentBody(appointment, showPillOnThisRow)
                )}
              </li>
            );
          })
        ) : (
          <li className="admin-mobile-next-strip-item admin-mobile-next-strip-item--empty">
            <p className="admin-mobile-next-strip-main">No upcoming bookings</p>
          </li>
        )}
      </ul>
    </section>
  );
}
