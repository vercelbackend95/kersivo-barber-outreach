export const BLACKLINE_BOOKING_PROOF_DISMISSED_KEY =
  'kersivo.blackline.booking-proof-dismissed.v1';

/** Delay after timeline focus-handled before revealing the proof card (ms). */
export const BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_MS = 2100;

/** Near-instant reveal when the user prefers reduced motion. */
export const BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_REDUCED_MS = 0;

type DismissedState = {
  bookingIds: string[];
};

function readDismissed(): Set<string> {
  if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) {
    return new Set();
  }
  try {
    const raw = globalThis.sessionStorage.getItem(BLACKLINE_BOOKING_PROOF_DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Partial<DismissedState>;
    if (!Array.isArray(parsed.bookingIds)) return new Set();
    return new Set(
      parsed.bookingIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    );
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return;
  try {
    if (ids.size === 0) {
      globalThis.sessionStorage.removeItem(BLACKLINE_BOOKING_PROOF_DISMISSED_KEY);
      return;
    }
    globalThis.sessionStorage.setItem(
      BLACKLINE_BOOKING_PROOF_DISMISSED_KEY,
      JSON.stringify({ bookingIds: [...ids] } satisfies DismissedState),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function isBookingProofDismissed(bookingId: string): boolean {
  const id = bookingId.trim();
  if (!id) return false;
  return readDismissed().has(id);
}

export function dismissBookingProof(bookingId: string): void {
  const id = bookingId.trim();
  if (!id) return;
  const next = readDismissed();
  next.add(id);
  writeDismissed(next);
}

export function clearBookingProofDismissalsForTests(): void {
  if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return;
  try {
    globalThis.sessionStorage.removeItem(BLACKLINE_BOOKING_PROOF_DISMISSED_KEY);
  } catch {
    // ignore
  }
}

export function getBookingProofRevealDelayMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion
    ? BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_REDUCED_MS
    : BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_MS;
}

/** Whether the booking-proof journey should arm on this admin load. */
export function shouldArmBlacklineBookingProof(input: {
  isBlacklineDemo: boolean;
  demoJourney: string | null;
  bookingId: string | null;
  isSessionBooking: boolean;
}): boolean {
  const bookingId = input.bookingId?.trim() ?? '';
  if (!input.isBlacklineDemo) return false;
  if (input.demoJourney !== 'booking') return false;
  if (!bookingId) return false;
  if (!input.isSessionBooking) return false;
  if (isBookingProofDismissed(bookingId)) return false;
  return true;
}
