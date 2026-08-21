import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLACKLINE_BOOKING_PROOF_DISMISSED_KEY,
  clearBookingProofDismissalsForTests,
  dismissBookingProof,
  getBookingProofRevealDelayMs,
  isBookingProofDismissed,
  shouldArmBlacklineBookingProof,
  BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_MS,
  BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_REDUCED_MS,
} from './blacklineBookingProof';

describe('blacklineBookingProof', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    clearBookingProofDismissalsForTests();
    vi.unstubAllGlobals();
  });

  it('treats unknown booking ids as not dismissed', () => {
    expect(isBookingProofDismissed('booking-a')).toBe(false);
  });

  it('persists dismissals per booking id', () => {
    dismissBookingProof('booking-a');
    expect(isBookingProofDismissed('booking-a')).toBe(true);
    expect(isBookingProofDismissed('booking-b')).toBe(false);
    dismissBookingProof('booking-b');
    expect(isBookingProofDismissed('booking-b')).toBe(true);
    expect(sessionStorage.getItem(BLACKLINE_BOOKING_PROOF_DISMISSED_KEY)).toContain('booking-a');
  });

  it('returns reduced reveal delay when motion is reduced', () => {
    expect(getBookingProofRevealDelayMs(false)).toBe(BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_MS);
    expect(getBookingProofRevealDelayMs(true)).toBe(BLACKLINE_BOOKING_PROOF_REVEAL_DELAY_REDUCED_MS);
  });

  it('arms only for blackline booking journey session bookings that are not dismissed', () => {
    expect(
      shouldArmBlacklineBookingProof({
        isBlacklineDemo: true,
        demoJourney: 'booking',
        bookingId: 'session-1',
        isSessionBooking: true,
      }),
    ).toBe(true);
    expect(
      shouldArmBlacklineBookingProof({
        isBlacklineDemo: false,
        demoJourney: 'booking',
        bookingId: 'session-1',
        isSessionBooking: true,
      }),
    ).toBe(false);
    expect(
      shouldArmBlacklineBookingProof({
        isBlacklineDemo: true,
        demoJourney: null,
        bookingId: 'session-1',
        isSessionBooking: true,
      }),
    ).toBe(false);
    expect(
      shouldArmBlacklineBookingProof({
        isBlacklineDemo: true,
        demoJourney: 'booking',
        bookingId: 'session-1',
        isSessionBooking: false,
      }),
    ).toBe(false);
    dismissBookingProof('session-1');
    expect(
      shouldArmBlacklineBookingProof({
        isBlacklineDemo: true,
        demoJourney: 'booking',
        bookingId: 'session-1',
        isSessionBooking: true,
      }),
    ).toBe(false);
  });
});
