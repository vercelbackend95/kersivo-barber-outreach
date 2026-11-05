import { describe, expect, it } from 'vitest';
import { buildSiteData } from './build';
import { emptyShopSource, seededShopSource } from './fixtures';
import {
  formatCalendarDate,
  formatDurationMinutes,
  formatPricePence,
  formatServicePrice,
  phoneHref,
} from './format';

function collectTypes(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => collectTypes(n, out));
  else if (node && typeof node === 'object') {
    const type = (node as Record<string, unknown>)['@type'];
    if (typeof type === 'string') out.push(type);
    Object.values(node).forEach((v) => collectTypes(v, out));
  }
  return out;
}

describe('format helpers (en-GB)', () => {
  it('formats money in pounds, dropping .00', () => {
    expect(formatPricePence(2500)).toBe('£25');
    expect(formatPricePence(2550)).toBe('£25.50');
    expect(formatPricePence(0)).toBe('£0');
    expect(formatServicePrice(2500, true)).toBe('From £25');
  });
  it('formats durations and dates', () => {
    expect(formatDurationMinutes(45)).toBe('45 min');
    expect(formatDurationMinutes(60)).toBe('1 hr');
    expect(formatDurationMinutes(75)).toBe('1 hr 15 min');
    expect(formatCalendarDate('2026-12-25')).toBe('Friday 25 December');
    expect(phoneHref('0113 000 0000')).toBe('tel:01130000000');
  });
});

