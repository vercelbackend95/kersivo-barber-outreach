import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BARBERSHOP_WEBSITES_PAGE_DESCRIPTION,
  BARBERSHOP_WEBSITES_PAGE_H1,
  BARBERSHOP_WEBSITES_PAGE_TITLE,
  getBarbershopWebsitesFaqs,
} from './barbershopWebsitesPage';
import {
  BARBERSHOP_WEBSITE_DESIGN_PAGE_H1,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE,
} from './barbershopWebsiteDesignPage';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const legacy = read('../../pages/design-preview/barbershop-websites-v1.astro');
const dir = '../../components/barbershopWebsite/';
const files = readdirSync(join(here, dir)).filter((file) => file.endsWith('.astro'));
const component = (name: string) => read(`${dir}${name}.astro`);
const all = files.map((file) => read(`${dir}${file}`)).join('\n');
const css = read('../../styles/barbershop-website/page.css');

describe('/barbershop-websites redesign — keyword focus', () => {
  it('targets "barbershop website" and leaves design queries to /barbershop-website-design', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_TITLE.toLowerCase()).toMatch(/^barbershop website uk/);
    expect(BARBERSHOP_WEBSITES_PAGE_TITLE.toLowerCase()).not.toContain('design');
    expect(BARBERSHOP_WEBSITES_PAGE_H1.toLowerCase()).toContain('barbershop website');
    expect(BARBERSHOP_WEBSITES_PAGE_H1.toLowerCase()).not.toContain('design');
    expect(BARBERSHOP_WEBSITES_PAGE_DESCRIPTION.length).toBeLessThanOrEqual(170);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE.toLowerCase()).toContain('design');
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_H1).not.toBe(BARBERSHOP_WEBSITES_PAGE_H1);
  });

  it('answers the four intents with H2s in order: why, what to include, how clients book, online presence', () => {
    const order = ['BwHero', 'BwWhy', 'BwAnatomy', 'BwBooking', 'BwPresence', 'BwOffer', 'BwFaqClose'];
    const positions = order.map((name) => page.indexOf(`<${name} />`));
    expect(positions.every((pos) => pos > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(component('BwWhy')).toContain('Why your barbershop needs its own website');
    expect(component('BwAnatomy')).toContain('What a barbershop website should include');
    expect(component('BwBooking')).toContain('How clients book appointments from your website');
    expect(component('BwPresence')).toContain('What a professional online presence looks like');
  });

  it('has exactly one H1 and links to the design and booking guides as supporting pages', () => {
    expect((`${page}\n${all}`.match(/<h1\b/g) ?? [])).toHaveLength(1);
    expect(component('BwAnatomy')).toContain('href={BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}');
    expect(component('BwBooking')).toContain('href={BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}');
  });

  it('keeps FAQ ids unique and website-focused for both CTA modes', () => {
    for (const flag of [true, false]) {
      const faqs = getBarbershopWebsitesFaqs(flag);
      expect(new Set(faqs.map((faq) => faq.id)).size).toBe(faqs.length);
      expect(faqs.some((faq) => /what should a barbershop website include/i.test(faq.question))).toBe(true);
      expect(faqs.some((faq) => /how do clients book/i.test(faq.question))).toBe(true);
    }
    expect(page).not.toMatch(/FAQPage/);
  });
});

