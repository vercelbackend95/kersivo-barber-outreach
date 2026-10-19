import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';
import { SAAS_MONTHLY_GBP } from './defaults';
import { BARBERSHOP_WEBSITES_PAGE_PATH } from './barbershopWebsitesPage';
import {
  BARBERSHOP_WEBSITE_COST_BREADCRUMB_CURRENT,
  BARBERSHOP_WEBSITE_COST_BREADCRUMB_PARENT,
  BARBERSHOP_WEBSITE_COST_OG_DESCRIPTION,
  BARBERSHOP_WEBSITE_COST_OG_TITLE,
  BARBERSHOP_WEBSITE_COST_PAGE_DESCRIPTION,
  BARBERSHOP_WEBSITE_COST_PAGE_H1,
  BARBERSHOP_WEBSITE_COST_PAGE_INDEXABLE,
  BARBERSHOP_WEBSITE_COST_PAGE_PATH,
  BARBERSHOP_WEBSITE_COST_PAGE_TITLE,
  BOOKING_SENSITIVITY_MONTHLY_GBP,
  COST_BUYING_MODELS,
  COST_CHECKLIST_QUESTIONS,
  COST_PAGE_FAQS,
  COST_SCENARIO_A_12,
  COST_SCENARIO_A_36,
  COST_SCENARIO_B_12_HIGH,
  COST_SCENARIO_B_12_LOW,
  COST_SCENARIO_B_36_HIGH,
  COST_SCENARIO_B_36_LOW,
  COST_SCENARIO_C_12,
  COST_SCENARIO_C_36,
  buildBarbershopWebsiteCostBreadcrumbJsonLd,
  buildBarbershopWebsiteCostJsonLd,
  buildBarbershopWebsiteCostWebPageJsonLd,
  fullKersivoTotalGbp,
  websiteOnlyTotalGbp,
  websitePlusBookingTotalGbp,
} from './barbershopWebsiteCostPage';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import {
  WEBSITE_SERVICE_COMPARISON_OPTIONS,
  WEBSITE_SERVICE_COMPARISON_PRIMARY_IDS,
  WEBSITE_SERVICE_COMPARISON_SECTION_ID,
  getPrimaryWebsiteServiceComparisonOptions,
} from './websiteServiceComparison';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const pagePath = '../../pages/barbershop-website-cost-uk/index.astro';
const page = read(pagePath);
const costDir = '../../components/barbershop-website-cost/';
const hero = read(`${costDir}WebsiteCostHero.astro`);
const showroom = read(`${costDir}WebsiteCostShowroom.astro`);
const serviceComparison = read(`${costDir}WebsiteCostServiceComparison.astro`);
const models = read(`${costDir}WebsiteCostModels.astro`);
const scenarios = read(`${costDir}WebsiteCostScenarios.astro`);
const ownership = read(`${costDir}WebsiteCostOwnership.astro`);
const offer = read(`${costDir}WebsiteCostFullOffer.astro`);
const faqClose = read(`${costDir}WebsiteCostFaqClose.astro`);
const css = read('../../styles/components/barbershop-website-cost.css');
const comparisonData = read('./websiteServiceComparison.ts');
const layout = read('../../layouts/LandingLayout.astro');
const sitemapSource = read('./marketingSitemap.ts');
const navSource = read('../nav/marketingNavigation.ts');

