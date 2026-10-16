import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ENTRY_BANNED_CLAIMS,
  ENTRY_CHANNELS,
  buildEntryPointsExample,
} from '@/lib/barbershopOnlineBooking/entryPointsExample';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';

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

const [, , ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const publicCopy = [
  ...ENTRY_CHANNELS.map((channel) => `${channel.label} ${channel.shortLabel}`),
  buildEntryPointsExample().qrCardAlt,
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

  it('uses one H2 and four always-visible sources without a lower close block', () => {
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain(
      '<h2 id="bob-ep-title" class="bob-ep__title">One Booking Journey, Several Ways to Reach It</h2>',
    );
    expect(markup).toContain('Where bookings start');
    expect(markup).toContain('bob-ep-source__visual');
    expect(markup).not.toContain('bob-ep-close');
    expect(markup).not.toContain('bob-ep-dest');
    expect(markup).not.toContain('bob-ep-converge');
    expect(markup).not.toContain('bob-ep-unity');
    expect(markup).not.toContain('bob-ep-detail');
    expect(markup).not.toContain('bob-ep-foot');
    expect(markup).not.toContain('type="radio"');
    expect(markup).not.toContain('<a ');
    expect(helper).toContain('buildEntryPointsExample');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(css).toContain('place-items: center');
    expect(css).not.toContain('bob-ep-close');
    expect(css).not.toContain('bob-ep-dest');
  });

  it('uses required source visuals: Cutstate demo, Google mark, Instagram profile, QR', () => {
    expect(markup).toContain('bob-ep-viz--website');
    expect(helper).toContain('/demo/heroimg.webp');
    expect(helper).toContain('/demo/cutstate-logo.png');
    expect(markup).toContain('bob-ep-viz--google');
    expect(helper).toContain('/images/starter/google-g-192.webp');
    expect(markup).toContain('bob-ep-viz--instagram');
    expect(markup).toContain('bob-ep-ig__book');
    expect(markup).toContain('bob-ep-ig__grid');
    expect(helper).toContain('@cutstatebarbers');
    expect(helper).not.toContain('barber-at-work');
    expect(markup).toContain('bob-ep-viz--qr');
    expect(helper).toContain('kersivo-book-now-qr-glass-sign-640.webp');
  });

  it('stays free of native-integration and Reserve with Google claims', () => {
    for (const banned of ENTRY_BANNED_CLAIMS) {
      expect(publicCopy).not.toContain(banned);
    }
  });

  it('keeps the page unpublished and has no tracked CTA in this section', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(false);
    expect(component).not.toContain('data-track');
    expect(component).not.toContain('TRACK_EVENT');
    expect(component).not.toContain('STARTER_PAGE_PATH');
  });

  it('stays free of client islands', () => {
    expect(component).not.toMatch(/<script\b|<iframe\b|client:/);
    expect(component).not.toMatch(/<form\b/);
    expect(markup).toContain('aria-labelledby="bob-ep-title"');
  });
});
