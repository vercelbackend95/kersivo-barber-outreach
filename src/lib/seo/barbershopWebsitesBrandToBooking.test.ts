import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_BARBERS, demoBarberBookingHref, resolveDemoBarberSlug } from '@/lib/demo/barbers';
import { DEMO_BOOK_HREF, DEMO_HOME_HREF } from '@/lib/demo/nav';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/BrandToBooking.astro');
const markup = section.split(/^---$/m)[2] ?? '';

const text = (source: string) =>
  source.replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
const demoRouteExists = (href: string) => {
  const path = href.split('?')[0].replace(/^\/demo\/?/, '');
  const base = join(root, 'src/pages/demo', path);
  return existsSync(`${base}.astro`) || existsSync(join(base, 'index.astro'));
};

describe('/barbershop-websites — section 04 brand to booking', () => {
  it('renders after section 03 and before the footer without adding an H1', () => {
    const at = page.indexOf('<BrandToBooking />');
    expect(at).toBeGreaterThan(page.indexOf('<WebsiteEssentials />'));
    expect(at).toBeLessThan(page.indexOf('<Footer50'));
    expect(section).not.toMatch(/<h1\b/);
  });

  it('carries the approved heading and supporting copy', () => {
    expect(section).toContain('aria-labelledby="bsw-b2b-heading"');
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    const copy = text(markup);
    expect(copy).toContain('Your brand. Your website. Your bookings.');
    expect(copy).toContain(
      'From discovering your barbershop to booking an appointment, give clients one connected experience built around your business.',
    );
    expect(copy).toContain(
      'Your website should feel like your shop — with online booking that fits naturally into the experience.',
    );
  });

  it('tells the journey as three ordered H3 moments: discover, choose, book', () => {
    const titles = [...markup.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1].trim());
    expect(titles).toEqual(['Discover the shop', 'Explore and choose', 'Book an appointment']);
    const journey = markup.match(/<ol class="bsw-b2b__journey"[\s\S]*<\/ol>/)?.[0] ?? '';
    expect(journey.match(/<h3\b/g) ?? []).toHaveLength(3);
  });

  it('links to the working demo and the demo booking flow', () => {
    expect(DEMO_HOME_HREF).toBe('/demo');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(markup).toMatch(/<a[^>]*href=\{DEMO_HOME_HREF\}[^>]*>Explore the working demo<\/a>/);
    expect(markup).toMatch(/<a[^>]*href=\{DEMO_BOOK_HREF\}[^>]*>[^<]*demo booking[^<]*<\/a>/i);
    for (const href of [DEMO_HOME_HREF, DEMO_BOOK_HREF, ...DEMO_BARBERS.map((b) => demoBarberBookingHref(b.slug))]) {
      expect(demoRouteExists(href), href).toBe(true);
    }
    expect(markup).not.toMatch(/href="(?!\/demo)/);
  });

  it('lets visitors start a demo booking with each real BLACKLINE barber', () => {
    expect(section).toContain('demoBarberBookingHref(barber.slug)');
    expect(section).toContain('DEMO_BARBERS.map(');
    expect(markup).toContain('aria-label={`Start a demo booking with ${barber.name}`}');
    for (const barber of DEMO_BARBERS) {
      const query = new URLSearchParams(demoBarberBookingHref(barber.slug).split('?')[1]);
      expect(resolveDemoBarberSlug(query.get('barber'))?.name).toBe(barber.name);
      expect(existsSync(join(root, 'public/images/barbershop-websites', `barber-${barber.slug}.webp`))).toBe(true);
    }
  });

  it('takes services and prices from the demo data instead of hard-coding them', () => {
    expect(section).toContain('DEMO_SERVICES.filter(');
    expect(section).toContain('formatDemoPriceGbp(service.pricePence)');
    expect(markup).not.toMatch(/£\s?\d/);
  });

  it('discloses that BLACKLINE is fictional and demo bookings are not real', () => {
    const copy = text(markup);
    expect(copy).toContain('BLACKLINE Barbers is a fictional demonstration shop.');
    expect(copy).toMatch(/no real appointment is made and nothing is charged/);
    expect(copy).toContain('Example booking summary');
  });

  it('uses real, sized, lazy-loaded images with alt text', () => {
    const imgs = markup.match(/<img\b[\s\S]*?\/>/g) ?? [];
    expect(imgs.length).toBeGreaterThanOrEqual(3);
    for (const img of imgs) {
      for (const attr of ['src=', 'alt=', 'width=', 'height=', 'loading="lazy"']) {
        expect(img).toContain(attr);
      }
    }
    for (const [, src] of section.matchAll(/src: '([^']+)'/g)) {
      expect(existsSync(join(root, 'public', src)), src).toBe(true);
    }
  });

  it('ships as static HTML with no hydration or scripts', () => {
    expect(section).not.toMatch(/client:|<script|<iframe/);
  });

  it('avoids unsupported claims, KERSIVO pricing and competitor names', () => {
    expect(text(markup)).not.toMatch(
      /KERSIVO|unlimited|bespoke|revision|source code|white-label|guarantee|\brank|more (clients|customers|bookings)|Booksy|Fresha|Nearcut|commission/i,
    );
  });
});
