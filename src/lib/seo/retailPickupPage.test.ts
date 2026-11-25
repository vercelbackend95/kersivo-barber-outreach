import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl } from './meta';
import { getStaticPageLastModified } from './pageDates';
import {
  RETAIL_PICKUP_COMPARE,
  RETAIL_PICKUP_DESCRIPTION,
  RETAIL_PICKUP_FAQ_ITEMS,
  RETAIL_PICKUP_HERO,
  RETAIL_PICKUP_HERO_IMAGE,
  RETAIL_PICKUP_JOURNEY,
  RETAIL_PICKUP_LLMS_SUMMARY,
  RETAIL_PICKUP_OG_IMAGE_PATH,
  RETAIL_PICKUP_PRODUCTS,
  RETAIL_PICKUP_LAST_UPDATED_ISO,
  RETAIL_PICKUP_NEW,
  RETAIL_PICKUP_PAGE_PATH,
  RETAIL_PICKUP_SETUP,
  RETAIL_PICKUP_TITLE,
  buildRetailPickupJsonLd,
} from './retailPickupPage';
import { buildLlmsTxt } from '@/pages/llms.txt';
import { buildMarketingNavigation } from '@/lib/nav/marketingNavigation';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { RESERVED_UNPAID_STATUS_LABEL } from '@/lib/shop/retailPaymentMode';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../../pages/barbershop-retail-pickup/index.astro'), 'utf8');
const experience = readFileSync(join(here, '../landing/retailPickup/experience.ts'), 'utf8');
const css = readFileSync(join(here, '../../styles/components/retail-pickup.css'), 'utf8');

const allCopy = JSON.stringify([
  RETAIL_PICKUP_HERO,
  RETAIL_PICKUP_NEW,
  RETAIL_PICKUP_JOURNEY,
  RETAIL_PICKUP_COMPARE,
  RETAIL_PICKUP_SETUP,
  RETAIL_PICKUP_FAQ_ITEMS,
]);

