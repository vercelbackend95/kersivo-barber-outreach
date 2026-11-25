/**
 * The real KERSIVO owner timeline (`TodayTimeline`, the component the shop's Bookings page uses),
 * framed as the top of that page: title, today count, Timeline tab, date and the day's numbers.
 *
 * Fed by one Heritage Grooming demo weekday moved onto today (`buildLiveDiary`). The page script
 * sends it commands (`LIVE_DIARY_EVENT`): the hero phone adds the booking a visitor confirms, the
 * availability example adds a chosen time or opens the appointment that blocks one. Everything
 * else is the real timeline: the "now" line, avatars, expandable slots and booking tickets. Any
 * write (status, service) hits the public demo interceptor and is never saved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { scrollContainerToRow } from '@/lib/admin/timelineNowScroll';

import TodayTimeline, { type TimelineBooking } from '@/components/admin/TodayTimeline';
import { AdminClockContext, type AdminClock } from '@/components/admin/adminClock';
import { ADMIN_DEMO_BLOCKED_EVENT, installAdminFetchInterceptor, setPublicAdminDemoMode } from '@/components/admin/adminAuth';
import { LIVE_DIARY_TZ, buildLiveDiary, isoAt, londonMinuteOf } from '@/lib/barbershopOnlineBooking/liveDiary';
import { LIVE_DIARY_EVENT, liveDiaryBacklog, liveDiaryPendingFocus, type LiveDiaryCommand } from '@/lib/barbershopOnlineBooking/liveDiaryEvents';
import '@/styles/components/bob-live-timeline.css';

export type BobLiveTimelineProps = {
  target: 'hero' | 'availability';
  /** Limit the diary to these barbers (the availability example shows one). */
  barberIds?: string[];
  /** Accessible name of the frame. */
  label: string;
  /** Start the view at this London minute instead of "now" (e.g. 12:00 = 720). */
  initialMinute?: number;
  /** The demo clock starts at this London minute today and runs on in real time. */
  demoNowMinute: number;
};

