import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blacklineAdminHref } from '@/lib/admin/demoConfig';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  AFTER_BOOKING_BANNED_CLAIMS,
  AFTER_BOOKING_GOOGLE_MARK_SRC,
  AFTER_BOOKING_LIVE_STATUS,
  AFTER_BOOKING_PLANNED_STATUS,
  buildAfterBookingExample,
} from '@/lib/barbershopOnlineBooking/afterBookingExample';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingAfterBooking.astro');
const helper = read('lib/barbershopOnlineBooking/afterBookingExample.ts');
const scrollModule = read('lib/barbershopOnlineBooking/afterBookingScroll.ts');
const css = read('styles/components/barbershop-online-booking-after.css');
const entryCss = read('styles/components/barbershop-online-booking-entry.css');
const entryComponent = read('components/barbershop-online-booking/OnlineBookingEntryPoints.astro');

const [, frontmatter, ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const textOf = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Barbershop online booking page — Section 06 cinematic scroll story', () => {
  it('renders directly after locked Section 05 with the approved H2', () => {
    const entry = page.indexOf('<OnlineBookingEntryPoints />');
    const after = page.indexOf('<OnlineBookingAfterBooking />');
    expect(entry).toBeGreaterThan(-1);
    expect(after).toBeGreaterThan(entry);
    expect(page.slice(entry, after).replace('<OnlineBookingEntryPoints />', '').trim()).toBe('');

    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain(
      '<h2 id="bob-ab-title" class="bob-ab__title">The Next Booking Starts With the Last Visit.</h2>',
    );
    expect(markup).toContain('Keep the connection. Make it easy to come back.');
    expect(markup).toContain('bob-ab-handoff');
    expect(markup).toContain('From the booking journey');
  });

  it('uses a sticky scrub story without SVG diagram, radios, or photograph', () => {
    expect(markup).toContain('bob-ab-story');
    expect(markup).toContain('data-bob-ab-track');
    expect(markup).toContain('bob-ab-stage');
    expect(markup).toContain('bob-ab-scene--a');
    expect(markup).toContain('bob-ab-scene--b');
    expect(markup).toContain('bob-ab-scene--c');
    expect(markup).toContain('bob-ab-sms');
    expect(markup).toContain('src={example.googleMarkSrc}');
    expect(markup).not.toContain('bob-ab-diagram');
    expect(markup).not.toContain('bob-ab-stages');
    expect(markup).not.toContain('name="bob-ab-stage"');
    expect(markup).not.toContain('type="radio"');
    expect(markup).not.toContain('bob-ab-photo');
    expect(markup).not.toContain('barber-at-work');
    expect(helper).not.toContain('AFTER_BOOKING_PHOTO');
    expect(helper).not.toContain('stages:');
    expect(css).toContain('--bob-ab-p');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).not.toContain('bob-ab-diagram');
    expect(css).not.toContain('offset-path');
  });

  it('keeps three scenes with Live vs Planned labels, SMS note, and non-link planned CTAs', () => {
    const example = buildAfterBookingExample();
    expect(example.scenes).toHaveLength(3);
    expect(example.googleMarkSrc).toBe(AFTER_BOOKING_GOOGLE_MARK_SRC);
    expect(helper).toContain(AFTER_BOOKING_LIVE_STATUS);
    expect(helper).toContain(AFTER_BOOKING_PLANNED_STATUS);
    expect(example.smsNote.toLowerCase()).toContain('not every booking');
    expect(example.smsNote.toLowerCase()).toContain('monthly sms allowance');
    expect(markup).toContain('bob-ab-review__cta');
    expect(markup).toContain('bob-ab-rebook__cta');
    expect(markup).toContain('aria-hidden="true"');
    expect(example.scenes.find((scene) => scene.id === 'rebook')?.ctaLabel).toBe('Book Again');
    expect(example.scenes.find((scene) => scene.id === 'thanksReview')?.ctaLabel).toBe(
      'Leave a Google Review',
    );
  });

  it('binds a reduced-motion-aware scroll module as progressive enhancement', () => {
    expect(scrollModule).toContain('bindAfterBookingScroll');
    expect(scrollModule).toContain('prefers-reduced-motion');
    expect(scrollModule).toContain('astro:before-swap');
    expect(scrollModule).toContain('--bob-ab-p');
    expect(component).toContain("import { bindAfterBookingScroll } from '@/lib/barbershopOnlineBooking/afterBookingScroll';");
    expect(component).toContain("document.addEventListener('astro:page-load', () => bindAfterBookingScroll());");
    expect(css).toContain("data-bob-ab-scrub='on'");
    expect(css).toContain('.bob-ab:not([data-bob-ab-scrub=\'on\'])');
  });

  it('bans live automation claims and keeps planned CTAs non-interactive', () => {
    const example = buildAfterBookingExample();
    const lower = [
      ...example.scenes.flatMap((scene) => [
        scene.display ?? '',
        scene.title,
        scene.body ?? '',
        scene.note ?? '',
        scene.statusLabel,
        scene.ctaLabel ?? '',
      ]),
      example.disclosure,
      example.smsNote,
      textOf(markup),
    ]
      .join(' ')
      .toLowerCase();
    for (const banned of AFTER_BOOKING_BANNED_CLAIMS) {
      expect(lower).not.toContain(banned);
    }
    expect(markup).not.toMatch(/href=.*(Leave a Google Review|Book Again)/);
  });

  it('keeps one tracked admin demo CTA, page unpublished, and Section 05 files untouched', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(false);
    const anchors = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain('href={OWNER_TIMELINE_HREF}');
    expect(frontmatter).toContain("const OWNER_TIMELINE_HREF = blacklineAdminHref('bookings_dashboard');");
    expect(blacklineAdminHref('bookings_dashboard')).toBe('/demo/admin?section=bookings_dashboard');
    expect(frontmatter).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(component).not.toMatch(/<form\b|<iframe\b|client:/);
    expect(css).toMatch(/\.bob-ab__cta:focus-visible \{[^}]*outline:/);
    expect(entryCss).toContain('.bob-ep');
    expect(entryComponent).toContain('bob-ep-source__visual');
    expect(helper).toContain('decodeHtmlEntities');
  });
});