describe('/barbershop-website-cost-uk page shell', () => {
  it('exists with approved metadata and canonical URL', () => {
    expect(existsSync(join(here, pagePath))).toBe(true);
    expect(BARBERSHOP_WEBSITE_COST_PAGE_PATH).toBe('/barbershop-website-cost-uk');
    expect(BARBERSHOP_WEBSITE_COST_PAGE_TITLE).toBe(
      'Barbershop Website Cost UK: Prices & Fees | KERSIVO',
    );
    expect(BARBERSHOP_WEBSITE_COST_PAGE_DESCRIPTION).toBe(
      'Compare UK barbershop website setup costs, ongoing fees, booking software and ownership. See what Full KERSIVO includes for £39/month.',
    );
    expect(BARBERSHOP_WEBSITE_COST_PAGE_H1).toBe(
      'How Much Does a Barbershop Website Cost in the UK?',
    );
    expect(BARBERSHOP_WEBSITE_COST_OG_TITLE).toBe('Barbershop Website Cost in the UK | KERSIVO');
    expect(BARBERSHOP_WEBSITE_COST_OG_DESCRIPTION.length).toBeGreaterThan(40);
    expect(resolveCanonicalUrl(BARBERSHOP_WEBSITE_COST_PAGE_PATH)).toBe(
      'https://kersivo.co.uk/barbershop-website-cost-uk',
    );
    expect(page).toContain('canonicalPath={BARBERSHOP_WEBSITE_COST_PAGE_PATH}');
    expect(page).toContain('title={BARBERSHOP_WEBSITE_COST_PAGE_TITLE}');
    expect(page).toContain('description={BARBERSHOP_WEBSITE_COST_PAGE_DESCRIPTION}');
  });

  it('renders in an en-GB document via LandingLayout', () => {
    expect(page).toContain("import LandingLayout from '@/layouts/LandingLayout.astro'");
    expect(layout).toContain('<html lang="en-GB"');
    expect(buildBarbershopWebsiteCostWebPageJsonLd().inLanguage).toBe('en-GB');
  });

  it('stays noindex, follow and out of the marketing sitemap and top nav during development', () => {
    expect(BARBERSHOP_WEBSITE_COST_PAGE_INDEXABLE).toBe(false);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITE_COST_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).not.toContain('https://kersivo.co.uk/barbershop-website-cost-uk');
    expect(sitemapSource).not.toContain('barbershop-website-cost');
    expect(navSource).not.toContain('barbershop-website-cost');
  });

  it('composes exactly seven section components and one H1', () => {
    for (const name of [
      'WebsiteCostHero',
      'WebsiteCostServiceComparison',
      'WebsiteCostModels',
      'WebsiteCostScenarios',
      'WebsiteCostOwnership',
      'WebsiteCostFullOffer',
      'WebsiteCostFaqClose',
    ]) {
      expect(page).toContain(name);
    }
    expect(page.indexOf('WebsiteCostServiceComparison')).toBeLessThan(page.indexOf('WebsiteCostModels'));
    const combined = `${page}\n${hero}\n${serviceComparison}\n${models}\n${scenarios}\n${ownership}\n${offer}\n${faqClose}`;
    expect((combined.match(/<h1\b/g) ?? [])).toHaveLength(1);
    expect(hero).toContain('BARBERSHOP_WEBSITE_COST_PAGE_H1');
  });

  it('shares the marketing route family for page transitions', () => {
    expect(getRouteFamily(BARBERSHOP_WEBSITE_COST_PAGE_PATH)).toBe('marketing');
  });
});

describe('/barbershop-website-cost-uk cost mathematics (v1.2)', () => {
  it('uses the approved hypothetical website-only totals', () => {
    expect(websiteOnlyTotalGbp(12)).toBe(440);
    expect(websiteOnlyTotalGbp(36)).toBe(720);
    expect(COST_SCENARIO_A_12).toBe(440);
    expect(COST_SCENARIO_A_36).toBe(720);
  });

  it('computes booking sensitivity rows at £10/£20/£30/£40', () => {
    expect(BOOKING_SENSITIVITY_MONTHLY_GBP).toEqual([10, 20, 30, 40]);
    expect(websitePlusBookingTotalGbp(12, 10)).toBe(560);
    expect(websitePlusBookingTotalGbp(12, 20)).toBe(680);
    expect(websitePlusBookingTotalGbp(12, 30)).toBe(800);
    expect(websitePlusBookingTotalGbp(12, 40)).toBe(920);
    expect(websitePlusBookingTotalGbp(36, 10)).toBe(1080);
    expect(websitePlusBookingTotalGbp(36, 20)).toBe(1440);
    expect(websitePlusBookingTotalGbp(36, 30)).toBe(1800);
    expect(websitePlusBookingTotalGbp(36, 40)).toBe(2160);
    expect(COST_SCENARIO_B_12_LOW).toBe(560);
    expect(COST_SCENARIO_B_12_HIGH).toBe(920);
    expect(COST_SCENARIO_B_36_LOW).toBe(1080);
    expect(COST_SCENARIO_B_36_HIGH).toBe(2160);
  });

  it('computes Full KERSIVO totals from SAAS_MONTHLY_GBP', () => {
    expect(SAAS_MONTHLY_GBP).toBe(39);
    expect(fullKersivoTotalGbp(12)).toBe(468);
    expect(fullKersivoTotalGbp(36)).toBe(1404);
    expect(COST_SCENARIO_C_12).toBe(468);
    expect(COST_SCENARIO_C_36).toBe(1404);
  });

  it('does not ship superseded v1.1 scenario totals', () => {
    const combined = `${scenarios}\n${hero}\n${faqClose}`;
    expect(combined).not.toContain('£358');
    expect(combined).not.toContain('£676');
    expect(combined).not.toContain('£598');
    expect(combined).not.toContain('£1,396');
  });
});