describe('/barbershop-retail-pickup metadata', () => {
  it('has a search title and description within SERP limits', () => {
    expect(RETAIL_PICKUP_PAGE_PATH).toBe('/barbershop-retail-pickup');
    expect(RETAIL_PICKUP_TITLE).toBe('Barbershop Click and Collect: £39/mo, 0% Commission');
    expect(RETAIL_PICKUP_TITLE.length).toBeLessThanOrEqual(60);
    expect(RETAIL_PICKUP_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(RETAIL_PICKUP_DESCRIPTION.length).toBeLessThanOrEqual(165);
    // The price is in the snippet, and the commission claim keeps its Stripe note.
    expect(RETAIL_PICKUP_DESCRIPTION).toContain('£39/month');
    expect(RETAIL_PICKUP_DESCRIPTION).toMatch(/0% KERSIVO commission. Stripe fees apply./);
    expect(RETAIL_PICKUP_LLMS_SUMMARY).toContain('£39/month per location');
    expect(resolveCanonicalUrl(RETAIL_PICKUP_PAGE_PATH)).toBe('https://kersivo.co.uk/barbershop-retail-pickup');
    expect(page).toContain('canonicalPath={RETAIL_PICKUP_PAGE_PATH}');
    expect(page).not.toContain('noindex');
  });

  it('has one H1 naming the category and the buyer', () => {
    expect(page.match(/<h1\b/g)).toHaveLength(1);
    expect(RETAIL_PICKUP_HERO.titleLines.join(' ')).toBe('Click and collect for your barbershop.');
  });

  it('answers the query in 40–60 words right under the H1', () => {
    const words = RETAIL_PICKUP_HERO.lead.split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(40);
    expect(words).toBeLessThanOrEqual(60);
  });

  it('is listed in the sitemap with its content date, in llms.txt and in the Product menu', () => {
    expect(buildMarketingSitemapEntries()).toContainEqual({
      loc: 'https://kersivo.co.uk/barbershop-retail-pickup',
      lastmod: RETAIL_PICKUP_LAST_UPDATED_ISO,
    });
    expect(getStaticPageLastModified(RETAIL_PICKUP_PAGE_PATH)).toBe(RETAIL_PICKUP_LAST_UPDATED_ISO);
    expect(buildLlmsTxt('https://kersivo.co.uk')).toContain('[Retail pickup](https://kersivo.co.uk/barbershop-retail-pickup)');
    const product = buildMarketingNavigation().find((group) => group.id === 'product')!;
    const retail = product.sections.flatMap((section) => section.items).find((item) => item.id === 'platform-retail');
    expect(retail?.href).toBe(RETAIL_PICKUP_PAGE_PATH);
    expect(getRouteFamily(RETAIL_PICKUP_PAGE_PATH)).toBe(getRouteFamily('/barbershop-online-booking'));
  });
});

describe('/barbershop-retail-pickup structured data', () => {
  const nodes = buildRetailPickupJsonLd();
  const byType = (type: string) => nodes.find((node) => node['@type'] === type)!;

  it('publishes WebPage, Service, HowTo, BreadcrumbList and FAQPage in en-GB', () => {
    expect(nodes.map((node) => node['@type'])).toEqual(['WebPage', 'Service', 'HowTo', 'BreadcrumbList', 'FAQPage']);
    expect(byType('WebPage')).toMatchObject({ inLanguage: 'en-GB', dateModified: RETAIL_PICKUP_LAST_UPDATED_ISO });
  });

  it('keeps the FAQ schema identical to the visible FAQ', () => {
    const faq = byType('FAQPage') as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(RETAIL_PICKUP_FAQ_ITEMS.map((item) => item.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(RETAIL_PICKUP_FAQ_ITEMS.map((item) => item.answer));
    expect(page).toContain('faqs={[...RETAIL_PICKUP_FAQ_ITEMS]}');
  });

  it('mirrors the visible four-step journey in the HowTo', () => {
    const howTo = byType('HowTo') as { step: Array<{ name: string }> };
    expect(howTo.step.map((step) => step.name)).toEqual(RETAIL_PICKUP_JOURNEY.chapters.map((chapter) => chapter.title));
  });

  it('prices the Service from the offer, per location', () => {
    expect(byType('Service')).toMatchObject({
      offers: {
        price: '39',
        priceCurrency: 'GBP',
        priceSpecification: { '@type': 'UnitPriceSpecification', price: '39', billingDuration: 'P1M', unitText: 'per location per month' },
      },
    });
  });

  it('answers the price question in the FAQ', () => {
    const price = RETAIL_PICKUP_FAQ_ITEMS.find((item) => item.question === 'How much does click and collect cost for a barbershop?');
    expect(price?.answer).toContain('£39/month per location');
  });

  it('describes the hero photo as the page’s primary image', () => {
    expect(byType('WebPage')).toMatchObject({ primaryImageOfPage: { '@type': 'ImageObject', url: `https://kersivo.co.uk${RETAIL_PICKUP_HERO_IMAGE.src}` } });
  });
});

describe('/barbershop-retail-pickup copy rules', () => {
  it('keeps "Stripe fees apply" next to every 0% KERSIVO commission claim', () => {
    expect(RETAIL_PICKUP_HERO.facts.join(' ')).toContain('0% KERSIVO commission · Stripe fees apply');
    for (const item of RETAIL_PICKUP_FAQ_ITEMS.filter((faq) => faq.answer.includes('0% KERSIVO commission'))) {
      expect(item.answer).toMatch(/Stripe payment-processing fees apply/);
    }
  });

  it('uses the product’s own status label and says Starter does not include the shop', () => {
    expect(allCopy).toContain(RESERVED_UNPAID_STATUS_LABEL);
    expect(RETAIL_PICKUP_SETUP.planNote).toMatch(/Starter \(£0\/month\) covers online booking only, without the retail shop/);
  });

  it('never promises delivery, fixed setup days or invented numbers', () => {
    expect(allCopy).not.toMatch(/next[- ]day|same[- ]day delivery|we deliver|\b\d+ (working )?days\b|\d+%(?! KERSIVO commission)/i);
    expect(allCopy).not.toMatch(/\bcolor\b|\bcustomize\b|\borganize\b/);
  });
});

describe('/barbershop-retail-pickup product photos', () => {
  const pub = (path: string) => join(here, '../../../public', path.replace(/^\//, ''));

  it('ships every photo the page references', () => {
    const paths = [
      RETAIL_PICKUP_OG_IMAGE_PATH,
      RETAIL_PICKUP_HERO_IMAGE.src,
      ...Object.values(RETAIL_PICKUP_HERO_IMAGE.webp),
      ...Object.values(RETAIL_PICKUP_PRODUCTS).map((product) => product.image),
    ];
    for (const path of paths) expect(existsSync(pub(path)), path).toBe(true);
  });

  it('shows product photos, not colour swatches, in the bag and the phone', () => {
    expect(page).not.toMatch(/rp-swatch|rp-shelf__img--/);
    expect(page).toContain('class="rp-thumb rp-checkout__img" src={line.image}');
    expect(page).toContain('<img src={item.image}');
    expect(page).toContain('alt={HERO_IMAGE.alt}');
    expect(page).toContain('ogImagePath={RETAIL_PICKUP_OG_IMAGE_PATH}');
  });
});

describe('/barbershop-retail-pickup motion and accessibility', () => {
  it('keeps the hero products still: a photo, no 3D scene, no pointer tracking', () => {
    expect(existsSync(join(here, '../landing/retailPickup/heroScene.ts'))).toBe(false);
    expect(experience).not.toMatch(/heroScene|from 'three'|pointermove|setPointer/);
    expect(page).not.toMatch(/<canvas|data-rp-canvas/);
    expect(css).not.toMatch(/--rp-px|rp-hero__canvas/);
    expect(page).toContain('class="rp-hero__still"');
  });

  it('respects reduced motion: no pin, no loops, nothing left hidden', () => {
    expect(experience).toContain('(prefers-reduced-motion: no-preference)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(page).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  });

  it('drives the payment switch with native radios and the counter with real buttons', () => {
    expect(page.match(/type="radio" name="rp-mode"/g)).toHaveLength(1);
    expect(page).toContain('<legend class="sr-only">Show checkout for</legend>');
    expect(page).toContain('aria-live="polite" data-rp-announce');
    expect(page).toContain('data-rp-action');
  });
});