export default function BobLiveTimeline({ target, barberIds, label, initialMinute, demoNowMinute }: BobLiveTimelineProps) {
  const diary = useMemo(() => buildLiveDiary({ barberIds }), [barberIds]);
  const clock = useMemo<AdminClock>(() => {
    const startMs = Date.parse(isoAt(diary.selectedDate, demoNowMinute));
    const mountedAt = Date.now();
    return { frozen: false, nowMs: () => startMs + (Date.now() - mountedAt) };
  }, [diary.selectedDate, demoNowMinute]);
  const [extra, setExtra] = useState<TimelineBooking[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const [bump, setBump] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const focusTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  const toBooking = useCallback(
    (command: Extract<LiveDiaryCommand, { type: 'add' }>): TimelineBooking | null => {
      const barber = diary.barbers.find((b) => b.id === command.barberId);
      if (!barber) return null;
      return {
        id: command.id,
        fullName: command.clientName,
        email: null,
        clientTags: [command.tag],
        status: 'BOOKED',
        startAt: isoAt(diary.selectedDate, command.start),
        endAt: isoAt(diary.selectedDate, command.end),
        barberId: barber.id,
        clientId: null,
        barber: { name: barber.name },
        service: { name: command.serviceName },
        paymentRequired: false,
        paymentStatus: null,
        totalPricePence: command.pricePence,
        servicePricePenceAtBooking: command.pricePence,
      };
    },
    [diary.barbers, diary.selectedDate],
  );

  /* Bookings made before this timeline loaded. */
  useEffect(() => {
    const backlog = liveDiaryBacklog(target).flatMap((command) => {
      const booking = toBooking(command);
      return booking ? [booking] : [];
    });
    const pending = liveDiaryPendingFocus(target);
    if (backlog.length > 0) setExtra(backlog);
    if (pending) {
      const all = [...diary.bookings, ...backlog];
      const hit = all.find((b) => b.barberId === pending.barberId && londonMinuteOf(b.startAt) === pending.start);
      if (hit) focus(hit.id);
    } else if (backlog.length > 0) {
      focus(backlog[backlog.length - 1]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bookings = useMemo(
    () => [...diary.bookings, ...extra].sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [diary.bookings, extra],
  );

  const showToast = useCallback((text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ key: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  /* Focusing the same booking twice needs the prop to change, so clear it first. */
  const focus = useCallback((id: string) => {
    window.clearTimeout(focusTimer.current);
    setFocusId(null);
    focusTimer.current = window.setTimeout(() => setFocusId(id), 40);
  }, []);

  useEffect(() => {
    setPublicAdminDemoMode(true);
    installAdminFetchInterceptor();
    const onBlocked = () => showToast('Demo diary: changes here are not saved.');
    window.addEventListener(ADMIN_DEMO_BLOCKED_EVENT, onBlocked);
    return () => {
      window.removeEventListener(ADMIN_DEMO_BLOCKED_EVENT, onBlocked);
      window.clearTimeout(focusTimer.current);
      window.clearTimeout(toastTimer.current);
    };
  }, [showToast]);

  useEffect(() => {
    if (initialMinute === undefined) return undefined;
    const id = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      const label = `${String(Math.floor(initialMinute / 60)).padStart(2, '0')}:${String(initialMinute % 60).padStart(2, '0')}`;
      const rows = [...container.querySelectorAll<HTMLElement>('[data-vtl-slot]')];
      const row = rows.find((el) => (el.dataset.vtlSlot ?? '') >= label);
      if (row) scrollContainerToRow(container, row, true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [initialMinute]);

  useEffect(() => {
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<LiveDiaryCommand>).detail;
      if (!command || command.target !== target) return;
      if (command.type === 'add') {
        const booking = toBooking(command);
        if (!booking) return;
        const barberName = booking.barber.name;
        setExtra((list) => [...list.filter((b) => b.id !== command.id), booking]);
        setBump((n) => n + 1);
        focus(command.id);
        if (target === 'hero') showToast(`New online booking · ${command.serviceName} with ${barberName.split(' ')[0]}`);
      } else if (command.type === 'remove') {
        setExtra((list) => list.filter((b) => b.id !== command.id));
      } else {
        const hit = bookings.find((b) => b.barberId === command.barberId && londonMinuteOf(b.startAt) === command.start);
        if (hit) focus(hit.id);
      }
    };
    window.addEventListener(LIVE_DIARY_EVENT, onCommand);
    return () => window.removeEventListener(LIVE_DIARY_EVENT, onCommand);
  }, [bookings, focus, showToast, target, toBooking]);

  const nowMs = clock.nowMs();
  const stillToCome = bookings.filter((b) => new Date(b.startAt).getTime() > nowMs).length;
  const dateLabel = formatInTimeZone(new Date(), LIVE_DIARY_TZ, 'EEE d MMM');

  return (
    <div className={`bobtl bobtl--${target}`} role="region" aria-label={label}>
      <div className="bobtl__top">
        <div className="bobtl__title-row">
          <p className="bobtl__title">Bookings</p>
          <span className="bobtl__count" key={`count-${bump}`} data-bumped={bump > 0 ? 'true' : undefined}>
            {bookings.length} today
          </span>
          <span className="bobtl__live">
            <span className="bobtl__live-dot" aria-hidden="true" />
            Live
          </span>
        </div>
        <div className="bobtl__tabs" aria-hidden="true">
          <span className="bobtl__tab is-on">Timeline</span>
          <span className="bobtl__tab">History</span>
          <span className="bobtl__date">{dateLabel}</span>
        </div>
        <dl className="bobtl__stats">
          <div>
            <dt>Today</dt>
            <dd>{bookings.length}</dd>
          </div>
          <div>
            <dt>To come</dt>
            <dd>{stillToCome}</dd>
          </div>
          <div>
            <dt>On shift</dt>
            <dd>{diary.barbers.length}</dd>
          </div>
        </dl>
      </div>

      <div className="bobtl__body">
        <AdminClockContext.Provider value={clock}>
        <TodayTimeline
          barbers={diary.barbers}
          bookings={bookings}
          timeBlocks={[]}
          selectedDate={diary.selectedDate}
          allowInitialNowScroll={initialMinute === undefined}
          containInitialNowScroll
          containFocusScroll
          focusBookingId={focusId}
          scrollContainerRef={scrollRef}
          previewSwipe={false}
          onBookingClick={() => showToast('Demo diary: open the live demo to manage bookings.')}
          onClientProfileIntercept={() => showToast('Client profiles open in the live demo.')}
        />
        </AdminClockContext.Provider>
      </div>

      <p className="bobtl__toast" aria-live="polite">
        {toast ? (
          <span className="bobtl__toast-inner" key={toast.key}>
            {toast.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}
