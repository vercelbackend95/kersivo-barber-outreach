import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { offer } from '@/content/offer';
import { KERSIVO_COMMISSION_WITH_STRIPE } from '@/lib/pricing/claimsPolicy';
import { HOMEPAGE_FAQ_ITEMS, buildBarbershopBookingFaqJsonLd, getHomepageFaqItems } from './barbershopBookingFaq';
import { SAAS_MONTHLY_GBP } from './defaults';
import {
  HOME_CHECKLIST_ANSWER,
  HOME_CHECKLIST_FAQ_ANSWER,
  HOME_CHECKLIST_FAQ_QUESTION,
  HOME_CHECKLIST_HEADING,
  HOME_CHECKLIST_ITEMS,
  HOME_CHECKLIST_LEAD,
  HOME_CHECKLIST_LINKS,
  HOME_CHECKLIST_SECTION_ID,
} from './homeBookingChecklist';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const homepage = read('src/pages/index.astro');
const component = read('src/components/homeV2/HomeV2Checklist.astro');
const styles = read('src/styles/home-v2/sections.css');

const COMPETITOR_NAMES = /booksy|fresha|treatwell|setora|nearcut|vagaro|phorest|squire|timely|square/i;

describe('homepage buyer checklist: placement', () => {
  it('sits between the included ledger and pricing, without a new URL', () => {
    expect(homepage).toMatch(/<HomeV2Included \/>\s*<HomeV2Checklist \/>\s*<HomeV2Price \/>/);
    expect(HOME_CHECKLIST_SECTION_ID).toBe('booking-system-checklist');
    expect(component).toContain('<section id={HOME_CHECKLIST_SECTION_ID}');
  });

  it('renders the heading, lead and items from the copy module with one H2 and no H1', () => {
    expect(HOME_CHECKLIST_HEADING).toBe('What to check before you choose a barber booking system');
    expect(component.match(/<h2\b/g)).toHaveLength(1);
    expect(component).not.toMatch(/<h1\b/);
    expect(component).toContain('{HOME_CHECKLIST_HEADING}');
    expect(component).toContain('{HOME_CHECKLIST_LEAD}');
    expect(component).toContain('HOME_CHECKLIST_ITEMS.map');
    expect(component).toContain('{HOME_CHECKLIST_ANSWER}');
    expect(HOME_CHECKLIST_LEAD).toContain('UK barber booking system');
  });

  it('stays out of the chapter rail and the sand eyebrows', () => {
    expect(component).not.toMatch(/data-hv2-chapter|data-hv2-glyph/);
  });
});

describe('homepage buyer checklist: copy', () => {
  it('has eight checks, each a question with a one-sentence reason', () => {
    expect(HOME_CHECKLIST_ITEMS).toHaveLength(8);
    expect(HOME_CHECKLIST_LEAD).toMatch(/^Eight questions/);
    for (const item of HOME_CHECKLIST_ITEMS) {
      expect(item.check, item.check).toMatch(/\?$/);
      expect(item.why.match(/[.!?](\s|$)/g), item.check).toHaveLength(1);
    }
    expect(new Set(HOME_CHECKLIST_ITEMS.map((item) => item.check)).size).toBe(HOME_CHECKLIST_ITEMS.length);
  });

  it('covers the eight buying topics', () => {
    const checks = HOME_CHECKLIST_ITEMS.map((item) => item.check).join(' ');
    for (const topic of [
      /new clients from a marketplace/,
      /card fees/,
      /per barber or per shop/,
      /owns the client list.*export/,
      /deposits.*no-show/,
      /own website and domain.*platform profile/,
      /install an app/,
      /contract length and notice period/,
    ]) {
      expect(checks).toMatch(topic);
    }
  });

  it('keeps the checklist neutral: no competitor names, prices or figures', () => {
    for (const item of HOME_CHECKLIST_ITEMS) {
      const copy = `${item.check} ${item.why}`;
      expect(copy, item.check).not.toMatch(COMPETITOR_NAMES);
      expect(copy, item.check).not.toMatch(/£|%|\d/);
      expect(copy, item.check).not.toMatch(/kersivo/i);
    }
    for (const copy of [
      HOME_CHECKLIST_HEADING,
      HOME_CHECKLIST_LEAD,
      HOME_CHECKLIST_FAQ_QUESTION,
      HOME_CHECKLIST_FAQ_ANSWER,
    ]) {
      expect(copy).not.toMatch(COMPETITOR_NAMES);
      expect(copy).not.toMatch(/£|%/);
    }
    expect(HOME_CHECKLIST_ANSWER).not.toMatch(COMPETITOR_NAMES);
    expect(component).not.toMatch(COMPETITOR_NAMES);
  });

  it('describes Full KERSIVO with approved wording only', () => {
    expect(HOME_CHECKLIST_ANSWER).toContain(`Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location, not per barber.`);
    expect(HOME_CHECKLIST_ANSWER).toContain(KERSIVO_COMMISSION_WITH_STRIPE);
    expect(HOME_CHECKLIST_ANSWER).toMatch(/0% KERSIVO commission\. Standard Stripe payment-processing fees apply/);
    expect(HOME_CHECKLIST_ANSWER).not.toMatch(/Starter|£0|days|weeks|guarantee/i);
  });
});

