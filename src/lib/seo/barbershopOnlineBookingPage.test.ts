import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';
import { getKersivoOrganizationId, getKersivoWebsiteId } from './kersivoEntityJsonLd';
import {
  BARBERSHOP_ONLINE_BOOKING_DEMO_HREF,
  BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF,
  BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION,
  BARBERSHOP_ONLINE_BOOKING_PAGE_H1,
  BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE,
  BARBERSHOP_ONLINE_BOOKING_PAGE_PATH,
  BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE,
  buildBarbershopOnlineBookingJsonLd,
} from './barbershopOnlineBookingPage';
import { CUTSTATE_LOGO_SRC } from '@/components/demo/BlacklineWordmark';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { getDemoFeaturedServices } from '@/lib/demo/services';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const publicDir = join(srcDir, '../public');
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const pagePath = '../../pages/barbershop-online-booking/index.astro';
const componentDir = '../../components/barbershop-online-booking/';
const page = read(pagePath);
const hero = read(`${componentDir}OnlineBookingHero.astro`);
const preview = read(`${componentDir}OnlineBookingHeroPreview.astro`);
const heroCss = read('../../styles/components/barbershop-online-booking-hero.css');
const layout = read('../../layouts/LandingLayout.astro');
const flow = readFileSync(join(srcDir, 'components/booking/BookingFlow.tsx'), 'utf8');

const markupOf = (source: string) => source.split(/^---$/m).slice(2).join('---');
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const anchors = (source: string) => source.match(/<a\b[\s\S]*?>/g) ?? [];
const heroMarkup = markupOf(hero);
const previewMarkup = markupOf(preview);
const cssRule = (selector: string, source = heroCss) => {
  const start = source.indexOf(`\n${selector} {`);
  return start < 0 ? '' : source.slice(start, source.indexOf('}', start));
};
const mediaBlock = (query: string) => {
  const start = heroCss.indexOf(`@media ${query}`);
  const next = heroCss.indexOf('\n@media', start + 1);
  return start < 0 ? '' : heroCss.slice(start, next < 0 ? undefined : next);
};