describe('/barbershop-website-cost-uk content and CTAs', () => {
  it('renders a showroom hero with exact SEO H1 and approved copy', () => {
    expect(hero).toContain('WEBSITES · BOOKINGS · RETAIL · MANAGEMENT');
    expect(hero).toContain('BARBERSHOP_WEBSITE_COST_PAGE_H1');
    expect(hero).toContain('bwcost-hero__line--primary');
    expect(hero).toContain('bwcost-hero__line--accent');
    expect(hero).toContain('bwcost-hero__eyebrow-dot');
    expect(hero).not.toContain('bwcost-hero__eyebrow-rule');
    expect(BARBERSHOP_WEBSITE_COST_PAGE_H1).toBe(
      'How Much Does a Barbershop Website Cost in the UK?',
    );
    expect(hero).toContain('With KERSIVO, you get a branded website');
    expect(hero).toContain('standard domain arrangement');
    expect(hero).toContain('SAAS_MONTHLY_GBP');
    expect(hero).toContain('No separate standard setup fee');
    expect(hero).toContain('Cancel anytime');
    expect(hero).toContain('Built for UK barbershops');
    expect(hero).not.toContain('Jones Digital');
    expect(hero).not.toContain('FadeFoundry');
    expect(hero).not.toContain('WebsiteCostEcosystem');
    expect(hero).toContain('bwcost-hero__breadcrumb');
    expect(hero).toContain('BARBERSHOP_WEBSITES_PAGE_PATH');
    expect(hero).toContain('BARBERSHOP_WEBSITE_COST_BREADCRUMB_PARENT');
    expect(hero).toContain('BARBERSHOP_WEBSITE_COST_BREADCRUMB_CURRENT');
    expect(hero).toContain('aria-current="page"');
  });

  it('keeps BreadcrumbList JSON-LD aligned with the visible hero breadcrumb trail', () => {
    expect(BARBERSHOP_WEBSITE_COST_BREADCRUMB_PARENT).toBe('Barbershop websites');
    expect(BARBERSHOP_WEBSITE_COST_BREADCRUMB_CURRENT).toBe('Website cost');
    expect(BARBERSHOP_WEBSITES_PAGE_PATH).toBe('/barbershop-websites');
    const breadcrumb = buildBarbershopWebsiteCostBreadcrumbJsonLd();
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
  });

  it('uses the showroom WebP as full-bleed hero background with six HTML podium tiles', () => {
    expect(hero).toContain('WebsiteCostShowroom');
    expect(hero).toContain('bwcost-hero__media');
    expect(hero).toContain('bwcost-hero__bg');
    expect(hero).toContain('HERO_SHOWROOM_SRC');
    expect(hero).toContain('fetchpriority="high"');
    expect(showroom).toContain('/images/barbershop-website-cost/hero-39-showroom.webp');
    expect(showroom).toContain('1672');
    expect(showroom).toContain('941');
    expect(showroom).toContain('FULL KERSIVO FOR JUST');
    expect(showroom).toContain('PER MONTH');
    expect(showroom).toContain('PER LOCATION');
    expect(showroom).toContain('Branded website');
    expect(showroom).toContain('Integrated bookings');
    expect(showroom).toContain('Retail capability');
    expect(showroom).toContain('Hosting included');
    expect(showroom).toContain('Own domain');
    expect(showroom).toContain('Shop management tools');
    expect(showroom).not.toContain('bwcost-showroom__frame');
    expect(css).toContain('.bwcost-hero__bg');
    expect(css).toContain('object-fit: cover');
    expect(css).toContain('object-position');
    expect(css).toContain('.bwcost-hero__stage');
    expect(css).not.toContain('.bwcost-showroom__frame');
    expect(css).not.toContain('.bwcost-eco');
    expect(css).not.toContain('--bwcost-orbit-r');
  });

  it('renders the three-row reference comparison with chips under the hero', () => {
    expect(WEBSITE_SERVICE_COMPARISON_SECTION_ID).toBe('website-service-comparison');
    expect(serviceComparison).toContain('getPrimaryWebsiteServiceComparisonOptions');
    expect(serviceComparison).toContain('01 / WEBSITE COST COMPARISON');
    expect(serviceComparison).toContain(
      'What does a professionally built barbershop website actually cost?',
    );
    expect(serviceComparison).toContain('bwcost-svc__title');
    expect(serviceComparison).not.toContain('bwcost-section__title');
    expect(serviceComparison).toContain("Don't compare the number alone");
    expect(serviceComparison).toContain('Compare the full costs');
    expect(serviceComparison).toContain('href={SCENARIOS_HREF}');
    expect(serviceComparison).toContain("SCENARIOS_HREF = '#cost-scenarios'");
    expect(serviceComparison).toContain('Explore KERSIVO');
    expect(serviceComparison).toContain('BARBERSHOP_WEBSITES_PAGE_PATH');
    expect(serviceComparison).toContain('What about DIY website builders?');
    expect(serviceComparison).toContain('Wix and Squarespace');
    expect(serviceComparison).toContain('Published offer');
    expect(serviceComparison).toContain('Scope snapshot');
    expect(serviceComparison).toContain('bwcost-svc__chips');
    expect(serviceComparison).toContain('bwcost-svc__chip');
    expect(serviceComparison).toContain('bwcost-svc__check-copy');
    expect(serviceComparison).toContain('bwcost-svc__cell');
    expect(serviceComparison).toContain('bwcost-svc__price-figure');
    expect(serviceComparison).toContain('bwcost-svc__sources');
    expect(serviceComparison).not.toContain('BarberFlow');
    expect(WEBSITE_SERVICE_COMPARISON_PRIMARY_IDS).toEqual([
      'jones-digital',
      'fadefoundry',
      'full-kersivo',
    ]);
    const primary = getPrimaryWebsiteServiceComparisonOptions();
    expect(primary.map((row) => row.name)).toEqual([
      'Jones Digital',
      'FadeFoundry',
      'Full KERSIVO',
    ]);
    expect(primary[2]?.emphasized).toBe(true);
    expect(primary[2]?.priceFigure).toBe(`£${SAAS_MONTHLY_GBP}`);
    expect(WEBSITE_SERVICE_COMPARISON_OPTIONS).toHaveLength(6);
    expect(WEBSITE_SERVICE_COMPARISON_OPTIONS.map((row) => row.name)).toEqual([
      'Full KERSIVO',
      'Jones Digital',
      'FadeFoundry',
      'BarberFlow',
      'Freelance web developer',
      'Web design agency',
    ]);
    expect(WEBSITE_SERVICE_COMPARISON_OPTIONS[0]?.scopeChips).toHaveLength(4);
    expect(WEBSITE_SERVICE_COMPARISON_OPTIONS[0]?.scopeChips.every((c) => c.status === 'included')).toBe(
      true,
    );
    expect(comparisonData).toContain('https://jonesdigital.co.uk/for/salons/');
    expect(comparisonData).toContain('https://fadefoundry.co.uk/pricing/');
    expect(comparisonData).toContain('https://barberflow.co.uk/');
    expect(comparisonData).toContain(
      'https://studiodigitalgroup.co.uk/insights/cost-of-a-website-uk-2026',
    );
    expect(comparisonData).toContain('Custom quote');
    expect(css).toContain('.bwcost-svc__table');
    expect(css).toContain('.bwcost-svc__chip');
    expect(css).toContain('.bwcost-svc__chips');
    expect(css).toContain('.bwcost-svc__table tbody .bwcost-svc__row--kersivo th');
    expect(css).toContain('.bwcost-svc__table tbody .bwcost-svc__row--kersivo td');
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('.bwcost-svc__cell');
    expect(css).toContain('.bwcost-svc__price-figure');
    expect(css).toContain('.bwcost-svc__card--kersivo');
    expect(css).toContain('.bwcost-svc__mobile');
    expect(css).toContain('.bwcost-svc__title');
    expect(css).toMatch(/\.bwcost-svc__title\s*\{[^}]*font-family:\s*var\(--font-body\)/s);
    expect(css).toContain('text-transform: none');
    expect(css).toContain('min(94vw, 91.1rem)');
    expect(css).toContain('border-collapse: separate');
    expect(css).toContain('Never set display:flex/grid on them');
    expect(css).toContain('@media (min-width: 1024px)');
  });

  it('includes four buying models, four-chair inset and cost anatomy after the comparison', () => {
    expect(COST_BUYING_MODELS).toHaveLength(4);
    expect(models).toContain('id="cost-options"');
    expect(models).toContain('What are you actually paying for?');
    expect(models).toContain('What should a four-chair barbershop check?');
    expect(models).toContain("What's included — and what could cost extra?");
  });

  it('keeps exactly seven FAQs and seven checklist questions', () => {
    expect(COST_PAGE_FAQS).toHaveLength(7);
    expect(COST_CHECKLIST_QUESTIONS).toHaveLength(7);
    expect(faqClose).toContain('COST_PAGE_FAQS');
    expect(faqClose).toContain('COST_CHECKLIST_QUESTIONS');
  });

  it('wires hero subscribe/demo CTAs and scroll-to-compare cue', () => {
    expect(hero).toContain("SUBSCRIBE_HREF = '/admin/launch'");
    expect(hero).toContain("SUBSCRIBE_TRACK = 'saas_subscribe_click'");
    expect(hero).toContain("DEMO_TRACK = 'view_live_demo_click'");
    expect(hero).toContain('barbershop_website_cost_hero');
    expect(hero).toContain('Get started — £');
    expect(hero).toContain('See live demo');
    expect(hero).toContain('href="#website-service-comparison"');
    expect(hero).toContain('SCROLL TO COMPARE');
    expect(offer).toContain('/admin/launch');
    expect(offer).toContain('saas_subscribe_click');
    expect(offer).toContain('barbershop_website_cost_full_offer');
    expect(faqClose).toContain('barbershop_website_cost_final');
    expect(ownership).toContain('underlying source code is not transferred');
  });

  it('uses scoped bwcost CSS tokens on design-system variables without hardcoded #FF1717', () => {
    expect(css).toContain('--bwcost-accent: var(--accent)');
    expect(css).toContain('var(--font-heading)');
    expect(css).not.toContain('#FF1717');
    expect(css).not.toContain('#ff1717');
    expect(css).not.toContain('.bwcost-anchor');
  });

  it('matches /booksy-alternative hero typography tokens on the cost hero only', () => {
    expect(css).toContain('.bwcost-hero__title');
    expect(css).toMatch(
      /\.bwcost-hero__title\s*\{[^}]*font-family:\s*var\(--font-body\)/s,
    );
    expect(css).toContain('clamp(2.85rem, 5.25vw, 5.55rem)');
    expect(css).toContain('font-weight: 650');
    expect(css).toContain('line-height: 0.84');
    expect(css).toContain('letter-spacing: -0.062em');
    expect(css).toContain('clamp(2.35rem, 10vw, 4.15rem)');
    expect(css).toContain('letter-spacing: -0.055em');
    expect(css).toContain('min(94vw, 91.1rem)');
    expect(css).toContain('.bwcost-hero__eyebrow');
    expect(css).toContain('font-size: 0.69rem');
    expect(css).toContain('letter-spacing: 0.08em');
  });
});

