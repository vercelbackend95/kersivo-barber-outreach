import { describe, expect, it } from 'vitest';
import {
  resolveGoogleBookingDestination,
  resolveGoogleBookingSetupView,
} from './googleBooking';

describe('Google booking destination', () => {
  it('is unavailable before Starter/Full activation', () => {
    expect(
      resolveGoogleBookingDestination({
        state: 'SETUP',
        shop: { id: 'shop-1', bookingSlug: 'fade-room' },
        publicSiteUrl: 'https://kersivo.test',
      }),
    ).toEqual({
      available: false,
      url: null,
      source: 'setup_unavailable',
    });
  });

  it('uses the stable KERSIVO booking slug for Starter and never a QR route', () => {
    const result = resolveGoogleBookingDestination({
      state: 'FREE_BOOKING',
      shop: { id: 'shop-1', bookingSlug: 'fade-room' },
      publicSiteUrl: 'https://kersivo.test/',
    });

    expect(result).toEqual({
      available: true,
      url: 'https://kersivo.test/book/fade-room',
      source: 'starter_hosted',
    });
    if (result.available) expect(result.url).not.toContain('/q/');
  });

  it('uses the hosted fallback for Full until a verified own-domain destination exists', () => {
    expect(
      resolveGoogleBookingDestination({
        state: 'FULL_KERSIVO',
        shop: { id: 'shop-1', bookingSlug: 'fade-room' },
        publicSiteUrl: 'https://kersivo.test',
      }),
    ).toEqual({
      available: true,
      url: 'https://kersivo.test/book/fade-room',
      source: 'full_hosted_fallback',
    });
  });
});

describe('Google booking setup status', () => {
  it('keeps a matching merchant-confirmed URL confirmed', () => {
    expect(
      resolveGoogleBookingSetupView({
        status: 'MERCHANT_CONFIRMED',
        confirmedUrl: 'https://kersivo.test/book/fade-room',
        authoritativeUrl: 'https://kersivo.test/book/fade-room',
      }),
    ).toEqual({ status: 'MERCHANT_CONFIRMED', requiresUpdate: false });
  });

  it('surfaces update required when the authoritative destination changes', () => {
    expect(
      resolveGoogleBookingSetupView({
        status: 'MERCHANT_CONFIRMED',
        confirmedUrl: 'https://kersivo.test/book/fade-room',
        authoritativeUrl: 'https://fade-room.co.uk/book',
      }),
    ).toEqual({ status: 'UPDATE_REQUIRED', requiresUpdate: true });
  });

  it('preserves setup started and not-set states', () => {
    expect(
      resolveGoogleBookingSetupView({
        status: 'SETUP_STARTED',
        confirmedUrl: null,
        authoritativeUrl: 'https://kersivo.test/book/fade-room',
      }),
    ).toEqual({ status: 'SETUP_STARTED', requiresUpdate: false });

    expect(
      resolveGoogleBookingSetupView({
        status: 'NOT_SET',
        confirmedUrl: null,
        authoritativeUrl: 'https://kersivo.test/book/fade-room',
      }),
    ).toEqual({ status: 'NOT_SET', requiresUpdate: false });
  });
});