describe('homepage buyer checklist: links and CTA', () => {
  it('links out only to /compare, /pricing#plan and /free-preview', () => {
    expect(HOME_CHECKLIST_LINKS.compare.href).toBe('/compare');
    expect(HOME_CHECKLIST_LINKS.pricing.href).toBe('/pricing#plan');
    expect(HOME_CHECKLIST_LINKS.preview.href).toBe('/free-preview');
    expect(HOME_CHECKLIST_LINKS.preview.label).toBe('Get my free preview');
    expect(offer.cta.primary).toBe('Get my free preview');
    // No literal hrefs in the markup: every link comes from the module or the shared free-preview CTA.
    expect(component).not.toMatch(/href="/);
    expect([...component.matchAll(/href=\{([^}]+)\}/g)].map((match) => match[1]).sort()).toEqual([
      'HOME_CHECKLIST_LINKS.compare.href',
      'HOME_CHECKLIST_LINKS.pricing.href',
      'HOME_CHECKLIST_LINKS.pricing.href',
    ]);
    expect(component).toContain('<FullPlanCta part="primary"');
    expect(component).not.toMatch(/nofollow|target=/);
  });

  it('makes the free preview the one primary button and tracks each link', () => {
    expect(component.match(/<FullPlanCta\b/g)).toHaveLength(1);
    expect(component).toContain('placement="home_checklist"');
    expect(component).toContain('data-track="compare_hub_click"');
    expect(component).toContain('data-track="view_pricing_click"');
  });
});

describe('homepage buyer checklist: FAQ', () => {
  it('adds the question to the visible FAQ and the FAQPage JSON-LD in both flag states', () => {
    expect(HOME_CHECKLIST_FAQ_QUESTION).toBe('How do I choose a barber booking system in the UK?');
    for (const freePreview of [false, true]) {
      const visible = getHomepageFaqItems(freePreview).find((item) => item.question === HOME_CHECKLIST_FAQ_QUESTION);
      expect(visible?.answer).toBe(HOME_CHECKLIST_FAQ_ANSWER);
      const entities = buildBarbershopBookingFaqJsonLd(freePreview).mainEntity as Array<{
        name: string;
        acceptedAnswer: { text: string };
      }>;
      expect(entities.find((entity) => entity.name === HOME_CHECKLIST_FAQ_QUESTION)?.acceptedAnswer.text).toBe(
        HOME_CHECKLIST_FAQ_ANSWER,
      );
    }
    expect(HOMEPAGE_FAQ_ITEMS.filter((item) => item.question === HOME_CHECKLIST_FAQ_QUESTION)).toHaveLength(1);
    expect(HOMEPAGE_FAQ_ITEMS[0].question).toBe('How much does Full KERSIVO cost a shop?');
  });

  it('summarises the same eight checks as the list', () => {
    expect(HOME_CHECKLIST_FAQ_ANSWER).toMatch(/^Check eight things/);
    for (const phrase of [
      'marketplace',
      'card fees',
      'per barber or per shop',
      'export',
      'deposits',
      'own website and domain',
      'app',
      'notice period',
    ]) {
      expect(HOME_CHECKLIST_FAQ_ANSWER).toContain(phrase);
    }
  });
});

describe('homepage buyer checklist: accessibility and motion', () => {
  it('hides the decorative ticks, shows focus and only animates when motion is allowed', () => {
    expect(component).toContain('aria-labelledby="hv2-check-title"');
    expect(component).toMatch(/<svg class="hv2-check__box"[^>]*aria-hidden="true"/);
    expect(styles).toContain('.hv2 .hv2-check a:focus-visible');
    const motion = styles.slice(styles.indexOf('/* Each tick draws itself'));
    expect(motion).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*@supports \(animation-timeline: view\(\)\)/,
    );
    expect(styles.match(/animation: hv2-check-draw/g)).toHaveLength(1);
  });
});
