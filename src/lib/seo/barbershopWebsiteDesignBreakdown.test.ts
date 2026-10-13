import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_NAV } from '@/lib/demo/nav';
import { DEMO_SERVICES, demoServiceNavigatorGroups } from '@/lib/demo/services';
import { BLACKLINE_BOOKING_PRESENTATION } from '@/lib/demo/booking';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-website-design/index.astro');
const section = read('../../components/barbershop-website-design/WebsiteDesignBreakdown.astro');
const markup = section.split('---').slice(2).join('---');
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
  return parts.slice(1).map((part) => part.split('<figcaption')[0]);
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