describe('buildSiteData', () => {
  const site = buildSiteData(seededShopSource());

  it('orders opening hours Monday to Sunday with raw and display values', () => {
    expect(site.openingHours.days.map((d) => d.shortName)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(site.openingHours.days[0]).toMatchObject({
      isOpen: true,
      periods: [{ opens: '09:00', closes: '18:00' }],
      display: '09:00–18:00',
    });
    expect(site.openingHours.days[6]).toMatchObject({ isOpen: false, periods: [], display: 'Closed' });
  });

  it('lists only upcoming exceptions, soonest first', () => {
    expect(site.openingHours.exceptions.map((e) => [e.date, e.display])).toEqual([
      ['2026-12-24', '09:00–14:00'],
      ['2026-12-25', 'Closed'],
    ]);
  });

  it('shows only active, website-visible team members in order', () => {
    expect(site.team.map((t) => t.name)).toEqual(['Sam']);
    expect(site.team[0]).toMatchObject({ title: 'Senior Barber', serviceIds: ['s1', 's2'] });
  });

  it('groups active services by category with formatted prices', () => {
    expect(site.services.categories.map((c) => [c.name, c.services.map((s) => s.priceDisplay)])).toEqual([
      ['Haircuts', ['£25', 'From £30']],
      ['Beards', ['£12.50']],
    ]);
    expect(site.services.all.find((s) => s.id === 's1')?.teamMemberIds).toEqual(['b1']);
  });

  it('lists active products only, with availability', () => {
    expect(site.products.map((p) => [p.name, p.priceDisplay, p.availabilityDisplay])).toEqual([
      ['Matte clay', '£14', 'In stock'],
      ['Beard oil', '£12', 'Out of stock'],
    ]);
    expect(site.products[0].url).toBe('https://kersivo.co.uk/shop/shop_fixture/p1');
  });

  it('normalises the address and contact details', () => {
    expect(site.location.address.formatted).toBe('1 Example Street, Leeds, LS1 6AA');
    expect(site.location.phoneHref).toBe('tel:01130000000');
    expect(site.locations).toHaveLength(1);
  });

  it('hides products when retail is not included, keeping everything else', () => {
    const starter = buildSiteData(
      seededShopSource({ plan: 'starter', features: { brandedSite: false, onlineBooking: true, retail: false } }),
    );
    expect(starter.products).toEqual([]);
    expect(starter.has.products).toBe(false);
    expect(starter.services.all).toHaveLength(3);
  });
});

describe('booking links', () => {
  it('gives the own-domain booking URL, the hosted URL and per-service / per-barber deep links', () => {
    const site = buildSiteData(seededShopSource());
    expect(site.booking).toEqual({
      available: true,
      url: 'https://fixturebarbers.example.test/book',
      hostedUrl: 'https://kersivo.co.uk/book/fixture-barbers',
      label: 'Book an appointment',
    });
    expect(site.team.map((m) => m.bookingUrl)).toEqual(['https://fixturebarbers.example.test/book?barber=b1']);
    expect(site.services.all.map((s) => s.bookingUrl)).toEqual([
      'https://fixturebarbers.example.test/book?service=s1',
      'https://fixturebarbers.example.test/book?service=s2',
      'https://fixturebarbers.example.test/book?service=s3',
    ]);
    // categories hold the same objects
    expect(site.services.categories.flatMap((c) => c.services).map((s) => s.bookingUrl).sort()).toEqual(
      site.services.all.map((s) => s.bookingUrl).sort(),
    );
  });

  it('uses the hosted URL for both when there is no own domain', () => {
    const site = buildSiteData(
      seededShopSource({
        bookingUrl: 'https://kersivo.co.uk/book/fixture-barbers',
        hostedBookingUrl: 'https://kersivo.co.uk/book/fixture-barbers',
        websiteUrl: null,
      }),
    );
    expect(site.booking.url).toBe('https://kersivo.co.uk/book/fixture-barbers');
    expect(site.booking.hostedUrl).toBe('https://kersivo.co.uk/book/fixture-barbers');
    expect(site.team[0].bookingUrl).toBe('https://kersivo.co.uk/book/fixture-barbers?barber=b1');
    expect(site.services.all[0].bookingUrl).toBe('https://kersivo.co.uk/book/fixture-barbers?service=s1');
  });

  it('nulls every booking link when booking is not available', () => {
    for (const source of [
      seededShopSource({ features: { brandedSite: true, onlineBooking: false, retail: true } }),
      seededShopSource({ bookingUrl: null }),
      // preview mode: no booking at all
      seededShopSource({ plan: 'preview', bookingUrl: null, hostedBookingUrl: null, features: { brandedSite: true, onlineBooking: false, retail: false } }),
    ]) {
      const site = buildSiteData(source);
      expect(site.booking.available).toBe(false);
      expect(site.booking.url).toBeNull();
      expect(site.booking.hostedUrl).toBeNull();
      expect(site.team.every((m) => m.bookingUrl === null)).toBe(true);
      expect(site.services.all.every((s) => s.bookingUrl === null)).toBe(true);
    }
  });

  it('matches the snapshot of every booking link', () => {
    const site = buildSiteData(seededShopSource());
    expect({
      booking: site.booking,
      team: site.team.map((m) => ({ id: m.id, bookingUrl: m.bookingUrl })),
      services: site.services.all.map((s) => ({ id: s.id, bookingUrl: s.bookingUrl })),
    }).toMatchSnapshot();
  });
});

describe('empty states', () => {
  const site = buildSiteData(emptyShopSource());

  it('marks every optional section as empty', () => {
    expect(site.has).toEqual({
      description: false,
      address: false,
      contact: false,
      socials: false,
      openingHours: false,
      team: false,
      services: false,
      products: false,
      booking: false,
    });
    expect(site.booking).toEqual({ available: false, url: null, hostedUrl: null, label: 'Book an appointment' });
    expect(site.seo.pages).toEqual([]);
  });

  it('writes an honest SEO description without inventing anything', () => {
    expect(site.seo.title).toBe('Empty Barbers | Barbershop');
    expect(site.seo.description).toBe('Empty Barbers is a barbershop.');
  });

  it('keeps JSON-LD to what exists: no catalogue, hours, address or price range', () => {
    const shop = (site.seo.jsonLd['@graph'] as Array<Record<string, unknown>>)[1];
    expect(shop['@type']).toBe('HairSalon');
    expect(shop).not.toHaveProperty('hasOfferCatalog');
    expect(shop).not.toHaveProperty('openingHoursSpecification');
    expect(shop).not.toHaveProperty('address');
    expect(shop).not.toHaveProperty('priceRange');
  });
});

describe('JSON-LD', () => {
  const site = buildSiteData(seededShopSource());
  const graph = site.seo.jsonLd['@graph'] as Array<Record<string, unknown>>;
  const shop = graph.find((n) => n['@type'] === 'HairSalon')!;

  it('matches the snapshot for the seeded shop', () => {
    expect(site.seo.jsonLd).toMatchSnapshot();
  });

  it('never emits reviews or ratings', () => {
    const all = [site.seo.jsonLd, ...site.seo.pages.map((p) => p.jsonLd)];
    const types = collectTypes(all);
    expect(types).not.toContain('Review');
    expect(types).not.toContain('AggregateRating');
    expect(JSON.stringify(all)).not.toMatch(/aggregateRating|"review"/i);
  });

  it('uses a real schema.org business type (HairSalon; schema.org has no BarberShop)', () => {
    const all = [site.seo.jsonLd, ...site.seo.pages.map((p) => p.jsonLd)];
    const types = collectTypes(all);
    expect(types).not.toContain('BarberShop');
    for (const doc of all) {
      const business = (doc['@graph'] as Array<Record<string, unknown>>)[1];
      expect(business['@type']).toBe('HairSalon');
      expect(business['@id']).toBe('https://fixturebarbers.example.test#barbershop');
    }
  });

  it('matches visible content: open days, active services, priced products', () => {
    const specs = shop.openingHoursSpecification as Array<Record<string, string>>;
    expect(specs.map((s) => s.dayOfWeek.replace('https://schema.org/', ''))).toEqual(
      site.openingHours.days.filter((d) => d.isOpen).map((d) => d.dayName),
    );
    const catalog = shop.hasOfferCatalog as { itemListElement: Array<{ itemListElement: unknown[] }> };
    const offerCount = catalog.itemListElement.reduce((n, c) => n + c.itemListElement.length, 0);
    expect(offerCount).toBe(site.services.all.length);
    expect(graph.filter((n) => n['@type'] === 'Product')).toHaveLength(site.products.length);
    expect(shop.priceRange).toBe('£12.50–£30');
  });

  it('uses stable @ids anchored on the canonical site URL', () => {
    expect(graph.map((n) => n['@id'])).toEqual([
      'https://fixturebarbers.example.test#website',
      'https://fixturebarbers.example.test#barbershop',
      'https://kersivo.co.uk/shop/shop_fixture/p1#product',
      'https://kersivo.co.uk/shop/shop_fixture/p2#product',
    ]);
  });

  it('adds a BreadcrumbList to sub-pages', () => {
    const services = site.seo.pages.find((p) => p.key === 'services')!;
    const crumbs = (services.jsonLd['@graph'] as Array<Record<string, unknown>>).find(
      (n) => n['@type'] === 'BreadcrumbList',
    ) as { itemListElement: Array<{ name: string; item: string }> };
    expect(crumbs.itemListElement.map((i) => [i.name, i.item])).toEqual([
      ['Home', 'https://fixturebarbers.example.test'],
      ['Services', 'https://fixturebarbers.example.test/services'],
    ]);
    expect(site.seo.pages.map((p) => p.key)).toEqual(['services', 'team', 'contact', 'shop']);
  });

  it('is plain JSON (serialisable, no undefined)', () => {
    expect(JSON.parse(JSON.stringify(site))).toEqual(site);
  });
});
