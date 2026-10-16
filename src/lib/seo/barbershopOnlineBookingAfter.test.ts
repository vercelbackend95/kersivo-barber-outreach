import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blacklineAdminHref } from '@/lib/admin/demoConfig';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  AFTER_BOOKING_BANNED_CLAIMS,
  AFTER_BOOKING_CONCEPT_STATUS,
  AFTER_BOOKING_GOOGLE_MARK_SRC,
  buildAfterBookingExample,
} from '@/lib/barbershopOnlineBooking/afterBookingExample';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingAfterBooking.astro');
const helper = read('lib/barbershopOnlineBooking/afterBookingExample.ts');
const css = read('styles/components/barbershop-online-booking-after.css');
const entryCss = read('styles/components/barbershop-online-booking-entry.css');
const entryComponent = read('components/barbershop-online-booking/OnlineBookingEntryPoints.astro');
const scrollPath = join(srcDir, 'lib/barbershopOnlineBooking/afterBookingScroll.ts');

const [, frontmatter, ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const textOf = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Barbershop online booking page — Section 06 post-visit retention story', () => {
  it('renders directly after locked Section 05 with the approved H2', () => {
    const entry = page.indexOf('<OnlineBookingEntryPoints />');
    const after = page.indexOf('<OnlineBookingAfterBooking />');
    expect(entry).toBeGreaterThan(-1);
    expect(after).toBeGreaterThan(entry);
    expect(page.slice(entry, after).replace('<OnlineBookingEntryPoints />', '').trim()).toBe('');

    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain(
      '<h2 id="bob-ab-title" class="bob-ab__title">Booking Confirmations and What Comes Next.</h2>',
    );
    expect(markup).toContain('After a booking');
    expect(markup).toContain('provides booking confirmation emails and appointment reminders');
    expect(markup).toContain('planned concepts, not features available today');
    expect(markup).not.toContain('bob-ab-handoff');
  });

  it('uses a premium communication showcase without scroll scrub or reminder-first panels', () => {
    expect(existsSync(scrollPath)).toBe(false);
    expect(markup).toContain('bob-ab-showcase');
    expect(markup).toContain('bob-ab-beat--thanks');
    expect(markup).toContain('bob-ab-beat--review');
    expect(markup).toContain('bob-ab-beat--rebook');
    expect(markup).toContain('bob-ab-mail');
    expect(markup).toContain('bob-ab-invite');
    expect(markup).toContain('bob-ab-return');
    expect(markup).toContain('src={example.googleMarkSrc}');
    expect(markup).not.toContain('bob-ab-moment--confirm');
    expect(markup).not.toContain('bob-ab-sms');
    expect(markup).not.toContain('Your appointment is coming up.');
    expect(markup).not.toContain('bob-ab__bridge');
    expect(markup).not.toContain('data-bob-ab-track');
    expect(markup).not.toContain('bob-ab-diagram');
    expect(markup).not.toContain('type="radio"');
    expect(markup).not.toContain('bindAfterBookingScroll');
    expect(component).not.toMatch(/<script\b/);
    expect(helper).not.toContain('stages:');
    expect(helper).toContain('moments:');
    expect(helper).not.toContain('AFTER_BOOKING_LIVE_STATUS');
    expect(css).not.toContain('--bob-ab-p');
    expect(css).not.toContain('240vh');
    expect(css).not.toContain('data-bob-ab-scrub');
    expect(css).not.toContain('offset-path');
  });

  it('keeps one section-level concept status and non-link illustrative CTAs', () => {
    const example = buildAfterBookingExample();
    expect(example.moments).toHaveLength(3);
    expect(example.moments.map((moment) => moment.id)).toEqual(['thanks', 'review', 'rebook']);
    expect(example.googleMarkSrc).toBe(AFTER_BOOKING_GOOGLE_MARK_SRC);
    expect(example.conceptStatus).toBe(AFTER_BOOKING_CONCEPT_STATUS);
    expect(markup).toContain('bob-ab-concept');
    expect(markup).toContain('not currently live');
    expect(example.disclosure).toContain('None of these post-visit automations is live.');
    expect(markup).toContain('{example.conceptStatus}');
    expect(markup).toContain('bob-ab-invite__cta');
    expect(markup).toContain('bob-ab-return__cta');
    expect(markup).toContain('aria-hidden="true"');
    expect(example.moments.find((moment) => moment.id === 'rebook')?.ctaLabel).toBe('BOOK AGAIN');
    expect(example.moments.find((moment) => moment.id === 'review')?.ctaLabel).toBe(
      'Leave a Google Review',
    );
    const review = example.moments.find((moment) => moment.id === 'review')!;
    expect(review.display).not.toBe(review.ctaLabel);
    expect(review.display).not.toBe(review.reviewPreview?.heading);
    expect(markup).not.toContain('PLANNED FOR FULL KERSIVO · ILLUSTRATIVE EXPERIENCE');
  });

  it('bans live automation claims and keeps planned CTAs non-interactive', () => {
    const example = buildAfterBookingExample();
    const lower = [
      example.conceptStatus,
      example.disclosure,
      ...example.moments.flatMap((moment) => [
        moment.display,
        moment.support ?? '',
        moment.stageLabel ?? '',
        moment.ctaLabel ?? '',
        moment.thanksPreview?.message ?? '',
        moment.reviewPreview?.heading ?? '',
        moment.reviewPreview?.body ?? '',
        moment.reviewPreview?.ctaLabel ?? '',
        moment.rebookPreview?.heading ?? '',
        moment.rebookPreview?.ctaLabel ?? '',
      ]),
      textOf(markup),
    ]
      .join(' ')
      .toLowerCase();
    for (const banned of AFTER_BOOKING_BANNED_CLAIMS) {
      expect(lower).not.toContain(banned);
    }
    expect(markup).not.toMatch(/href=.*(Leave a Google Review|BOOK AGAIN|Book Again)/);
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
    expect(css).toContain('border-radius: 0.75rem');
    expect(entryCss).toContain('.bob-ep');
    expect(entryComponent).toContain('bob-ep-source__visual');
    expect(helper).toContain('decodeHtmlEntities');
  });
});
