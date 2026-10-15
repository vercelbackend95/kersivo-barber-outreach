import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blacklineAdminHref } from '@/lib/admin/demoConfig';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { SMS_INCLUDED_WITH_ALLOWANCE_CLAIM } from '@/lib/pricing/claimsPolicy';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingAfterBooking.astro');
const helper = read('lib/barbershopOnlineBooking/afterBookingExample.ts');
const css = read('styles/components/barbershop-online-booking-after.css');

const [, frontmatter, ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const source = `${frontmatter}\n${markup}`;
const textOf = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Barbershop online booking page — Section 06 after booking', () => {
  it('renders directly after Section 05 entry points with one H2 and Part A / Part B H3s', () => {
    const entry = page.indexOf('<OnlineBookingEntryPoints />');
    const after = page.indexOf('<OnlineBookingAfterBooking />');
    expect(entry).toBeGreaterThan(-1);
    expect(after).toBeGreaterThan(entry);
    expect(page.slice(entry, after).replace('<OnlineBookingEntryPoints />', '').trim()).toBe('');
    expect(page).toContain(
      "import OnlineBookingAfterBooking from '@/components/barbershop-online-booking/OnlineBookingAfterBooking.astro';",
    );

    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('<h2 id="bob-ab-title" class="bob-ab__title">What Happens After a Booking?</h2>');
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(2);
    expect(markup).toContain('>Keep the appointment organised</h3>');
    expect(markup).toContain('>Keep the relationship going</h3>');
    expect(markup).not.toMatch(/<h1\b|<h5\b|<h6\b/);
  });

  it('keeps Part A tied to live email builders and shows confirmation plus reminder', () => {
    expect(frontmatter).toContain("import { buildAfterBookingExample } from '@/lib/barbershopOnlineBooking/afterBookingExample';");
    expect(helper).toContain('buildInstantBookingConfirmationEmail');
    expect(helper).toContain('buildAppointmentReminderEmail');
    expect(textOf(markup)).toContain('Live today');
    expect(source).toContain('confirmed bookings send a confirmation email');
    expect(source).toContain('email reminder about a day before');
    expect(source).toContain('Bookings made too close to the appointment do not get that day-before');
  });

  it('labels Part B as concept-only Full product direction', () => {
    expect(textOf(markup)).toContain('Concept');
    expect(source).toContain('Product direction for Full KERSIVO — not available in the live product yet.');
    expect(source).toContain('These examples are illustrative only.');
    expect(helper).toContain('AFTER_BOOKING_CONCEPTS');
    expect(css).toContain('bob-ab-part--concept');
  });

  it('does not present unimplemented retention as live product behaviour', () => {
    const lower = textOf(source).toLowerCase();
    for (const banned of [
      'automatically sends',
      'kersivo automatically',
      'will automatically',
      'thank-you email is sent',
      'sends a thank-you',
      'google review request is sent',
      'rebooking campaign',
      'marketing crm on starter',
      'included with starter',
      'unsubscribe centre',
      'soft opt-in',
    ]) {
      expect(lower).not.toContain(banned);
    }
    expect(lower).not.toMatch(/guaranteed (review|ranking|return)/);
  });

  it('mentions Full SMS only with the approved allowance claim and no published counts', () => {
    expect(frontmatter).toContain('SMS_INCLUDED_WITH_ALLOWANCE_CLAIM');
    expect(SMS_INCLUDED_WITH_ALLOWANCE_CLAIM).toContain('monthly SMS allowance');
    expect(source).toContain('Starter uses email reminders, not SMS.');
    expect(textOf(source).toLowerCase()).not.toMatch(/£\d+\s*(sms|text)|unlimited sms|\d+\s*sms/);
  });

  it('keeps the page unpublished for indexing and uses one tracked admin demo CTA', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(false);
    const anchors = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain('href={OWNER_TIMELINE_HREF}');
    expect(anchors[0]).toContain('data-track={TRACK_EVENT}');
    expect(anchors[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(frontmatter).toContain("const OWNER_TIMELINE_HREF = blacklineAdminHref('bookings_dashboard');");
    expect(blacklineAdminHref('bookings_dashboard')).toBe('/demo/admin?section=bookings_dashboard');
    expect(frontmatter).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(frontmatter).toContain("const TRACK_PLACEMENT = 'barbershop_online_booking_after';");
    expect(markup).toContain('Explore the admin demo');
  });

  it('stays static, accessible, and free of fake delivery chrome', () => {
    expect(component).not.toMatch(/<script\b|<form\b|<iframe\b|client:/);
    expect(markup).toContain('aria-labelledby="bob-ab-title"');
    expect(css).toMatch(/\.bob-ab__cta:focus-visible \{[^}]*outline:/);
    expect(textOf(markup)).toContain('A booking is not marketing consent');
    expect(textOf(markup)).toContain('nothing on this page sends a message');
  });
});
