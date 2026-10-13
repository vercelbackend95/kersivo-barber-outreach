import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_BARBERS, demoBarberBookingHref } from '@/lib/demo/barbers';
import { DEMO_NAV } from '@/lib/demo/nav';
import { DEMO_SERVICES, demoServiceNavigatorGroups } from '@/lib/demo/services';
import { BLACKLINE_BOOKING_PRESENTATION } from '@/lib/demo/booking';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-website-design/index.astro');
const section = read('../../components/barbershop-website-design/WebsiteDesignBreakdown.astro');
const markup = section.split('---').slice(2).join('---');
const styles = read('../../styles/components/barbershop-website-design-breakdown.css');
const bookingFlow = read('../../components/booking/BookingFlow.tsx');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const TITLES = [
  'A recognisable first impression',
  'A visible booking action',
  'Services and pricing where expected',
  'The people behind the chairs',
  'Simple, purposeful navigation',
  'Consistency from website to booking',
];

const specimens = () => {
  const parts = markup.split('<div class="bwd-spec" ');
  return parts.slice(1).map((part) => part.split('</figure>')[0]);
};

describe('/barbershop-website-design — Section 02 design breakdown', () => {
  it('renders after the Hero and before the footer', () => {
    const hero = page.indexOf('<WebsiteDesignHero />');
    const breakdown = page.indexOf('<WebsiteDesignBreakdown />');
    expect(hero).toBeGreaterThan(-1);
    expect(breakdown).toBeGreaterThan(hero);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(breakdown);
  });

  it('has exactly one H2 with the approved question, six H3s and no H1', () => {
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '').replace(' ?', '?')).toBe(
      'What Makes a Great Barbershop Website Design?',
    );
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toContain('{principles.map(');
    const titles = [...section.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
    expect(titles).toEqual(TITLES);
  });

  it('opens with the direct answer before the principles', () => {
    const answer = text(markup.match(/<p class="bwd-review__answer">([\s\S]*?)<\/p>/)?.[1] ?? '');
    expect(answer).toBe(
      'A well-designed barbershop website should look like the shop it represents, make key information easy to find and give visitors a clear next step. Strong photography, legible typography and an obvious booking action matter more than decorative effects.',
    );
    expect(markup.indexOf('bwd-review__answer')).toBeLessThan(markup.indexOf('bwd-review__principles'));
  });

  it('answers what to look for, why it matters and how BLACKLINE shows it for every principle', () => {
    for (const label of ['What to look for', 'Why it matters to clients', 'In the BLACKLINE demo']) {
      expect(markup).toContain(label);
    }
    for (const key of ['lookFor', 'why', 'demo']) {
      const values = [...section.matchAll(new RegExp(`\\b${key}:\\s*\\n?\\s*['\`]([^'\`]+)['\`]`, 'g'))].map((m) => m[1]);
      expect(values).toHaveLength(6);
      expect(new Set(values).size).toBe(6);
    }
  });

  it('draws its evidence from the real BLACKLINE data', () => {
    expect(section).toContain("from '@/lib/demo/barbers'");
    expect(section).toContain("from '@/lib/demo/nav'");
    expect(section).toContain('demoServiceNavigatorGroups()');
    expect(markup).toContain('DEMO_NAV.map(');
    expect(demoServiceNavigatorGroups()[0]?.label).toBe('Cuts & Fades');
    expect(DEMO_SERVICES.length).toBe(18);
    expect(DEMO_BARBERS.map((barber) => barber.name)).toEqual(['Ellis Ward', 'Noah Reid', 'Marcus Bell']);
    expect(DEMO_NAV.map((item) => item.label)).toEqual(['Home', 'Services', 'Our Barbers', 'Gallery', 'Shop', 'Contact']);
    expect(BLACKLINE_BOOKING_PRESENTATION.title).toBe('Book a chair');
    expect(markup).toContain('Book a chair');
    expect(markup).toContain('Precision in every detail.');
    expect(section).toContain('three fictional demo barbers');
  });

  it('shows the real barber hand-off into booking rather than an invented state', () => {
    expect(demoBarberBookingHref('ellis-ward')).toBe('/demo/book?barber=ellis-ward');
    expect(markup).toContain('Book with');
    expect(bookingFlow).toContain("barber: { title: 'Choose a barber', hint: 'Who should take you' }");
    expect(markup).toContain('Choose a barber');
    expect(markup).toContain('Who should take you');
    expect(section).toContain("from '@/lib/booking/constants'");
    expect(section).toContain('selected: barber.id === lead.id');
    expect(section).toContain('The visitor picks a service first');
  });

  it('shows the booking action on one recreated gallery page, not the hero or services', () => {
    const example = markup.slice(markup.indexOf('{index === 1 && ('), markup.indexOf('{index === 2 && ('));
    const galleryHero = read('../../components/demo/DemoGalleryHero.astro');
    for (const copy of [
      '03 · RECENT WORK',
      'THE BLACKLINE CUT, IN FOCUS.',
      'Fades, scissor work, beard shaping and the details in between.',
    ]) {
      expect(galleryHero).toContain(copy);
      expect(example).toContain(copy);
    }
    expect(section).toContain("from '@/lib/demo/gallery'");
    expect(section).toContain("(['fade', 'hairline', 'beard'] as const)");
    expect(example).toContain("item.label === 'Gallery'");
    expect(example.match(/class="bwd-spec-cta__book"/g) ?? []).toHaveLength(1);
    expect(example).not.toMatch(/heroimg|Book this service|Choose your finish|bwd-spec-cta__(desktop|mobile)\b/);
  });

  it('scales service durations with the demo menu’s own ratio', () => {
    expect(section).toContain('demoServiceDurationRatio(service.durationMinutes)');
  });

  it('relies on the large principle numbers alone, with no numbered pins inside specimens', () => {
    expect(section).not.toContain('bwd-pin');
    expect(styles).not.toContain('bwd-pin');
  });

  it('keeps routes and technical captions out of the illustrations', () => {
    expect(section).not.toContain('?barber=');
    expect(section).not.toContain('leadBookingHref');
    expect(markup).not.toContain('Recreated detail');
    expect(markup).not.toContain('<figcaption');
    expect(markup).not.toContain('Service chosen');
    expect(styles).not.toContain('bwd-principle__source');
    expect(styles).not.toContain('bwd-spec-flow__url');
    expect(styles).not.toContain('bwd-spec-flow__note');
  });

  it('keeps specimens as labelled, non-interactive illustrations', () => {
    const found = specimens();
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('role="img"');
    expect(found[0]).toContain('aria-label={specimenLabels[index]}');
    expect(found[0]).toContain('aria-hidden="true"');
    expect(found[0]).not.toMatch(/<a\b|<button|<input|<select|<iframe|<video/);
    expect([...section.matchAll(/^\s*'Recreated|^\s*`Recreated/gm)]).toHaveLength(6);
  });

  it('lazy-loads every specimen image', () => {
    const images = markup.match(/<img\b[\s\S]*?\/>/g) ?? [];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toContain('loading="lazy"');
      expect(image).toMatch(/width=/);
      expect(image).toMatch(/height=/);
    }
  });

  it('discloses the fictional demo and offers one exploratory link to /demo', () => {
    expect(markup).toContain('BLACKLINE BARBERS is a fictional KERSIVO demonstration shop.');
    expect(markup).toContain('See the working BLACKLINE website');
    expect(section).toContain("const TRACK_EVENT = 'view_live_demo_click'");
    expect(section).toContain("const TRACK_PLACEMENT = 'barbershop_website_design_breakdown_demo'");
    const links = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    const tracked = links.filter((tag) => tag.includes('data-track='));
    expect(tracked).toHaveLength(1);
    expect(tracked[0]).toContain('href={DEMO_HOME_HREF}');
    for (const event of ['checkout_started', 'checkout_completed', 'saas_subscribe_click']) {
      expect(section).not.toContain(event);
    }
  });

  it('makes no unsupported results, ranking or testimonial claims', () => {
    const prose = section.replace(/bwd-review[\w-]*/g, '').replace(/(design|this) review/gi, '');
    expect(prose).not.toMatch(
      /guarantee|increase(s|d)? (your )?bookings|more bookings|\brank(ing|s)?\b|testimonial|\breviews?\b|\d+%|award/i,
    );
    expect(section).not.toMatch(/real (customer|client|business)|paying customer|case study/i);
  });
});
