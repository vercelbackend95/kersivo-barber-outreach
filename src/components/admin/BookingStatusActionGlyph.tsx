import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getBookingStatusTone, getStatusLabel, type BookingStatusTone } from './bookingStatus';

export type StatusActionPhase =
  | 'BOOKED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'EXPIRED'
  | 'OTHER';

export type StatusActionVisual = {
  phase: StatusActionPhase;
  tone: BookingStatusTone;
  label: string;
};

const HOUR_MS = 60 * 60 * 1000;
const RING_SIZE = 56;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2 - 0.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Resolve day-of phase + short label + tone for the Status launcher. */
export function getStatusActionVisual(
  status: string,
  rescheduledAt?: string | null,
): StatusActionVisual {
  const tone = getBookingStatusTone({ status, rescheduledAt });
  const hasRescheduled = Boolean(rescheduledAt) || status.includes('RESCHEDULED');

  if (status.startsWith('CANCELLED')) {
    return { phase: 'CANCELLED', tone, label: 'Cancelled' };
  }
  if (status === 'NO_SHOW') {
    return { phase: 'NO_SHOW', tone, label: 'No show' };
  }
  if (status === 'RESCHEDULED' || (hasRescheduled && status === 'BOOKED')) {
    return { phase: 'RESCHEDULED', tone, label: 'Rescheduled' };
  }
  if (status === 'BOOKED') {
    return { phase: 'BOOKED', tone, label: 'Booked' };
  }
  if (status === 'ARRIVED') {
    return { phase: 'ARRIVED', tone, label: 'Arrived' };
  }
  if (status === 'IN_PROGRESS') {
    return { phase: 'IN_PROGRESS', tone, label: 'In progress' };
  }
  if (status === 'COMPLETED') {
    return { phase: 'COMPLETED', tone, label: 'Completed' };
  }
  if (status === 'EXPIRED') {
    return { phase: 'EXPIRED', tone, label: 'Expired' };
  }
  return { phase: 'OTHER', tone, label: getStatusLabel(status, rescheduledAt) };
}

function isTerminalPhase(phase: StatusActionPhase): boolean {
  return (
    phase === 'COMPLETED' ||
    phase === 'NO_SHOW' ||
    phase === 'CANCELLED' ||
    phase === 'EXPIRED' ||
    phase === 'RESCHEDULED'
  );
}

/**
 * Progress 0–1 for the live ring:
 * - BOOKED (before start): lead-up window startAt-60m → startAt
 * - ARRIVED / IN_PROGRESS: appointment elapsed
 * - COMPLETED: 1
 * - terminal muted: 0 (dim track only)
 */
export function getStatusRingProgress(input: {
  phase: StatusActionPhase;
  startAt: Date | string;
  endAt: Date | string;
  nowMs?: number;
}): number {
  const startMs = toMs(input.startAt);
  const endMs = toMs(input.endAt);
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  if (input.phase === 'COMPLETED') return 1;
  if (
    input.phase === 'NO_SHOW' ||
    input.phase === 'CANCELLED' ||
    input.phase === 'EXPIRED' ||
    input.phase === 'RESCHEDULED' ||
    input.phase === 'OTHER'
  ) {
    return 0;
  }

  if (input.phase === 'BOOKED') {
    if (nowMs >= startMs) return 1;
    const leadStart = startMs - HOUR_MS;
    return clamp01((nowMs - leadStart) / HOUR_MS);
  }

  // ARRIVED / IN_PROGRESS
  return clamp01((nowMs - startMs) / (endMs - startMs));
}

type GlyphProps = { className?: string };

function BookedGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8 3.5v3.5M16 3.5v3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.65" fill="currentColor" />
    </svg>
  );
}

function ArrivedGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.25c.7-3.35 3.15-5.25 6.5-5.25s5.8 1.9 6.5 5.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M16.25 13.75l1.6 1.6 3.15-3.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InProgressGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="7.25" cy="7.25" r="2.6" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16.75" cy="7.25" r="2.6" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M9.1 9.1 14.9 14.9M14.9 9.1 9.1 14.9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M12 12v8.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M9.75 16.75h4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompletedGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.25 12.25 10.9 14.9 15.85 9.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoShowGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.25c.7-3.35 3.15-5.25 6.5-5.25s5.8 1.9 6.5 5.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M5 5.25 19 19.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CancelledGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7.6 7.6 16.4 16.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ClockGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7.5v5.1l3.35 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhaseGlyph({ phase, className }: { phase: StatusActionPhase; className?: string }) {
  switch (phase) {
    case 'BOOKED':
      return <BookedGlyph className={className} />;
    case 'ARRIVED':
      return <ArrivedGlyph className={className} />;
    case 'IN_PROGRESS':
      return <InProgressGlyph className={className} />;
    case 'COMPLETED':
      return <CompletedGlyph className={className} />;
    case 'NO_SHOW':
      return <NoShowGlyph className={className} />;
    case 'CANCELLED':
      return <CancelledGlyph className={className} />;
    case 'RESCHEDULED':
    case 'EXPIRED':
    case 'OTHER':
    default:
      return <ClockGlyph className={className} />;
  }
}

export type BookingStatusActionGlyphProps = {
  status: string;
  rescheduledAt?: string | null;
  startAt: string;
  endAt: string;
  /** Sheet open — stronger active chrome (handled by parent button classes mostly). */
  active?: boolean;
  /** Tick the live ring only while the actions panel is revealed. */
  live?: boolean;
};

export default function BookingStatusActionGlyph({
  status,
  rescheduledAt = null,
  startAt,
  endAt,
  active = false,
  live = false,
}: BookingStatusActionGlyphProps) {
  const reduceMotion = useReducedMotion();
  const visual = getStatusActionVisual(status, rescheduledAt);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!live || isTerminalPhase(visual.phase)) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live, visual.phase]);

  const progress = getStatusRingProgress({
    phase: visual.phase,
    startAt,
    endAt,
    nowMs,
  });
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const ringMuted =
    visual.phase === 'NO_SHOW' ||
    visual.phase === 'CANCELLED' ||
    visual.phase === 'EXPIRED' ||
    visual.phase === 'RESCHEDULED' ||
    visual.phase === 'OTHER';
  const breathe = visual.phase === 'IN_PROGRESS' && !reduceMotion && live;

  return (
    <span
      className={[
        'admin-vtl-ap-status-glyph',
        `admin-vtl-ap-status-glyph--${visual.tone}`,
        ringMuted ? 'admin-vtl-ap-status-glyph--muted-ring' : '',
        breathe ? 'admin-vtl-ap-status-glyph--breathe' : '',
        active ? 'is-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        className="admin-vtl-ap-status-glyph__ring"
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden
      >
        <circle
          className="admin-vtl-ap-status-glyph__ring-track"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
        />
        <circle
          className="admin-vtl-ap-status-glyph__ring-progress"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{
            transition: reduceMotion ? undefined : 'stroke-dashoffset 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>

      <span className="admin-vtl-ap-status-glyph__icon-slot">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={visual.phase}
            className="admin-vtl-ap-status-glyph__icon-motion"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT_EXPO }}
          >
            <PhaseGlyph phase={visual.phase} className="admin-vtl-ap-status-glyph__icon" />
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