describe('/barbershop-websites redesign — offer and claims', () => {
  it('makes Full KERSIVO the primary CTA in both flag modes, Starter only as a text link', () => {
    for (const name of ['BwHero', 'BwOffer', 'BwFaqClose']) {
      const source = component(name);
      expect(source, name).toContain('<FullPlanCta');
      expect(source, name).toContain('data-track="saas_subscribe_click"');
    }
    expect(component('BwOffer')).toContain('href="/starter"');
    expect(all).not.toMatch(/href="\/starter"[^>]*bw-btn--primary/);
  });

  it('keeps 0% commission next to the Stripe fees note and uses "a few days" for setup', () => {
    for (const name of ['BwHero', 'BwOffer', 'BwFaqClose']) {
      const source = component(name);
      const at = source.indexOf('0% KERSIVO commission');
      expect(at, name).toBeGreaterThan(-1);
      const near = source.slice(at, at + 400);
      expect(near.includes('Stripe fees apply') || near.includes('STRIPE_FEES_NOTE'), name).toBe(true);
    }
    expect(component('BwOffer')).toContain('a few\n        days once we receive all required information');
    expect(all).not.toMatch(/\b\d+\s*(?:–|-|to)?\s*\d*\s*(?:working )?days\b/);
    expect(STRIPE_FEES_NOTE.length).toBeGreaterThan(0);
  });

  it('labels the demo shop as fictional and invents no reviews or numbers', () => {
    expect(component('BwHero')).toContain('CUTSTATE Barbers is a fictional demonstration shop.');
    expect(all).not.toMatch(/\btestimonials?\b|\breviews?\b|\bratings?\b|★|\d+\s*%\s*(?:more|of clients|of barbershops)/i);
  });
});

describe('/barbershop-websites redesign — accessibility and motion', () => {
  it('uses real controls with ARIA state for every interaction', () => {
    expect(component('BwWhy')).toContain('role="radiogroup"');
    expect(component('BwAnatomy')).toContain('aria-pressed=');
    expect(component('BwBooking')).toContain('role="tablist"');
    expect(component('BwBooking')).toContain('data-bw-pause');
    expect(component('BwPresence')).toContain('type="checkbox"');
    expect(component('BwPresence')).toContain('aria-live="polite"');
  });

  it('respects reduced motion and themes focus', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(':focus-visible');
    const init = read('../../lib/barbershopWebsite/init.ts');
    expect(init).toContain("'(prefers-reduced-motion: no-preference)'");
    expect(init).toMatch(/import\('gsap'\)/);
  });
});

describe('/barbershop-websites previous version is kept', () => {
  it('renders the v1 sections at a noindex preview URL that is not in the sitemap', () => {
    for (const name of ['BarbershopWebsitesHero', 'WebsiteEssentials', 'BrandToBooking', 'FullOffer', 'SetupProcess', 'FaqAndClose']) {
      expect(legacy).toContain(`<${name} />`);
    }
    expect(legacy).toMatch(/^\s+noindex$/m);
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs.some((loc) => loc.includes('/design-preview/'))).toBe(false);
  });
});

describe('/barbershop-websites cinematic pass', () => {
  it('says how KERSIVO handles every presence item and drops the "first four" claim', () => {
    const presence = component('BwPresence');
    expect(presence).not.toContain('covers the first four');
    expect(presence).toContain('handles or helps with all eight');
    const lines = presence.match(/kersivo: '/g) ?? [];
    expect(lines).toHaveLength(8);
    expect(presence).toContain('cover the cost');
    expect(presence).toContain('SMS reminders within a monthly allowance');
    expect(presence).toContain('aria-pressed="false"');
  });

  it('keeps the final domain playground local: no form, no field name, clear disclaimer', () => {
    const close = component('BwFaqClose');
    const input = close.slice(close.indexOf('<input'), close.indexOf('/>', close.indexOf('<input')));
    expect(input).not.toMatch(/\bname=/);
    expect(close).not.toMatch(/<form\b/);
    expect(close).toContain('<label class="bw-final__label" for="bw-final-name">');
    expect(close).toContain('nothing you type is saved or sent');
    expect(close).toContain('one standard domain per location is included');
  });

  it('loads three.js lazily inside a reduced-motion guard', () => {
    const film = read('../../lib/barbershopWebsite/film.ts');
    const init = read('../../lib/barbershopWebsite/init.ts');
    expect(film).toMatch(/import\('three'\)/);
    expect(film).not.toMatch(/^import .* from 'three'/m);
    const motionAt = init.indexOf("function bindMotion");
    expect(init.indexOf('createFilm(film)', motionAt)).toBeGreaterThan(init.indexOf('MOTION_OK).matches', motionAt));
    expect(page).toContain('data-bw-film-canvas aria-hidden="true"');
  });
});
