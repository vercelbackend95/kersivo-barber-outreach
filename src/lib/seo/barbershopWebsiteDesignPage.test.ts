import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_H1,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH,
  BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE,
  buildBarbershopWebsiteDesignFaqJsonLd,
  buildBarbershopWebsiteDesignJsonLd,
} from './barbershopWebsiteDesignPage';
import { WD_AUDIT, WD_FAQS, WD_HERO_TITLE_LINES, WD_OFFER } from './barbershopWebsiteDesignContent';
import { BARBERSHOP_WEBSITES_PAGE_H1, BARBERSHOP_WEBSITES_PAGE_TITLE } from './barbershopWebsitesPage';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-website-design/index.astro');
const component = (name: string) => read(`../../components/websiteDesign/${name}.astro`);

describe('/barbershop-website-design — design-intent guide', () => {
  it('targets design intent and stays distinct from the /barbershop-websites pillar', () => {
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE).toBe('Barbershop Website Design: Layout, Branding & UX | KERSIVO');
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE.length).toBeLessThanOrEqual(60);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_H1).toBe(WD_HERO_TITLE_LINES.join(' '));
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_H1.toLowerCase()).toContain('barbershop website design');
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE).not.toBe(BARBERSHOP_WEBSITES_PAGE_TITLE);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_H1).not.toBe(BARBERSHOP_WEBSITES_PAGE_H1);
  });

  it('renders the sections in order inside one main landmark', () => {
    const order = ['<WdHero', '<WdGlance', '<WdMobile', '<WdBrand', '<WdPhoto', '<WdAudit', '<WdOffer', '<WdFaqClose'];
    const positions = order.map((tag) => page.indexOf(tag));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(page.match(/<main\b/g)).toHaveLength(1);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(page.indexOf('</main>'));
  });

  it('builds WebPage and an FAQPage that mirrors the visible FAQ', () => {
    const url = getPublicSiteUrl() + BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH;
    expect(buildBarbershopWebsiteDesignJsonLd()).toMatchObject({ '@type': 'WebPage', url, headline: BARBERSHOP_WEBSITE_DESIGN_PAGE_H1 });
    const faq = buildBarbershopWebsiteDesignFaqJsonLd() as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((entry) => entry.name)).toEqual(WD_FAQS.map((entry) => entry.question));
    expect(faq.mainEntity.map((entry) => entry.acceptedAnswer.text)).toEqual(WD_FAQS.map((entry) => entry.answer));
    expect(component('WdFaqClose')).toContain('{WD_FAQS.map(');
  });

  it('keeps commercial wording inside the approved claims', () => {
    const offer = component('WdOffer');
    expect(offer).toContain('{offer.fees.commission} <small>— Stripe fees apply</small>');
    expect(offer).toContain('{offer.price.fullQualifier}');
    expect(offer).toContain('href="/starter"');
    expect(offer).toContain('{BILLING_NOTE}');
    expect(WD_OFFER.outcomes.map((item) => item.body).join(' ')).toContain('Typically ready in a few days once we receive all the required information.');
    const allCopy = JSON.stringify([WD_OFFER, WD_FAQS, WD_AUDIT]);
    expect(allCopy).not.toMatch(/\b\d+\s*(?:–|-)?\s*\d*\s*(?:weeks?|days)\b/);
  });

  it('leads with the Full KERSIVO action and keeps the team anchor', () => {
    const cta = component('WdPrimaryCta');
    expect(cta).toContain('FREE_PREVIEW_CTA_LABEL');
    expect(cta).toContain('COMPARISON_HERO_PRIMARY_LABEL');
    expect(component('WdHero')).toContain('<WdPrimaryCta placement="barbershop_website_design_hero"');
    expect(component('WdPhoto')).toContain('id="your-team"');
  });
});
