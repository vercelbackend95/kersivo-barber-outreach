import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  ENTRY_BANNED_CLAIMS,
  ENTRY_BRIDGE,
  ENTRY_CHANNELS,
  ENTRY_DISCLOSURE,
  ENTRY_QR_PLACEMENTS,
  buildEntryPointsExample,
} from '@/lib/barbershopOnlineBooking/entryPointsExample';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';
import { STARTER_PAGE_PATH } from '@/lib/seo/starterPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingEntryPoints.astro');
const helper = read('lib/barbershopOnlineBooking/entryPointsExample.ts');
const css = read('styles/components/barbershop-online-booking-entry.css');
const amendment = readFileSync(
  join(here, '../../../docs/gtm/barbershop-online-booking-section-order-amendment-2026-10-15.md'),
  'utf8',
);

const [, frontmatter, ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const source = `${frontmatter}\n${markup}`;
const textOf = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const publicCopy = [
  ...ENTRY_CHANNELS.map((channel) => `${channel.label} ${channel.body}`),
  ENTRY_BRIDGE,
  ENTRY_DISCLOSURE,
  ...ENTRY_QR_PLACEMENTS.map((placement) => `${placement.title} ${placement.line} ${placement.purpose}`),
  ...Object.values(buildEntryPointsExample()).flatMap((value) =>
    typeof value === 'string' ? [value] : Array.isArray(value) ? value.map((entry) => JSON.stringify(entry)) : [],
  ),
]
  .join(' ')
  .toLowerCase();

describe('Barbershop online booking page — Section 05 entry points', () => {
  it('renders directly after Section 04 with the owner-approved section order', () => {
    const payments = page.indexOf('<OnlineBookingPayments />');
    const entry = page.indexOf('<OnlineBookingEntryPoints />');
    expect(payments).toBeGreaterThan(-1);
    expect(entry).toBeGreaterThan(payments);
    expect(page.slice(payments, entry).replace('<OnlineBookingPayments />', '').trim()).toBe('');
    expect(page).toContain(
      "import OnlineBookingEntryPoints from '@/components/barbershop-online-booking/OnlineBookingEntryPoints.astro';",
    );
    const after = page.indexOf('<OnlineBookingAfterBooking />');
    expect(after).toBeGreaterThan(entry);
    expect(amendment).toContain('05 | Where Bookings Start');
    expect(amendment).toContain('06 | After Booking & Customer Retention');
  });

  it('uses one H2 and four selectable entry channels into one destination', () => {
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain(
      '<h2 id="bob-ep-title" class="bob-ep__title">One Booking Journey, Several Ways to Reach It</h2>',
    );
    expect(markup).toContain('Where bookings start');
    expect(markup).toContain('name="bob-ep-channel"');
    expect(markup).toContain('example.channels.map');
    expect(ENTRY_CHANNELS).toHaveLength(4);
    expect(markup).toContain('id={`bob-ep-ch-${channel.id}`}');
    expect(markup).toContain('Booking destination');
    expect(markup).toContain('{destination.shopName}');
    expect(helper).toContain('buildEntryPointsExample');
  });

  it('keeps Starter hosted and Full verified own-domain destinations distinct', () => {
    expect(source).toContain('starterDestination');
    expect(source).toContain('fullDestination');
    expect(helper).toContain('KERSIVO-hosted public booking page');
    expect(helper).toContain('own-domain booking destination');
    expect(textOf(markup)).toContain('Starter.');
    expect(textOf(markup)).toContain('Full.');
  });

  it('qualifies Google and social without native-integration or Reserve with Google claims', () => {
    expect(publicCopy).toContain('guided setup');
    expect(publicCopy).toContain('google decides');
    expect(publicCopy).toContain('does not offer a native instagram booking product');
    for (const banned of ENTRY_BANNED_CLAIMS) {
      expect(publicCopy).not.toContain(banned);
    }
  });

  it('presents WINDOW and REBOOK QR as illustrative placements, not live scannable codes', () => {
    expect(ENTRY_QR_PLACEMENTS.map((placement) => placement.title)).toEqual(['WINDOW', 'REBOOK']);
    expect(ENTRY_QR_PLACEMENTS.map((placement) => placement.line)).toEqual([
      'BOOK ONLINE',
      'REBOOK BEFORE YOU LEAVE',
    ]);
    expect(markup).toContain('example.qrPlacements.map');
    expect(markup).toContain('not a live shop QR code');
    expect(helper).toContain('kersivo-book-now-qr-glass-sign-640.webp');
    expect(publicCopy).not.toContain('kit has already been shipped');
  });

  it('bridges toward future retention without advertising automated campaigns', () => {
    expect(ENTRY_BRIDGE.toLowerCase()).toContain('already in the chair');
    expect(markup).toContain('{example.bridge}');
    expect(publicCopy).not.toContain('automatically sends');
    expect(publicCopy).not.toContain('google review request');
    expect(publicCopy).not.toContain('rebooking campaign');
  });

  it('keeps the page unpublished and uses one tracked Starter CTA', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(false);
    const anchors = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain('href={STARTER_PAGE_PATH}');
    expect(anchors[0]).toContain('data-track={TRACK_EVENT}');
    expect(anchors[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(frontmatter).toContain('STARTER_PAGE_PATH');
    expect(STARTER_PAGE_PATH).toBe('/starter');
    expect(frontmatter).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.primary_cta_clicked}';`);
    expect(frontmatter).toContain("const TRACK_PLACEMENT = 'barbershop_online_booking_entry';");
    expect(markup).toContain('Explore KERSIVO Starter');
  });

  it('stays free of client islands and uses radio CSS progressive enhancement', () => {
    expect(component).not.toMatch(/<script\b|<iframe\b|client:/);
    expect(component).not.toMatch(/<form\b/);
    expect(markup).toContain('aria-labelledby="bob-ep-title"');
    expect(css).toContain(':has(#bob-ep-ch-website:checked)');
    expect(css).toMatch(/\.bob-ep__cta:focus-visible \{[^}]*outline:/);
    expect(css).toContain('prefers-reduced-motion');
    expect(ENTRY_DISCLOSURE).toContain('Nothing on this page activates Google');
    expect(markup).toContain('{example.disclosure}');
  });
});
