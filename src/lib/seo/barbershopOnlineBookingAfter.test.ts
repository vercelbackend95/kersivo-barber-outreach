import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blacklineAdminHref } from '@/lib/admin/demoConfig';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingAfterBooking.astro');
const css = read('styles/components/barbershop-online-booking-after.css');
const entryCss = read('styles/components/barbershop-online-booking-entry.css');
const entryComponent = read('components/barbershop-online-booking/OnlineBookingEntryPoints.astro');

const [, frontmatter, ...rest] = component.split(/^---$/m);
const markup = rest.join('---');

describe('Barbershop online booking page — Section 06 confirmations and reminders', () => {
  it('renders directly after locked Section 05 with the approved H2 and lead', () => {
    const entry = page.indexOf('<OnlineBookingEntryPoints />');
    const after = page.indexOf('<OnlineBookingAfterBooking />');
    expect(entry).toBeGreaterThan(-1);
    expect(after).toBeGreaterThan(entry);
    expect(page.slice(entry, after).replace('<OnlineBookingEntryPoints />', '').trim()).toBe('');

    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain(
      '<h2 id="bob-ab-title" class="bob-ab__title">Booking confirmations and reminders</h2>',
    );
    expect(markup).toContain('After a booking');
    const visibleLead = markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    expect(visibleLead).toContain(
      "KERSIVO sends booking confirmation emails and appointment reminders. Clients can use the links in their confirmation email to request a change or cancellation, subject to your shop's policies. See what's included in each plan on the pricing page.",
    );
    expect(markup).toContain('<a href="/pricing#plan">pricing page</a>');
  });

  it('does not show planned post-visit concepts', () => {
    expect(markup).not.toContain('bob-ab-showcase');
    expect(markup).not.toMatch(/planned/i);
    expect(markup).not.toMatch(/concept/i);
    expect(component).not.toContain('buildAfterBookingExample');
    expect(css).not.toContain('bob-ab-showcase');
    expect(css).not.toContain('bob-ab-beat');
    expect(css).not.toContain('bob-ab-mail');
    expect(css).not.toContain('bob-ab-invite');
    expect(css).not.toContain('bob-ab-concept');
  });

  it('keeps one tracked admin demo CTA and leaves Section 05 files untouched', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(true);
    const anchors = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(anchors).toHaveLength(3);
    expect(anchors[0]).toContain('href="/pricing#plan"');
    expect(anchors[1]).toContain('href="/barbershop-cancellation-policy-template"');
    expect(anchors[2]).toContain('href={OWNER_TIMELINE_HREF}');
    expect(frontmatter).toContain("const OWNER_TIMELINE_HREF = blacklineAdminHref('bookings_dashboard');");
    expect(blacklineAdminHref('bookings_dashboard')).toBe('/demo/admin?section=bookings_dashboard');
    expect(frontmatter).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(component).not.toMatch(/<form\b|<iframe\b|client:/);
    expect(component).not.toMatch(/<script\b/);
    expect(css).toMatch(/\.bob-ab__cta:focus-visible \{[^}]*outline:/);
    expect(css).toContain('border-radius: 0.75rem');
    expect(entryCss).toContain('.bob-ep');
    expect(entryComponent).toContain('bob-ep-source__visual');
  });
});
