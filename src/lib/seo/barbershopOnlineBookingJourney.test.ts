import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { BLACKLINE_BOOKING_PRESENTATION } from '@/lib/demo/booking';
import { DEMO_SERVICE_CATEGORIES } from '@/lib/demo/serviceCategories';
import { DEMO_DEFAULT_SERVICE_SLUG, DEMO_SERVICES } from '@/lib/demo/services';
import { BARBERSHOP_ONLINE_BOOKING_DEMO_HREF } from './barbershopOnlineBookingPage';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const publicDir = join(srcDir, '../public');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const journey = read('components/barbershop-online-booking/OnlineBookingJourney.astro');
const css = read('styles/components/barbershop-online-booking-journey.css');
const flow = read('components/booking/BookingFlow.tsx');

const markup = journey.split(/^---$/m).slice(2).join('---');
const textOf = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const anchors = markup.match(/<a\b[\s\S]*?>/g) ?? [];
const mediaBlock = (query: string) => {
  const start = css.indexOf(`@media ${query}`);
  const next = css.indexOf('\n@media', start + 1);
  return start < 0 ? '' : css.slice(start, next < 0 ? undefined : next);
};

describe('Barbershop online booking page — Section 02 client booking journey', () => {
  it('renders directly after the Hero with one H2 and five stage H3s', () => {
    const hero = page.indexOf('<OnlineBookingHero />');
    const section = page.indexOf('<OnlineBookingJourney />');
    expect(hero).toBeGreaterThan(-1);
    expect(section).toBeGreaterThan(hero);
    expect(page.slice(hero, section).replace('<OnlineBookingHero />', '').trim()).toBe('');

    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).not.toMatch(/<h1\b|<h4\b|<h5\b|<h6\b/);
    expect(markup).toContain('<h2 id="boj-title" class="boj__title">From Book Now to a Confirmed Appointment</h2>');
    expect(markup).toContain('<section class="boj" aria-labelledby="boj-title" data-boj>');
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('<h3 id={`${stage.id}-title`} class="boj-stage__title">{stage.title}</h3>');
    const titles = [...journey.matchAll(/^ {4}title: '([^']+)',$/gm)].map((match) => match[1]);
    expect(titles).toEqual([
      'Choose the service',
      'Choose the barber',
      'Choose an available time',
      'Add details and the payment step',
      'See the booking confirmation',
    ]);
  });

  it('keeps the approved working answer', () => {
    expect(textOf(markup)).toContain(
      'Follow the booking journey from choosing a service to confirmation. Each step shows what the client sees and what it means for your shop.',
    );
  });

  it('mirrors the real BookingFlow step labels and copy', () => {
    expect(flow).toContain("[{ label: 'Service' }, { label: 'Barber' }, { label: 'Schedule' }, { label: 'Details' }]");
    expect(journey).toContain("const FLOW_STEPS = ['Service', 'Barber', 'Schedule', 'Details'] as const;");
    for (const line of [
      "service: { title: 'Choose a service', hint: 'Pick what you need' }",
      "barber: { title: 'Choose a barber', hint: 'Who should take you' }",
      "schedule: { title: 'Pick a time', hint: 'Date and available slots' }",
    ]) {
      expect(flow).toContain(line);
      expect(journey).toContain(line);
    }
    expect(flow).toMatch(/PUBLIC_DEMO_DETAILS_COPY = \{\s*title: 'Your details',\s*hint: 'Demo only — details stay in this browser'/);
    expect(journey).toContain("details: { title: 'Your details', hint: 'Demo only — details stay in this browser' }");
    expect(flow).toContain("helper\">Fastest available</span>");
    expect(journey).toContain("const ANY_BARBER = { name: 'Any barber', initials: 'ANY', helper: 'Fastest available' };");
    for (const placeholder of ['Your full name', 'you@email.com', 'Mobile number']) {
      expect(flow).toContain(`placeholder="${placeholder}"`);
      expect(markup).toContain(`>${placeholder}</span>`);
    }
    expect(flow).toContain('<span>Phone <em>(optional)</em></span>');
    expect(markup).toContain('Phone <em>(optional)</em>');
    expect(flow).toContain("if (publicDemoMode) return 'Complete demo booking';");
    expect(markup).toContain("'Complete demo booking'");
    for (const item of ['No real appointment will be created', 'No confirmation email will be sent', 'Times shown follow the Cutstate owner timeline']) {
      expect(flow).toContain(`{ label: '${item}' }`);
      expect(journey).toContain(`'${item}'`);
    }
  });

  it('uses verified demo services, barbers and confirmation copy', () => {
    expect(journey).toContain('DEMO_SERVICES.filter((service) => service.category === firstCategory.key)');
    expect(DEMO_SERVICE_CATEGORIES[0].label).toBe('Cuts & Fades');
    expect(DEMO_SERVICES.filter((s) => s.category === 'cuts & fades').length).toBeGreaterThanOrEqual(4);
    expect(DEMO_DEFAULT_SERVICE_SLUG).toBe('skin-fade');
    expect(DEMO_BARBERS.map((b) => b.name)).toEqual(['Ellis Ward', 'Noah Reid', 'Marcus Bell']);
    expect(journey).toContain("const SELECTED_BARBER_SLUG = 'marcus-bell';");
    for (const barber of DEMO_BARBERS) {
      expect(existsSync(join(publicDir, `demo/barbers/thumbs/${barber.slug}-160.webp`))).toBe(true);
    }
    expect(BLACKLINE_BOOKING_PRESENTATION.confirmEyebrow).toBe('Demo complete');
    expect(BLACKLINE_BOOKING_PRESENTATION.confirmHeading).toBe("You're all set");
    expect(BLACKLINE_BOOKING_PRESENTATION.confirmBody).toBe('Demo only — no appointment or email was created.');
    expect(markup).toContain('{presentation.confirmHeading}');
    expect(markup).toContain('{presentation.confirmBody}');
    expect(markup).toContain('{presentation.sandboxNote}');
  });

  it('labels times as illustrative examples from the product sandbox slots, with no date', () => {
    const sandbox = flow.slice(flow.indexOf('const PREVIEW_STATIC_SLOTS'), flow.indexOf('] as const;', flow.indexOf('const PREVIEW_STATIC_SLOTS')));
    const slots = [...(journey.match(/const EXAMPLE_SLOTS = \[([^\]]+)\] as const;/)?.[1].matchAll(/'(\d{2}:\d{2})'/g) ?? [])].map((m) => m[1]);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) expect(sandbox).toContain(`'${slot}'`);
    expect(markup).toContain('Illustrative example times');
    expect(journey).toContain("const EXAMPLE_DAY = 'Example day';");
    expect(textOf(markup)).not.toMatch(
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
    );
  });

  it('shows the Starter and Full payment steps as labelled live-page examples', () => {
    expect(flow).toContain('<strong>Pay £5 deposit</strong>');
    expect(flow).toContain('<strong>Pay in full</strong>');
    expect(flow).toContain('now · nothing to pay at the shop</small>');
    expect(flow).toContain('0% KERSIVO commission. Stripe processing fees apply.');
    expect(markup).toContain('<span class="boj-live__tag">On a live KERSIVO Starter booking page</span>');
    expect(markup).toContain('<span class="boj-live__name">Pay £5 deposit</span>');
    expect(markup).toContain('<span class="boj-live__name">Pay in full</span>');
    expect(markup).toContain('0% KERSIVO commission. Stripe processing fees apply.');
    expect(journey).toContain('The fictional demo takes no payment.');
    expect(markup).toContain('<span class="boj-live__tag">On a live Full KERSIVO booking page</span>');
    expect(markup).toContain('Payment · the client chooses');
    expect(markup).toContain('Payment · the shop sets one rule');
    expect(journey).toContain("{ name: 'Pay at shop', sub: `Nothing online · ${servicePrice} at the shop` }");
    expect(journey).toContain('on Full KERSIVO, the shop decides whether clients pay at the shop, pay a £5 deposit or pay in full.');
    expect(journey).not.toMatch(/full upfront|upfront payment|require £5|pay at shop on starter/i);
  });

  it('never presents the demo as a real booking, charge or result', () => {
    expect(journey).not.toMatch(/no-show|real-time|guarantee|testimonial|rating|secure payment|\d+\+?\s*(shops|customers|bookings)/i);
    expect(journey).not.toMatch(/payment (taken|received|successful)|paid successfully|BL-\d/i);
    const live = journey.match(/Booking confirmed/g) ?? [];
    expect(live).toHaveLength(1);
    expect(journey).toContain('On a live booking page clients see “Booking confirmed”');
    expect(textOf(markup)).toContain(
      'Cutstate is a fictional KERSIVO demonstration shop; times are examples, no appointment is created and no payment is taken.',
    );
  });

  it('has one tracked demo CTA and no other links', () => {
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain('href={BARBERSHOP_ONLINE_BOOKING_DEMO_HREF}');
    expect(anchors[0]).toContain('data-track={TRACK_EVENT}');
    expect(anchors[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(BARBERSHOP_ONLINE_BOOKING_DEMO_HREF).toBe('/demo/book');
    expect(journey).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(journey).toContain("const TRACK_PLACEMENT = 'barbershop_online_booking_journey';");
    expect(markup).toContain('Explore the full booking demo');
    expect(markup.match(/data-track=/g) ?? []).toHaveLength(1);
  });

  it('drives one shared stage from the step selector, the rail and Previous / Next', () => {
    const tabs = [...journey.matchAll(/^ {4}tab: '([^']+)',$/gm)].map((match) => match[1]);
    expect(tabs).toEqual(['Service', 'Barber', 'Time', 'Details', 'Confirm']);
    expect(markup).toContain('<div class="boj__tabs" role="group" aria-label="Booking journey steps" data-boj-group data-boj-anchor>');
    expect(markup).toContain('<ol class="boj__rail" data-boj-group>');
    expect(markup.match(/data-boj-select=\{index\}/g) ?? []).toHaveLength(2);
    expect(markup.match(/aria-controls=\{`\$\{stage\.id\}-panel`\}/g) ?? []).toHaveLength(2);
    expect(markup).toContain('<span class="sr-only">Step {index + 1} of {stages.length}:</span>');
    expect(markup).toContain('data-boj-step="-1"');
    expect(markup).toContain('data-boj-step="1"');
    expect(markup).toContain('Previous<span class="sr-only"> step</span>');
    expect(markup).toContain('Next<span class="sr-only"> step</span>');
    expect(markup.match(/\bid=/g) ?? []).toHaveLength(3);

    // Below 64rem only the selector, the active stage and the pager show; from 64rem only the rail.
    expect(css).toMatch(/\.boj-stage:not\(\.is-active\) \{\s*display: none;/);
    expect(css).toMatch(/\.boj-stage__select \{\s*display: none;/);
    const desktop = mediaBlock('(min-width: 64rem)');
    expect(desktop).toMatch(/\.boj__tabs,\s*\.boj__pager \{\s*display: none;/);
    expect(desktop).toMatch(/\.boj-stage__select \{\s*display: block;/);
    expect(css).toMatch(/\.boj-tab \{[^}]*min-height: 3\.25rem;/);
    expect(css).toMatch(/\.boj-pager__btn \{[^}]*min-height: 2\.75rem;/);
  });

  it('sizes each preview to its stage, with a modest desktop floor', () => {
    expect(css).toMatch(/\.boj-panel:not\(\.is-active\) \{\s*display: none;/);
    expect(css).not.toMatch(/grid-area: 1 \/ 1/);
    expect(mediaBlock('(min-width: 64rem)')).toMatch(/\.boj-panel \{\s*min-height: 30rem;/);
    expect(css.match(/position: sticky/g) ?? []).toHaveLength(1);
    expect(mediaBlock('(min-width: 64rem) and (min-height: 52rem)')).toMatch(/\.boj__showcase \{\s*position: sticky;/);
  });

  it('keeps the showcase non-interactive and the selector accessible', () => {
    expect(markup).not.toMatch(/<form\b|<input\b|<select\b|<textarea\b|<iframe|<picture\b|client:/);
    expect(markup.match(/<button\b/g) ?? []).toHaveLength(4);
    expect(markup.match(/type="button"/g) ?? []).toHaveLength(4);
    expect(markup).toContain('aria-controls={`${stage.id}-panel`}');
    expect(markup).toContain("aria-pressed={index === 0 ? 'true' : 'false'}");
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-labelledby={`${stage.id}-title`}');
    expect(markup).toContain('<div class="boj-screen" aria-hidden="true">');
    expect(markup).toContain('<p class="sr-only" aria-live="polite" data-boj-status></p>');
    expect(markup).toContain('<p class="sr-only">{stage.summary}</p>');
    expect(markup).toMatch(/<img src=\{barber\.thumb\} alt="" width=\{THUMB_SIZE\} height=\{THUMB_SIZE\} loading="lazy" decoding="async" \/>/);
    const scripts = markup.match(/<script>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain("import { bindBookingJourney } from '@/lib/barbershopOnlineBooking/journeyStages';");
    expect(scripts[0]).toContain("document.addEventListener('astro:page-load', () => bindBookingJourney());");
  });

  it('shows every stage without JavaScript', () => {
    const noscript = markup.slice(markup.indexOf('<noscript>'), markup.indexOf('</noscript>'));
    expect(noscript).toContain('<style is:inline>');
    expect(noscript).toContain('.boj-panel:not(.is-active) { display: flex !important; }');
    expect(noscript).toContain('.boj-stage:not(.is-active) { display: grid !important; }');
    expect(noscript).toContain('.boj-stage__select, .boj__tabs, .boj__pager { display: none !important; }');
  });

  it('keeps focus visible, the CTA touch-sized and motion behind reduced-motion', () => {
    expect(css).toMatch(/\.boj-stage__select:focus-visible \{\s*outline: 2px solid var\(--focus\);/);
    expect(css).toMatch(/\.boj__cta:focus-visible \{\s*outline: 2px solid var\(--focus\);/);
    expect(css).toMatch(/\.boj-tab:focus-visible \{\s*outline: 2px solid var\(--focus\);/);
    expect(css).toMatch(/\.boj-pager__btn:focus-visible \{\s*outline: 2px solid var\(--focus\);/);
    expect(css).toMatch(/\.boj__cta \{[^}]*min-height: 3rem;/);
    const motionStart = css.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(motionStart).toBeGreaterThan(-1);
    expect(css.slice(0, motionStart)).not.toMatch(/\b(transition|animation)\s*:/);
    expect(mediaBlock('(min-width: 64rem)')).toMatch(/\.boj__body \{\s*grid-template-columns: minmax\(0, 0\.36fr\) minmax\(0, 0\.64fr\);/);
  });
});
