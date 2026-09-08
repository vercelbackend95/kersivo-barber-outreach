import React, { useEffect, useId, useRef, useState } from 'react';
import {
  buildCalendarEvent,
  buildGoogleCalendarUrl,
  downloadAppointmentIcs,
  type BookingCalendarInput,
} from '@/lib/booking/calendarEvent';
import { resolveClientPlatform } from '@/lib/client/platform';

type Props = {
  calendar: BookingCalendarInput;
  className?: string;
};

type InteractionMode = 'direct' | 'menu';

function CalendarGlyph() {
  return (
    <svg
      className="booking-add-to-calendar__glyph"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10h17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8.5 14.5h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function openGoogleCalendar(url: string): void {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) return;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function AddToCalendarControl({ calendar, className }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SSR + first paint: direct (no menu attrs). After mount, desktop upgrades to menu.
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('direct');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const built = buildCalendarEvent(calendar);
  const googleHref = built.ok ? buildGoogleCalendarUrl(built.event) : '#';
  const isMenuMode = interactionMode === 'menu';

  useEffect(() => {
    setInteractionMode(resolveClientPlatform() === 'DESKTOP' ? 'menu' : 'direct');
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const handleIcs = () => {
    const result = buildCalendarEvent(calendar);
    if (!result.ok) {
      setError(result.error);
      setOpen(false);
      return;
    }
    try {
      downloadAppointmentIcs(result.event);
      setError(null);
      setOpen(false);
      triggerRef.current?.focus();
    } catch {
      setError('Could not create calendar file.');
      setOpen(false);
    }
  };

  const handleGoogleClick = () => {
    if (!built.ok) {
      setError(built.error);
      setOpen(false);
      return;
    }
    setError(null);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerClick = () => {
    setError(null);
    const platform = resolveClientPlatform();

    if (platform === 'IOS' || platform === 'OTHER_MOBILE') {
      setOpen(false);
      handleIcs();
      return;
    }

    if (platform === 'ANDROID') {
      setOpen(false);
      const result = buildCalendarEvent(calendar);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        openGoogleCalendar(buildGoogleCalendarUrl(result.event));
        setError(null);
      } catch {
        setError('Could not open Google Calendar.');
      }
      return;
    }

    setOpen((value) => !value);
  };

  return (
    <div
      ref={rootRef}
      className={['booking-add-to-calendar', className].filter(Boolean).join(' ')}
      data-booking-add-to-calendar
    >
      <button
        ref={triggerRef}
        type="button"
        className="booking-add-to-calendar__trigger"
        {...(isMenuMode
          ? {
              'aria-haspopup': 'menu' as const,
              'aria-expanded': open,
              'aria-controls': menuId,
            }
          : {})}
        onClick={handleTriggerClick}
      >
        <CalendarGlyph />
        <span>Add to calendar</span>
      </button>

      {open ? (
        <div id={menuId} className="booking-add-to-calendar__menu" role="menu" aria-label="Calendar options">
          {built.ok ? (
            <a
              className="booking-add-to-calendar__option"
              role="menuitem"
              href={googleHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleGoogleClick}
            >
              Google Calendar
            </a>
          ) : (
            <button
              type="button"
              className="booking-add-to-calendar__option"
              role="menuitem"
              onClick={() => {
                setError(built.error);
                setOpen(false);
              }}
            >
              Google Calendar
            </button>
          )}
          <button type="button" className="booking-add-to-calendar__option" role="menuitem" onClick={handleIcs}>
            Apple / Other calendar
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="booking-add-to-calendar__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