describe('/barbershop-website-cost-uk structured data', () => {
  it('emits WebPage and BreadcrumbList without FAQ/Review/Product stuffing', () => {
    const blocks = buildBarbershopWebsiteCostJsonLd();
    expect(blocks).toHaveLength(2);
    expect(blocks[0]['@type']).toBe('WebPage');
    expect(blocks[1]['@type']).toBe('BreadcrumbList');
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toMatch(/FAQPage|Review|AggregateRating|"Product"|"Offer"/);
    expect(page).toContain('jsonLd={buildBarbershopWebsiteCostJsonLd()}');
  });

  it('aligns BreadcrumbList with the visible three-step trail', () => {
    const siteUrl = getPublicSiteUrl();
    const breadcrumb = buildBarbershopWebsiteCostBreadcrumbJsonLd();
    const items = breadcrumb.itemListElement as Array<{ name: string; item: string; position: number }>;
    expect(items).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: BARBERSHOP_WEBSITE_COST_BREADCRUMB_PARENT,
        item: `${siteUrl}${BARBERSHOP_WEBSITES_PAGE_PATH}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: BARBERSHOP_WEBSITE_COST_BREADCRUMB_CURRENT,
        item: `${siteUrl}${BARBERSHOP_WEBSITE_COST_PAGE_PATH}`,
      },
    ]);
  });
});
