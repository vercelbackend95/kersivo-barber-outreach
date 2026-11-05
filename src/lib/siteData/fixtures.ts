/**
 * Test fixture: a fictional shop used by the site data unit tests and the JSON-LD snapshot.
 * Never rendered publicly.
 */
import type { SiteDataSource } from './build';

export const FIXTURE_NOW = new Date('2026-11-04T10:00:00.000Z');

export function seededShopSource(overrides: Partial<SiteDataSource> = {}): SiteDataSource {
  return {
    shop: {
      id: 'shop_fixture',
      name: 'Fixture Barbers',
      townCity: 'Leeds',
      logoUrl: 'https://cdn.example.test/logo.png',
      timezone: 'Europe/London',
    },
    profile: {
      tagline: 'Sharp cuts on Briggate.',
      description: 'A small barbershop for fades, classic cuts and beard work.',
      addressLine1: '1 Example Street',
      addressLine2: null,
      postcode: 'ls1 6aa',
      phone: '0113 000 0000',
      email: 'hello@example.test',
      // Reserved .test domain: the fixture is published (docs/site-data/fixture.json), so no real handle.
      instagramUrl: 'https://instagram.example.test/fixturebarbers',
      facebookUrl: null,
      tiktokUrl: null,
      otherSocialUrl: null,
      brandPrimaryColour: '#B91C1C',
      brandSecondaryColour: null,
    },
    hours: [
      { dayOfWeek: 1, active: true, startMinutes: 540, endMinutes: 1080 },
      { dayOfWeek: 2, active: true, startMinutes: 540, endMinutes: 1080 },
      { dayOfWeek: 3, active: true, startMinutes: 540, endMinutes: 1080 },
      { dayOfWeek: 4, active: true, startMinutes: 540, endMinutes: 1200 },
      { dayOfWeek: 5, active: true, startMinutes: 540, endMinutes: 1200 },
      { dayOfWeek: 6, active: true, startMinutes: 480, endMinutes: 960 },
      // Sunday has no row: closed.
    ],
    exceptions: [
      { date: '2026-12-25', closed: true, startMinutes: null, endMinutes: null, label: 'Christmas Day' },
      { date: '2026-12-24', closed: false, startMinutes: 540, endMinutes: 840, label: 'Christmas Eve' },
      { date: '2026-01-01', closed: true, startMinutes: null, endMinutes: null, label: 'Past' },
    ],
    barbers: [
      {
        id: 'b1',
        name: 'Sam',
        title: 'Senior Barber',
        bio: 'Fades and skin fades.',
        avatarUrl: 'https://cdn.example.test/sam.webp',
        active: true,
        showOnWebsite: true,
        serviceIds: ['s1', 's2', 's_hidden'],
      },
      { id: 'b2', name: 'Alex', title: null, bio: null, avatarUrl: null, active: true, showOnWebsite: false, serviceIds: ['s1'] },
      { id: 'b3', name: 'Old', title: null, bio: null, avatarUrl: null, active: false, showOnWebsite: true, serviceIds: [] },
    ],
    services: [
      { id: 's1', name: 'Skin fade', category: 'Haircuts', description: null, durationMinutes: 45, pricePence: 2500, priceFrom: false, isActive: true, featured: true },
      { id: 's2', name: 'Beard trim', category: 'Beards', description: 'Shape and line-up.', durationMinutes: 20, pricePence: 1250, priceFrom: false, isActive: true, featured: false },
      { id: 's3', name: 'Long hair cut', category: 'Haircuts', description: null, durationMinutes: 75, pricePence: 3000, priceFrom: true, isActive: true, featured: false },
      { id: 's_hidden', name: 'Retired', category: 'Haircuts', description: null, durationMinutes: 30, pricePence: 1000, priceFrom: false, isActive: false, featured: false },
    ],
    products: [
      { id: 'p1', name: 'Matte clay', description: null, imageUrl: 'https://cdn.example.test/clay.webp', pricePence: 1400, inStock: true, active: true },
      { id: 'p2', name: 'Beard oil', description: null, imageUrl: null, pricePence: 1200, inStock: false, active: true },
      { id: 'p3', name: 'Hidden', description: null, imageUrl: null, pricePence: 900, inStock: true, active: false },
    ],
    plan: 'full',
    features: { brandedSite: true, onlineBooking: true, retail: true },
    bookingUrl: 'https://fixturebarbers.example.test/book',
    hostedBookingUrl: 'https://kersivo.co.uk/book/fixture-barbers',
    websiteUrl: 'https://fixturebarbers.example.test',
    fallbackCanonicalUrl: 'https://kersivo.co.uk/book/fixture-barbers',
    appOrigin: 'https://kersivo.co.uk',
    now: FIXTURE_NOW,
    ...overrides,
  };
}

/** A shop that has entered nothing beyond its name. */
export function emptyShopSource(overrides: Partial<SiteDataSource> = {}): SiteDataSource {
  return seededShopSource({
    shop: { id: 'shop_empty', name: 'Empty Barbers', townCity: null, logoUrl: null, timezone: 'Europe/London' },
    profile: null,
    hours: [],
    exceptions: [],
    barbers: [],
    services: [],
    products: [],
    bookingUrl: null,
    hostedBookingUrl: null,
    websiteUrl: null,
    features: { brandedSite: true, onlineBooking: false, retail: false },
    fallbackCanonicalUrl: 'https://kersivo.co.uk/book/empty-barbers',
    ...overrides,
  });
}

/**
 * The published fixture (docs/site-data/fixture.json): the SiteData of the fictional seeded shop,
 * for shop website projects in `template` mode and for local work. Fictional data only.
 * Regenerate with `npx tsx scripts/site-data/export-fixture.ts`; `fixtureExport.test.ts` fails when
 * the file is out of date.
 */
export const PUBLISHED_FIXTURE_PATH = 'docs/site-data/fixture.json';

export function publishedFixtureJson(build: (source: SiteDataSource) => unknown): string {
  return `${JSON.stringify(build(seededShopSource()), null, 2)}\n`;
}
