import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blacklineAdminHref } from '@/lib/admin/demoConfig';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const component = read('components/barbershop-online-booking/OnlineBookingAvailability.astro');
const sync = read('components/barbershop-online-booking/OnlineBookingAvailabilitySync.tsx');
const preview = read('components/barbershop-online-booking/OnlineBookingTimelinePreview.tsx');
const css = read('styles/components/barbershop-online-booking-availability.css');
const timelineCss = read('styles/components/barbershop-online-booking-timeline.css');

const [, frontmatter, ...rest] = component.split(/^---$/m);
const markup = rest.join('---');
const textOf = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Barbershop online booking page — Section 03 client times and the real admin timeline', () => {
  it('renders directly after Section 02 with one H2 and its H3s', () => {
    const journey = page.indexOf('<OnlineBookingJourney />');
    const section = page.indexOf('<OnlineBookingAvailability />');
    expect(journey).toBeGreaterThan(-1);
    expect(section).toBeGreaterThan(journey);
    expect(page.slice(journey, section).replace('<OnlineBookingJourney />', '').trim()).toBe('');

    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain(
      `<h2 id="boa-title" class="boa__title">The Time Clients Choose Comes From Your Shop's Diary</h2>`,
    );
    expect(`${markup}\n${sync}`).not.toMatch(/<h1\b|<h4\b|<h5\b|<h6\b/);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(2);
    expect(sync).toContain('>Client view</h3>');
    expect(sync).toContain('>Owner view</h3>');
    expect(markup).toContain('>Where confirmed bookings land</h3>');
    expect(frontmatter.match(/^ {4}title: '([^']+)',$/gm)).toEqual([
      "    title: 'Working hours',",
      "    title: 'Service length',",
      "    title: 'Existing appointments',",
    ]);
    expect(textOf(markup)).toContain(
      "Clients should only be offered times that match your barbers' availability, their services and the appointments already in the diary. The owner needs to see where each confirmed booking lands.",
    );
  });

  it('pairs the client times with the real TodayTimeline in one deferred island', () => {
    expect(frontmatter).toContain(
      "import OnlineBookingAvailabilitySync from '@/components/barbershop-online-booking/OnlineBookingAvailabilitySync';",
    );
    expect(markup).toContain("<OnlineBookingAvailabilitySync\n        client:visible={{ rootMargin: '200px' }}");
    expect(markup.match(/client:/g) ?? []).toHaveLength(1);
    expect(frontmatter).toContain('const times = offered.map(({ label, start, endLabel }) => ({ label, start, endLabel }));');
    expect(sync).toContain('<OnlineBookingTimelinePreview');
    expect(sync).toContain('aria-pressed={time.label === selected.label}');
    expect(preview).toContain("import TodayTimeline from '@/components/admin/TodayTimeline';");
    expect(preview).toContain("from '@/lib/barbershopOnlineBooking/availabilityTimeline'");
    expect(preview).toContain("from '@/lib/barbershopOnlineBooking/timelineFocus'");
    expect(preview).toContain("from '@/lib/landing/liveTimelineScroll'");
    expect(preview).toContain("import '@/styles/components/insideSystemLiveWidget.css';");
    expect(preview).toMatch(/className=\{`isw bot/);
  });

  it('keeps the preview read-only with the proven admin demo safeguards', () => {
    expect(preview).toContain('setPublicAdminDemoMode(true);');
    expect(preview).toContain('installAdminFetchInterceptor();');
    expect(preview).toContain('previewSwipe={!isPassive}');
    expect(preview).toContain('onBookingClick={openLock}');
    expect(preview).toContain('onClientProfileIntercept={openLock}');
    expect(preview).toContain('allowInitialNowScroll={false}');
    expect(preview).toContain('inert: true');
    expect(`${preview}\n${sync}`).not.toMatch(/fetch\(|scrollIntoView|window\.scrollTo/);
    expect(timelineCss).toMatch(/\.bot--passive \.admin-vtl-scroll \{[^}]*overflow: hidden;/);
    expect(timelineCss).toMatch(/\.bot-marker \{[^}]*pointer-events: none;/);
  });

  it('removes the rejected editorial recreation', () => {
    expect(existsSync(join(srcDir, 'lib/barbershopOnlineBooking/availabilityHighlight.ts'))).toBe(false);
    expect(`${component}\n${css}`).not.toMatch(/boa-lane|boa-fit|boa-gap|boa-offer|boa-diary|boa-product|<script\b/);
    expect(textOf(markup)).not.toMatch(/Editorial recreation|would fit here/);
  });

  it('labels the demo data and never implies that choosing a time books it', () => {
    const text = textOf(markup);
    expect(text).toContain(
      'Real KERSIVO admin interface with fictional {DEMO_SHOP_NAME} demo appointments for an example weekday.',
    );
    expect(text).toContain("choosing one only moves the view and doesn't create a booking.");
    expect(text).toContain('When a real booking is confirmed, it is saved as Booked in your shop');
    expect(sync).toContain('Nothing has been booked.');
    const lower = `${text}\n${textOf(sync)}`.toLowerCase();
    for (const banned of [
      'real-time',
      'real time',
      'guarantee',
      'never double',
      'double-book',
      'waitlist',
      'walk-in',
      'buffer',
      'no-show',
      'instantly',
      'just booked',
      'your booking appears',
      'confirmed!',
    ]) {
      expect(lower).not.toContain(banned);
    }
    expect(text.toLowerCase()).not.toContain('sync');
  });

  it('has one tracked CTA to the demo owner timeline and no forms or frames', () => {
    const anchors = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain('href={OWNER_TIMELINE_HREF}');
    expect(anchors[0]).toContain('data-track={TRACK_EVENT}');
    expect(anchors[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(frontmatter).toContain("const OWNER_TIMELINE_HREF = blacklineAdminHref('bookings_dashboard');");
    expect(blacklineAdminHref('bookings_dashboard')).toBe('/demo/admin?section=bookings_dashboard');
    expect(frontmatter).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(frontmatter).toContain("const TRACK_PLACEMENT = 'barbershop_online_booking_availability';");
    expect(`${component}\n${sync}\n${preview}`).not.toMatch(/<form\b|<iframe\b/);
    expect(sync).toMatch(/<img className="boa-client__avatar"[^>]*alt=""[^>]*width=\{160\} height=\{160\} loading="lazy" decoding="async"/);
  });

  it('keeps a fixed timeline window, tappable times, visible focus and motion only when allowed', () => {
    expect(timelineCss).toMatch(/\.isw\.bot \.admin-vtl-scroll \{[^}]*height: var\(--bot-window\);/);
    expect(css).toMatch(/\.boa-time \{[^}]*min-height: 2\.75rem;/);
    expect(css).toMatch(/\.boa-time:focus-visible \{[^}]*outline:/);
    expect(css).toMatch(/\.boa__cta:focus-visible \{[^}]*outline:/);
    expect(timelineCss).toMatch(/\.bot-lock__close:focus-visible,\s*\.bot-lock__cta:focus-visible \{[^}]*outline:/);
    expect(timelineCss).not.toMatch(/transition|animation/);
    const [beforeMotion, motionBlock = ''] = css.split('@media (prefers-reduced-motion: no-preference)');
    expect(beforeMotion).not.toMatch(/transition|animation/);
    expect(motionBlock).toContain('transition:');
  });
});