describe('/barbershop-online-booking Section 01 hero', () => {
  it('exists as its own route with the working MASTER v1.1 metadata and canonical URL', () => {
    expect(existsSync(join(here, pagePath))).toBe(true);
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH).toBe('/barbershop-online-booking');
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE).toBe('Barbershop Online Booking: How It Works | KERSIVO');
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION).toBe(
      'See how barbershop online booking works — from choosing a barber and available time to payments, confirmations and the shop diary. Explore KERSIVO.',
    );
    expect(resolveCanonicalUrl(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH)).toBe(
      'https://kersivo.co.uk/barbershop-online-booking',
    );
    expect(page).toContain('canonicalPath={BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}');
    expect(page).toContain('title={BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE}');
    expect(page).toContain('description={BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION}');
  });

  it('renders in an en-GB document', () => {
    expect(page).toContain("import LandingLayout from '@/layouts/LandingLayout.astro'");
    expect(layout).toContain('<html lang="en-GB"');
    expect(buildBarbershopOnlineBookingJsonLd().inLanguage).toBe('en-GB');
  });

  it('stays noindex, follow and out of the marketing sitemap during development', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(false);
    expect(page).toContain('noindex={!BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).not.toContain('https://kersivo.co.uk/barbershop-online-booking');
  });

  it('renders Section 01 with exactly one H1 split into the approved two lines', () => {
    expect((`${page}\n${hero}\n${preview}`.match(/<h1\b/g) ?? [])).toHaveLength(1);
    expect(`${hero}\n${preview}`).not.toMatch(/<h[2-6]\b/);
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_H1).toBe('See How Online Booking Works for Your Barbershop');
    expect(hero).toContain("BARBERSHOP_ONLINE_BOOKING_PAGE_H1.indexOf(' Works ')");
    expect(hero).toContain("const ACCENT_WORDS = 'Your Barbershop';");
    expect((hero.match(/class="bob-hero__accent"/g) ?? [])).toHaveLength(1);
    expect(cssRule('.bob-hero__accent')).toContain('color: var(--bob-red-text);');
    expect(mediaBlock('(min-width: 48rem)')).toMatch(/\.bob-hero__title-line \{\s*display: block;/);
    expect(readdirSync(join(here, componentDir)).sort()).toEqual([
      'OnlineBookingAfterBooking.astro',
      'OnlineBookingAvailability.astro',
      'OnlineBookingAvailabilitySync.test.tsx',
      'OnlineBookingAvailabilitySync.tsx',
      'OnlineBookingEntryPoints.astro',
      'OnlineBookingHero.astro',
      'OnlineBookingHeroPreview.astro',
      'OnlineBookingJourney.astro',
      'OnlineBookingPayments.astro',
      'OnlineBookingPlanChoice.astro',
      'OnlineBookingTimelinePreview.test.tsx',
      'OnlineBookingTimelinePreview.tsx',
    ]);
    expect(page).toContain('<OnlineBookingPlanChoice />');
    expect(BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF).toBe('#booking-options');
  });

  it('orders eyebrow, H1, lead, CTAs, pricing, product stage and bottom strip', () => {
    const order = [
      '<nav class="bob-hero__breadcrumb" aria-label="Breadcrumb">',
      '<p class="bob-hero__eyebrow">Online booking for UK barbershops</p>',
      '<h1 id="bob-hero-title" class="bob-hero__title">',
      '<p class="bob-hero__lead">',
      '<div class="bob-hero__actions">',
      '<div class="bob-hero__terms">',
      '<OnlineBookingHeroPreview />',
      '<ul class="bob-strip">',
    ].map((marker) => hero.indexOf(marker));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(cssRule('.bob-hero__eyebrow')).toContain('text-transform: uppercase;');
    expect(cssRule('.bob-hero__head')).toContain('text-align: center;');
    expect(hero).toContain('<li><a href="/">Home</a></li>');
    expect(hero).toContain('<li><span aria-current="page">Online booking</span></li>');
  });

  it('keeps the verified lead instead of unsupported growth copy', () => {
    const lead = textOf(heroMarkup.slice(heroMarkup.indexOf('<p class="bob-hero__lead">')));
    expect(lead).toContain(
      "Clients choose a service, a barber and an available time — and the appointment lands in your shop's booking system. Start with a KERSIVO-hosted booking page, or bring bookings onto your own branded website with Full KERSIVO.",
    );
    expect(textOf(heroMarkup)).not.toMatch(/fill your chairs|faster, easier/i);
  });

  it('sends the primary action to the verified demo with the existing demo-click event', () => {
    const demo = anchors(hero).find((tag) => tag.includes('href={BARBERSHOP_ONLINE_BOOKING_DEMO_HREF}'));
    expect(BARBERSHOP_ONLINE_BOOKING_DEMO_HREF).toBe('/demo/book');
    expect(existsSync(join(srcDir, 'pages/demo/book.astro'))).toBe(true);
    expect(demo).toContain('bob-hero__action--primary');
    expect(demo).toContain('data-track={TRACK_EVENT}');
    expect(demo).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(hero).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(hero).toContain("const TRACK_PLACEMENT = 'barbershop_online_booking_hero_demo';");
    expect(hero).toContain('See the booking demo');
    expect(hero).toContain('<span class="bob-hero__action-icon" set:html={svg(ICONS.arrowRight)} />');
  });

  it('sends the secondary action to the in-page plan choice anchor, untracked and not as a signup', () => {
    const compare = anchors(hero).find((tag) => tag.includes('href={BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF}'));
    expect(BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF).toBe('#booking-options');
    expect(compare).toContain('bob-hero__action--secondary');
    expect(compare).not.toContain('data-track');
    expect(hero).toContain('Compare your booking options');
    expect(anchors(hero)).toHaveLength(3);
  });

  it('links the stage disclosure to the live demo with its own placement', () => {
    const links = anchors(preview);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href={BARBERSHOP_ONLINE_BOOKING_DEMO_HREF}');
    expect(links[0]).toContain('data-track={TRACK_EVENT}');
    expect(links[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(preview).toContain(`const TRACK_EVENT = '${FUNNEL_EVENTS.view_live_demo_click}';`);
    expect(preview).toContain("const TRACK_PLACEMENT = 'barbershop_online_booking_hero_preview';");
    expect(previewMarkup).toContain('>Try it live</a>');
  });

  it('never labels an exploratory Hero click as a signup, checkout or subscription', () => {
    for (const source of [hero, preview]) {
      for (const event of ['starter_signup_click', 'checkout_started', 'checkout_completed', 'saas_subscribe_click']) {
        expect(source).not.toContain(event);
      }
      expect(source).not.toMatch(/href="\/admin/);
    }
    expect(page).not.toContain('checkout_started');
    expect(page).not.toContain('checkout_completed');
    expect(page).not.toContain('saas_subscribe_click');
  });

  it('states the commercial terms with the Stripe processing-fee qualifier', () => {
    expect(hero).toContain(
      "const terms = ['KERSIVO Starter £0/month', 'Full £39/month per location', '0% KERSIVO commission'];",
    );
    expect(heroMarkup).toContain('<p class="bob-hero__fees">Stripe processing fees apply to card payments.</p>');
  });

  it('uses the owner-approved callout and strip wording', () => {
    for (const [title, body] of [
      ['Choose a service', "From your shop's service menu."],
      ['Pick a barber', 'Let clients choose their preferred available barber.'],
      ['Available times', "Based on your shop's configured availability."],
      ['Next: Details & confirmation', 'Client details and booking confirmation.'],
    ]) {
      expect(preview).toContain(`title: '${title}'`);
      expect(preview).toContain(body.includes("'") ? `body: "${body}"` : `body: '${body}'`);
    }
    for (const [title, body] of [
      ['Book from anywhere', 'Open the booking page from a shared link.'],
      ['No customer app required', 'Book directly in the browser.'],
      ['Connected to your diary', "Confirmed bookings appear in the shop's system."],
      ['Built for UK barbershops', 'Designed for independent barber businesses.'],
    ]) {
      expect(hero).toContain(`title: '${title}'`);
      expect(hero).toContain(body.includes("'") ? `body: "${body}"` : `body: '${body}'`);
    }
  });

  it('keeps unsupported claims and unresolved Full payment modes out of the hero', () => {
    for (const raw of [hero, preview]) {
      const source = raw.replace(/OnlineBookingHeroPreview|PREVIEW_STATIC_SLOTS|hero_preview|preview mode/g, '');
      expect(source).not.toMatch(/fewer no-shows|no-show|real-time|secure payment|senior barber/i);
      expect(source).not.toMatch(/pay at shop|full upfront|upfront payment|deposit/i);
      expect(source).not.toMatch(/reserve with google|guarantee|testimonial|review|rating|\d+\+?\s*(shops|customers)/i);
      expect(textOf(markupOf(source))).not.toMatch(/blackline/i);
    }
  });

  it('recreates the CUTSTATE booking screen from verified demo data and BookingFlow copy', () => {
    expect(DEMO_SHOP_NAME).toBe('Cutstate Barbers');
    expect(CUTSTATE_LOGO_SRC).toBe('/demo/cutstate-logo.png');
    expect(existsSync(join(publicDir, CUTSTATE_LOGO_SRC))).toBe(true);
    expect(preview).toContain(
      "import { CUTSTATE_LOGO_ALT, CUTSTATE_LOGO_HEIGHT, CUTSTATE_LOGO_SRC, CUTSTATE_LOGO_WIDTH } from '@/components/demo/BlacklineWordmark';",
    );
    expect(preview).toContain(`headed by the \${CUTSTATE_LOGO_ALT} logo.`);
    expect(previewMarkup).not.toMatch(/bob-screen__brand|>\s*Cutstate\s*</i);
    expect(previewMarkup).not.toMatch(/>\s*KERSIVO\s*</);
    expect(cssRule('.bob-screen__logo')).toMatch(/width: auto;\s*height: 2\.9em;/);

    expect(flow).toContain("[{ label: 'Service' }, { label: 'Barber' }, { label: 'Schedule' }, { label: 'Details' }]");
    expect(preview).toContain("const STEPS = ['Service', 'Barber', 'Schedule', 'Details'] as const;");
    expect(preview).not.toMatch(/'Time'/);

    expect(flow).toContain("service: { title: 'Choose a service', hint: 'Pick what you need' }");
    expect(flow).toContain("barber: { title: 'Choose a barber', hint: 'Who should take you' }");
    expect(flow).toContain("schedule: { title: 'Pick a time'");
    expect(preview).toContain("const SERVICE_STEP = { title: 'Choose a service', hint: 'Pick what you need' };");
    expect(preview).toContain("const BARBER_STEP = { title: 'Choose a barber', hint: 'Who should take you' };");
    expect(preview).toContain("const TIME_STEP_TITLE = 'Pick a time';");

    expect(preview).toContain('getDemoFeaturedServices()');
    expect(getDemoFeaturedServices().map((s) => [s.name, s.durationMinutes, s.pricePence])).toEqual([
      ['Skin Fade', 45, 2800],
      ['Classic Cut & Finish', 35, 2400],
      ['Haircut & Beard', 60, 3600],
    ]);

    expect(preview).toContain('specialisation: barber.specialisation');
    expect(DEMO_BARBERS.map((b) => [b.name, b.specialisation])).toEqual([
      ['Ellis Ward', 'Skin fades · Textured cuts'],
      ['Noah Reid', 'Classic cuts · Beard shaping'],
      ['Marcus Bell', 'Scissor work · Natural styling'],
    ]);
  });

  it('shows only labelled illustrative times drawn from the product sandbox slots, with no date', () => {
    const sandbox = flow.slice(flow.indexOf('const PREVIEW_STATIC_SLOTS'), flow.indexOf('] as const;', flow.indexOf('const PREVIEW_STATIC_SLOTS')));
    const slotsLine = preview.match(/const EXAMPLE_SLOTS = \[([^\]]+)\] as const;/);
    expect(slotsLine).not.toBeNull();
    const slots = [...(slotsLine?.[1].matchAll(/'(\d{2}:\d{2})'/g) ?? [])].map((match) => match[1]);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) expect(sandbox).toContain(`'${slot}'`);
    expect(preview).toContain("const SELECTED_SLOT = '11:00';");
    expect(preview).toContain("const TIME_STEP_HINT = 'Illustrative example times';");
    expect(previewMarkup).toContain('<span class="bob-screen__day-label">Example day</span>');
    expect(textOf(previewMarkup)).not.toMatch(
      /\b(today|tomorrow|mon|tue|wed|thu|fri|sat|sun)\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    );
    expect(previewMarkup).not.toMatch(/confirmed|booked/i);
  });

  it('discloses the fictional demo and keeps the mock non-interactive', () => {
    const caption = textOf(previewMarkup.slice(previewMarkup.indexOf('<figcaption')));
    expect(caption).toContain('Illustrative recreation of the {DEMO_SHOP_NAME} demo booking page.');
    expect(caption).toContain(
      'Cutstate is a fictional KERSIVO demonstration shop; times shown are examples, no appointment is created and no payment is taken.',
    );
    expect(preview).toContain('<div class="bob-device__bezel" role="img" aria-label={screenLabel} data-bob-ref="device">');
    expect(preview).toContain('<div class="bob-screen" aria-hidden="true">');
    expect(cssRule('.bob-screen')).toContain('pointer-events: none;');
    expect(previewMarkup).not.toMatch(/<button\b|<input\b|<form\b/);
  });

  it('uses the approved logo and small lazy portrait thumbnails, all with explicit dimensions', () => {
    const imgs = previewMarkup.match(/<img\b[\s\S]*?\/>/g) ?? [];
    expect(imgs).toHaveLength(2);
    for (const attr of ['src={CUTSTATE_LOGO_SRC}', 'alt=""', 'width={CUTSTATE_LOGO_WIDTH}', 'height={CUTSTATE_LOGO_HEIGHT}', 'decoding="async"']) {
      expect(imgs[0]).toContain(attr);
    }
    for (const attr of ['src={barber.thumb}', 'alt=""', 'width={THUMB_SIZE}', 'height={THUMB_SIZE}', 'loading="lazy"', 'decoding="async"']) {
      expect(imgs[1]).toContain(attr);
    }
    expect(preview).toContain('const THUMB_SIZE = 160;');
    for (const barber of DEMO_BARBERS) {
      const thumb = join(publicDir, `demo/barbers/thumbs/${barber.slug}-160.webp`);
      expect(existsSync(thumb)).toBe(true);
      expect(readFileSync(thumb).byteLength).toBeLessThan(12 * 1024);
    }
    expect(hero).not.toMatch(/<img\b/);
  });

  it('keeps icons decorative; the only script measures the decorative connectors', () => {
    for (const source of [hero, preview]) {
      expect(source).toContain('aria-hidden="true" focusable="false"');
    }
    for (const source of [hero, preview, page]) {
      expect(source).not.toMatch(/<picture\b|<iframe|<embed|<video|client:/);
    }
    expect(`${hero}\n${page}`).not.toMatch(/<script\b/);
    const scripts = preview.match(/<script>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain("import { bindBookingHeroConnectors } from '@/lib/barbershopOnlineBooking/heroConnectors';");
    expect(scripts[0]).toContain("document.addEventListener('astro:page-load', () => bindBookingHeroConnectors());");
    expect(preview).toContain('<svg class="bob-connectors" data-bob-connectors aria-hidden="true" focusable="false"></svg>');
  });

  it('anchors each callout to its exact screen target', () => {
    for (const [id, target] of [
      ['service', "data-bob-ref={service.id === selectedService.id ? 'service' : undefined}"],
      ['barber', "data-bob-ref={barber.id === selectedBarber.id ? 'barber' : undefined}"],
      ['times', "data-bob-ref={slot === SELECTED_SLOT ? 'times' : undefined}"],
      ['details', "data-bob-ref={index === STEPS.length - 1 ? 'details' : undefined}"],
    ]) {
      expect(preview).toContain(`{ id: '${id}', side:`);
      expect(preview).toContain(target);
    }
    expect(preview).toContain("{ id: 'barber', side: 'left', icon: ICONS.user, title: 'Pick a barber',");
    expect(preview).toContain("const SELECTED_BARBER_SLUG = 'marcus-bell';");
    expect(preview).not.toMatch(/side: '(below|above)'|data-bob-corridor/);
    const slots = [...(preview.match(/const EXAMPLE_SLOTS = \[([^\]]+)\]/)?.[1].matchAll(/'(\d{2}:\d{2})'/g) ?? [])].map((m) => m[1]);
    expect(slots.indexOf('11:00') % 3).toBe(2);
  });

  it('tilts the tablet only from 1024px and shows callouts and connectors only from 1280px', () => {
    expect(cssRule('.bob-device__bezel')).not.toContain('transform');
    const desktop = mediaBlock('(min-width: 64rem)');
    expect(desktop).toContain('perspective: 2200px;');
    expect(desktop).toContain('transform: rotateX(6deg);');
    expect(desktop).toMatch(/\.bob-hero__title-line \{\s*white-space: nowrap;/);
    expect(cssRule('.bob-callouts')).toContain('display: none;');
    expect(cssRule('.bob-connectors')).toContain('display: none;');
    expect(cssRule('.bob-screen__col--times')).toBe('');
    expect(mediaBlock('(min-width: 48rem)')).toMatch(/\.bob-screen__col--times \{\s*display: none;/);
    expect(mediaBlock('(max-width: 47.99rem)')).toContain('.bob-screen__col--barbers .bob-screen__list {');
    const wide = mediaBlock('(min-width: 80rem)');
    expect(wide).toMatch(/\.bob-callouts \{\s*display: block;/);
    expect(wide).toMatch(/\.bob-connectors \{\s*display: block;/);
    expect(wide).toMatch(/\.bob-screen__col--barbers \.bob-screen__row \{\s*min-height: 5\.15em;/);
    expect(desktop).toMatch(/\.bob-screen__col--barbers \.bob-screen__list \{\s*grid-auto-rows: 1fr;/);
    expect(heroCss).not.toMatch(/\.bob-callout--(below|above)/);
    expect(wide).not.toContain('.bob-device__caption');
    expect(heroCss).not.toMatch(/rotateY|rotate3d/);
  });

  it('keeps the CUTSTATE body font scoped to the screen under a unique name', () => {
    expect(heroCss).not.toContain('BOB Cutstate Display');
    expect(heroCss).toMatch(/font-family: 'BOB Cutstate Body';[^}]*font-weight: 400;/);
    expect(heroCss).toMatch(/font-family: 'BOB Cutstate Body';[^}]*font-weight: 600;/);
    expect(cssRule('.bob-hero__title')).toContain('font-family: var(--font-body);');
    expect(cssRule('.bob-screen')).toContain("font-family: 'BOB Cutstate Body'");
  });

  it('keeps focus visible, CTAs touch-sized and motion behind reduced-motion', () => {
    expect(heroCss).toMatch(/\n\.bob-hero__action:focus-visible \{\s*outline: 2px solid var\(--focus\);/);
    expect(heroCss).toMatch(/\n\.bob-device__live:focus-visible \{\s*outline: 2px solid var\(--focus\);/);
    expect(cssRule('.bob-hero__action')).toContain('min-height: 3rem;');
    const reducedStart = heroCss.indexOf('@media (prefers-reduced-motion');
    expect(reducedStart).toBeGreaterThan(-1);
    expect(heroCss.slice(0, reducedStart)).not.toMatch(/animation:/);
  });

  it('uses a WebPage node linked to the existing KERSIVO identifiers only', () => {
    const siteUrl = getPublicSiteUrl();
    const jsonLd = buildBarbershopOnlineBookingJsonLd();
    expect(jsonLd['@type']).toBe('WebPage');
    expect(jsonLd['@id']).toBe(`${siteUrl}/barbershop-online-booking#webpage`);
    expect(jsonLd.isPartOf).toEqual({ '@id': getKersivoWebsiteId(siteUrl) });
    expect(jsonLd.publisher).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(JSON.stringify(jsonLd)).not.toMatch(/FAQPage|BreadcrumbList|Review|AggregateRating|Offer/);
    expect(page).toContain('jsonLd={buildBarbershopOnlineBookingJsonLd()}');
  });

  it('shares the marketing route family for page transitions', () => {
    expect(getRouteFamily(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH)).toBe('marketing');
  });

  it('is not linked from any other page or component while unfinished', () => {
    const allowed = new Set([
      'pages/barbershop-online-booking/index.astro',
      'lib/seo/barbershopOnlineBookingPage.ts',
      'lib/seo/barbershopOnlineBookingPage.test.ts',
      'lib/navigation/routeFamilies.ts',
    ]);
    const offenders = (readdirSync(srcDir, { recursive: true }) as string[])
      .map((file) => file.replace(/\\/g, '/'))
      .filter((file) => /\.(astro|tsx?|mdx?)$/.test(file) && !allowed.has(file))
      .filter((file) => /["'`]\/barbershop-online-booking\b/.test(readFileSync(join(srcDir, file), 'utf8')))
      .map((file) => relative(srcDir, join(srcDir, file)));
    expect(offenders).toEqual([]);
  });
});
