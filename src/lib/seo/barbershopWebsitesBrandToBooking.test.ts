import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { DEMO_BARBERS, demoBarberBookingHref, resolveDemoBarberSlug } from '@/lib/demo/barbers';
import { DEMO_HOME_HREF } from '@/lib/demo/nav';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import { CUTSTATE_LOGO_SRC } from '@/components/demo/BlacklineWordmark';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const section = read('../../components/barbershop-websites/BrandToBooking.astro');
const hero = read('../../components/barbershop-websites/BarbershopWebsitesHero.astro');
const bookingCard = read('../../components/barbershop-websites/BookingPreview.astro');
const brandCss = read('../../styles/components/barbershop-websites-brand-to-booking.css');
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

  it('introduces the client journey with the approved editorial header', () => {
    expect(section).toContain('aria-labelledby="bsw-b2b-heading"');
    expect(section.match(/<h2\b/g) ?? []).toHaveLength(1);
    const heading = text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '').replace(' .', '.');
    expect(heading).toBe('From first impression to booking.');
    const copy = text(markup);
    expect(copy).toMatch(/^The client journey/i);
    expect(copy).toContain(
      'Your brand sets the tone. Your website carries it through — from discovering your barbershop and choosing a barber to booking an appointment.',
    );
    expect(markup.indexOf('<h2')).toBeLessThan(markup.indexOf('bsw-b2b__moments'));
  });

  it('tells one journey as three ordered H3 moments: discover, choose, book', () => {
    const titles = [...markup.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1].trim());
    expect(titles).toEqual(['Discover the shop', 'Explore and choose', 'Book an appointment']);
    const moments = markup.match(/<ol class="bsw-b2b__moments"[\s\S]*<\/ol>/)?.[0] ?? '';
    expect(moments.match(/<h3\b/g) ?? []).toHaveLength(3);
  });

  it('labels the previews as illustrative and keeps them non-interactive', () => {
    expect(text(markup)).toContain('These previews are illustrative.');
    const phones = markup.match(/<div\s+class="bsw-b2b-phone"[\s\S]*?<div class="bsw-b2b-moment__caption">/g) ?? [];
    expect(phones).toHaveLength(3);
    for (const phone of phones) {
      expect(phone).toMatch(/role="img"/);
      expect(phone).toMatch(/aria-label=[{"`]+Illustrative preview of the CUTSTATE demo/);
      expect(phone).toContain('aria-hidden="true"');
      expect(phone).not.toMatch(/<a\b|<button\b|href=/);
    }
    expect(text(markup)).not.toMatch(/\b\d{1,2}:\d{2}\b|booking confirmed|booked!/i);
  });

  it('offers exactly one CTA: the working demo', () => {
    const [cta = '', ...rest] = anchors();
    expect(rest).toHaveLength(0);
    expect(cta).toContain('href={DEMO_HOME_HREF}');
    expect(cta).toContain('class="bsw-b2b__cta"');
    expect(text(cta)).toBe('Explore the working demo');
    expect(DEMO_HOME_HREF).toBe('/demo');
    expect(demoRouteExists(DEMO_HOME_HREF)).toBe(true);
    expect(markup).not.toMatch(/Meet the (BLACKLINE|CUTSTATE) barbers|Start a demo booking/);
  });

  it('carries the chosen barber from the roster into the booking screen', () => {
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

  it('tracks the CTA as a live-demo click with its own section placement', () => {
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

  it('shows the approved CUTSTATE logo in every phone preview instead of a recreated wordmark', () => {
    const phones = markup.match(/<div\s+class="bsw-b2b-phone"[\s\S]*?<div class="bsw-b2b-moment__caption">/g) ?? [];
    expect(phones).toHaveLength(3);
    for (const phone of phones) {
      const logo = phone.match(/<img\s+class="bsw-b2b-lockup"[\s\S]*?\/>/)?.[0] ?? '';
      expect(logo).toContain('src={CUTSTATE_LOGO_SRC}');
      expect(logo).toContain('width={CUTSTATE_LOGO_WIDTH}');
      expect(logo).toContain('height={CUTSTATE_LOGO_HEIGHT}');
      expect(phone).not.toMatch(/bsw-b2b-lockup__(name|sub)/);
    }
    expect(CUTSTATE_LOGO_SRC).toBe('/demo/cutstate-logo.png');
    expect(existsSync(join(root, 'public', CUTSTATE_LOGO_SRC))).toBe(true);
    expect(phones[2]).toContain('<span class="bsw-b2b-phone__eyebrow">{DEMO_SHOP_NAME}</span>');
    expect(DEMO_SHOP_NAME).toBe('Cutstate Barbers');
    expect(text(markup)).not.toMatch(/blackline/i);
    expect(brandCss).not.toMatch(/bsw-shop-rule|#d72638|bsw-b2b-lockup__/i);
    expect(brandCss).toContain('--bsw-shop-accent: #315ef5;');
  });

  it('discloses that CUTSTATE is fictional and demo bookings are not real', () => {
    const disclosure = text(markup.match(/<p class="bsw-b2b__disclosure">[\s\S]*?<\/p>/)?.[0] ?? '');
    expect(disclosure).toBe(
      'CUTSTATE BARBERS is a fictional demo shop. These previews are illustrative. Demo bookings stay in your browser session — no real appointment is created and no payment is taken.',
    );
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
