import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { DEMO_BARBERS, demoBarberBookingHref, resolveDemoBarberSlug } from '@/lib/demo/barbers';
import { DEMO_HOME_HREF } from '@/lib/demo/nav';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/BrandToBooking.astro');
const hero = read('../../components/barbershop-websites/BarbershopWebsitesHero.astro');
const bookingCard = read('../../components/barbershop-websites/BookingPreview.astro');
const [, frontmatter = '', markup = ''] = section.split(/^---$/m);

const text = (source: string) =>
  source.replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
const constant = (name: string) => frontmatter.match(new RegExp(`const ${name} = '([^']+)'`))?.[1];
const anchors = () => markup.match(/<a\b[\s\S]*?<\/a>/g) ?? [];
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

  it('leads with the approved message and says the identity carries through to booking', () => {
    expect(section).toContain('aria-labelledby="bsw-b2b-heading"');
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    const copy = text(markup);
    expect(copy).toContain('Your brand. Your website. Your bookings.');
    expect(copy).toContain(
      'From discovering your barbershop to booking an appointment, give clients one connected experience built around your business.',
    );
    expect(copy).toMatch(/carry through every step — booking included/);
  });

  it('tells one journey as three ordered H3 moments: discover, choose, book', () => {
    const titles = [...markup.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1].trim());
    expect(titles).toEqual(['Discover the shop', 'Explore and choose', 'Book an appointment']);
    const moments = markup.match(/<ol class="bsw-b2b__moments"[\s\S]*<\/ol>/)?.[0] ?? '';
    expect(moments.match(/<h3\b/g) ?? []).toHaveLength(3);
  });

  it('labels the previews as illustrative and keeps them non-interactive', () => {
    expect(text(markup)).toContain('Illustrative previews of the demo pages. The links open the working demo.');
    const phones = markup.match(/<div\s+class="bsw-b2b-phone"[\s\S]*?<div class="bsw-b2b-moment__caption">/g) ?? [];
    expect(phones).toHaveLength(3);
    for (const phone of phones) {
      expect(phone).toMatch(/role="img"/);
      expect(phone).toMatch(/aria-label=[{"`]+Illustrative preview of the BLACKLINE demo/);
      expect(phone).toContain('aria-hidden="true"');
      expect(phone).not.toMatch(/<a\b|<button\b|href=/);
    }
    expect(text(markup)).not.toMatch(/\b\d{1,2}:\d{2}\b|booking confirmed|booked!/i);
  });

  it('offers one primary demo CTA and secondary links that follow the journey', () => {
    const links = anchors();
    expect(links).toHaveLength(3);
    const [primary = '', barbersLink = '', bookingLink = ''] = links;
    expect(primary).toContain('href={DEMO_HOME_HREF}');
    expect(text(primary.replace(/<span aria-hidden="true">[^<]*<\/span>/g, ''))).toBe('Explore the working demo');
    expect(markup.indexOf('Explore the working demo')).toBeLessThan(markup.indexOf('bsw-b2b__stage'));
    expect(text(barbersLink)).toBe('Meet the BLACKLINE barbers');
    expect(text(bookingLink)).toMatch(/^Start a demo booking with/);
    expect(DEMO_HOME_HREF).toBe('/demo');
    expect(constant('barbersHref')).toBe('/demo/barbers');
    for (const href of [DEMO_HOME_HREF, constant('barbersHref') ?? '', ...DEMO_BARBERS.map((b) => demoBarberBookingHref(b.slug))]) {
      expect(demoRouteExists(href), href).toBe(true);
    }
  });

  it('hands the chosen barber into the real booking flow', () => {
    expect(section).toContain('const bookingHref = demoBarberBookingHref(barber.slug)');
    const phones = markup.match(/<div\s+class="bsw-b2b-phone"[\s\S]*?<div class="bsw-b2b-moment__caption">/g) ?? [];
    for (const phone of phones.slice(1)) {
      expect(phone).toContain('{barber.name}');
    }
    expect(phones[2] ?? '').toContain('Book a chair');
    const barber = DEMO_BARBERS.find((b) => b.slug === 'ellis-ward') ?? DEMO_BARBERS[0];
    const query = new URLSearchParams(demoBarberBookingHref(barber.slug).split('?')[1]);
    expect(resolveDemoBarberSlug(query.get('barber'))?.name).toBe(barber.name);
    expect(existsSync(join(root, 'public', barber.image.src))).toBe(true);
    expect(existsSync(join(root, 'public/images/barbershop-websites', `barber-${barber.slug}.webp`))).toBe(true);
  });

  it('tracks every demo link as a live-demo click with its own section placement', () => {
    const event = constant('TRACK_EVENT');
    const placement = constant('TRACK_PLACEMENT');
    expect(event).toBe(FUNNEL_EVENTS.view_live_demo_click);
    expect(placement).toBe('barbershop_websites_brand_to_booking');
    expect(`${hero}${bookingCard}`).not.toContain(`"${placement}"`);
    for (const link of anchors()) {
      expect(link).toContain('data-track={TRACK_EVENT}');
      expect(link).toContain('data-track-placement={TRACK_PLACEMENT}');
    }
    expect(markup.match(/data-track=/g) ?? []).toHaveLength(anchors().length);
    expect(markup).not.toMatch(/onclick|addEventListener|gtag\(|checkout|starter_signup/i);
  });

  it('discloses that BLACKLINE is fictional and demo bookings are not real', () => {
    const copy = text(markup);
    expect(copy).toContain('BLACKLINE Barbers is a fictional demonstration shop.');
    expect(copy).toMatch(/no real appointment is made and nothing is charged/);
  });

  it('uses real, sized, lazy-loaded images', () => {
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

  it('ships as static HTML with an accessible, keyboard-reachable journey track', () => {
    expect(section).not.toMatch(/client:|<script|<iframe/);
    expect(markup).toMatch(/class="bsw-b2b__track" role="region" aria-label="[^"]+" tabindex="0"/);
  });

  it('avoids unsupported claims, KERSIVO pricing and competitor names', () => {
    expect(text(markup)).not.toMatch(
      /KERSIVO|£|unlimited|bespoke|revision|source code|white-label|guarantee|\brank|more (clients|customers|bookings)|Booksy|Fresha|Nearcut|commission/i,
    );
  });
});
