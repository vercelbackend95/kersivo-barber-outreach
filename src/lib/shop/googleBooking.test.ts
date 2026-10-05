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

  const verified = { shopId: 'shop-1', status: 'VERIFIED_LIVE', url: 'https://fade-room.co.uk/book' };

  it('38: Full with a verified destination uses the exact own-domain URL', () => {
    expect(
      resolveGoogleBookingDestination({
        state: 'FULL_KERSIVO',
        shop: { id: 'shop-1', bookingSlug: 'fade-room' },
        fullDestination: verified,
        publicSiteUrl: 'https://kersivo.test',
      }),
    ).toEqual({ available: true, url: 'https://fade-room.co.uk/book', source: 'full_verified_own_domain' });
  });

  it('36 + 39: Starter ignores a stored Full destination and never returns a /q/ URL', () => {
    for (const state of ['FREE_BOOKING', 'FULL_KERSIVO'] as const) {
      for (const fullDestination of [null, verified, { ...verified, status: 'INVALIDATED' }]) {
        const result = resolveGoogleBookingDestination({
          state,
          shop: { id: 'shop-1', bookingSlug: 'fade-room' },
          fullDestination,
          publicSiteUrl: 'https://kersivo.test',
        });
        if (result.available) expect(result.url).not.toMatch(/\/q\//);
        if (state === 'FREE_BOOKING') expect(result.url).toBe('https://kersivo.test/book/fade-room');
      }
    }
  });

  it('42: an invalidated Full destination falls back to the hosted route', () => {
    expect(
      resolveGoogleBookingDestination({
        state: 'FULL_KERSIVO',
        shop: { id: 'shop-1', bookingSlug: 'fade-room' },
        fullDestination: { ...verified, status: 'INVALIDATED' },
        publicSiteUrl: 'https://kersivo.test',
      }),
    ).toEqual({ available: true, url: 'https://kersivo.test/book/fade-room', source: 'full_hosted_fallback' });
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
