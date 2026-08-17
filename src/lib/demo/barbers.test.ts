import { describe, expect, it } from 'vitest';
import {
  DEMO_BARBERS,
  demoBarberBookingHref,
  demoBarberFirstName,
  demoBarberRosterIndex,
  resolveDemoBarberSlug,
  toDemoBookingBarber,
} from './barbers';
import { DEMO_SERVICES } from './services';

describe('BLACKLINE demo barbers', () => {
  it('keeps the three established BLACKLINE identities', () => {
    expect(DEMO_BARBERS.map((barber) => ({ id: barber.id, slug: barber.slug, name: barber.name }))).toEqual([
      { id: 'bl-barber-ellis', slug: 'ellis-ward', name: 'Ellis Ward' },
      { id: 'bl-barber-noah', slug: 'noah-reid', name: 'Noah Reid' },
      { id: 'bl-barber-marcus', slug: 'marcus-bell', name: 'Marcus Bell' },
    ]);
  });

  it('uses craft-only specialisations and local WebP portraits', () => {
    expect(DEMO_BARBERS.map((barber) => barber.specialisation)).toEqual([
      'Skin fades · Textured cuts',
      'Classic cuts · Beard shaping',
      'Scissor work · Natural styling',
    ]);
    expect(DEMO_BARBERS.map((barber) => [barber.image.src, barber.image.width, barber.image.height])).toEqual([
      ['/demo/barbers/ellis-ward.webp', 1600, 1067],
      ['/demo/barbers/noah-reid.webp', 1600, 2400],
      ['/demo/barbers/marcus-bell.webp', 1600, 2400],
    ]);
    expect(DEMO_BARBERS.map((barber) => barber.selectionCopy)).toEqual([
      'Clean structure, sharp fades and textured movement.',
      'Classic barbering paired with considered beard shaping.',
      'Scissor-led cuts with a natural, wearable finish.',
    ]);
    expect(DEMO_BARBERS.map((barber) => barber.image.alt)).toEqual([
      'Portrait of Ellis Ward, a fictional barber in the BLACKLINE demonstration shop.',
      'Portrait of Noah Reid, a fictional barber in the BLACKLINE demonstration shop.',
      'Portrait of Marcus Bell, a fictional barber in the BLACKLINE demonstration shop.',
    ]);
  });

  it('offers every BLACKLINE service', () => {
    const serviceIds = DEMO_SERVICES.map((service) => service.id);
    for (const barber of DEMO_BARBERS) {
      expect(barber.serviceIds).toEqual(serviceIds);
    }
  });

  it('builds booking hrefs from stable slugs', () => {
    expect(demoBarberBookingHref('ellis-ward')).toBe('/demo/book?barber=ellis-ward');
    expect(demoBarberBookingHref('noah-reid')).toBe('/demo/book?barber=noah-reid');
    expect(demoBarberBookingHref('marcus-bell')).toBe('/demo/book?barber=marcus-bell');
  });

  it('resolves known slugs and ignores invalid query values', () => {
    expect(resolveDemoBarberSlug('ellis-ward')?.id).toBe('bl-barber-ellis');
    expect(resolveDemoBarberSlug(' Noah-Reid ')?.name).toBe('Noah Reid');
    expect(resolveDemoBarberSlug('bl-barber-ellis')).toBeUndefined();
    expect(resolveDemoBarberSlug('jamie')).toBeUndefined();
    expect(resolveDemoBarberSlug('')).toBeUndefined();
    expect(resolveDemoBarberSlug(null)).toBeUndefined();
  });

  it('uses the first name for booking actions', () => {
    expect(demoBarberFirstName('Ellis Ward')).toBe('Ellis');
    expect(demoBarberFirstName('Noah Reid')).toBe('Noah');
    expect(demoBarberFirstName('Marcus Bell')).toBe('Marcus');
  });

  it('formats roster indexes as tabular pairs', () => {
    expect(demoBarberRosterIndex(0)).toBe('01 / 03');
    expect(demoBarberRosterIndex(1)).toBe('02 / 03');
    expect(demoBarberRosterIndex(2)).toBe('03 / 03');
  });

  it('maps to BookingFlow props without leaving the BLACKLINE catalogue', () => {
    const mapped = DEMO_BARBERS.map(toDemoBookingBarber);
    expect(mapped.map((barber) => barber.id)).toEqual([
      'bl-barber-ellis',
      'bl-barber-noah',
      'bl-barber-marcus',
    ]);
    expect(mapped.every((barber) => barber.avatarUrl?.startsWith('/demo/barbers/'))).toBe(true);
  });
});
