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
  COST_MODELS_EYEBROW,
  COST_MODELS_INSIGHT_BODY,
  COST_MODELS_INSIGHT_CTA_HREF,
  COST_MODELS_INSIGHT_IMAGE_SRC,
  COST_MODELS_INSIGHT_TITLE,
  COST_MODELS_SECTION_ID,
  COST_SCOPE_CARDS,
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
const offersData = read('./barbershopWebsiteCostComparisonOffers.ts');
const researchOffersData = read('./barbershopWebsiteCostOffers.ts');
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

  it('renders the six-provider website + booking comparison with delivery labels', () => {
    expect(WEBSITE_SERVICE_COMPARISON_SECTION_ID).toBe('website-service-comparison');
    expect(serviceComparison).toContain('getPrimaryWebsiteServiceComparisonOptions');
    expect(serviceComparison).toContain('01 / WEBSITE + BOOKING COMPARISON');
    expect(serviceComparison).toContain(
      'What does a complete barbershop website and booking setup actually cost?',
    );
    expect(serviceComparison).toContain('WEBSITE_SERVICE_COMPARISON_ASSUMPTION');
    expect(serviceComparison).toContain('bwcost-svc__delivery');
    expect(serviceComparison).toContain('bwcost-svc__title');
    expect(serviceComparison).not.toContain('bwcost-section__title');
    expect(serviceComparison).toContain('A website is only one part');
    expect(serviceComparison).toContain('See what affects the price');
    expect(serviceComparison).toContain('href={OPTIONS_HREF}');
    expect(serviceComparison).toContain("OPTIONS_HREF = '#cost-options'");
    expect(serviceComparison).not.toContain("SCENARIOS_HREF = '#cost-scenarios'");
    expect(serviceComparison).toContain('Explore KERSIVO');
    expect(serviceComparison).toContain('BARBERSHOP_WEBSITES_PAGE_PATH');
    expect(serviceComparison).toContain('Read the website delivery label first');
    expect(serviceComparison).toContain('Published offer');
    expect(serviceComparison).toContain('Scope snapshot');
    expect(serviceComparison).toContain('bwcost-svc__matrix');
    expect(WEBSITE_SERVICE_COMPARISON_PRIMARY_IDS).toEqual([
      'vagaro-pro-mysite',
      'fresha-team-smart-website',
      'nearcut-subscription',
      'setora',
      'uxhm-salon-growth-booksy',
      'full-kersivo',
    ]);
    const primary = getPrimaryWebsiteServiceComparisonOptions();
    expect(primary).toHaveLength(6);
    expect(primary.map((row) => row.name)).toEqual([
      'Vagaro Pro + MySite',
      'Fresha Team + Smart Website',
      'Nearcut Subscription',
      'Setora',
      'UXHM + Booksy',
      'Full KERSIVO',
    ]);
    expect(primary.filter((row) => row.emphasized)).toHaveLength(1);
    expect(primary[5]?.emphasized).toBe(true);
    expect(primary[5]?.priceFigure).toBe(`£${SAAS_MONTHLY_GBP}`);
    expect(primary[5]?.deliveryMethodKind).toBe('done-for-you');
    expect(primary[5]?.deliveryMethodLabel.toLowerCase()).toContain('done-for-you');
    expect(primary[0]?.priceFigure).toBe('£65');
    expect(primary[0]?.deliveryMethodKind).toBe('self-build');
    expect(primary[1]?.priceFigure).toBe('£52.75');
    expect(primary[1]?.priceFigureSecondary).toContain('£63.30');
    expect(primary[1]?.priceCaption.toLowerCase()).toContain('indicative');
    expect(primary[1]?.deliveryMethodKind).toBe('self-setup');
    expect(primary[2]?.priceFigure).toBe('Custom quote');
    expect(primary[2]?.pricingConfidence).toBe('custom-quote');
    expect(primary[2]?.pricePrimary.toLowerCase()).toContain('custom monthly quote');
    expect(primary[2]?.priceSecondary?.toLowerCase()).toContain('free for you');
    expect(primary[2]?.priceSecondary?.toLowerCase()).toContain('customer-fee');
    expect(primary[3]?.priceFigure).toBe('£59');
    expect(primary[3]?.pricingConfidence).toBe('conflict');
    expect(primary[3]?.priceSecondary).toContain('£39');
    expect(offersData).toContain("id: 'setora'");
    expect(offersData).toMatch(/conflicting £39/i);
    expect(researchOffersData).toContain('WEBSITE_COST_OFFERS');
    expect(researchOffersData).toContain('PRICE CONFLICT');
    expect(primary[4]?.priceFigure).toBe('£499');
    expect(primary[4]?.priceFigureSecondary).toContain('£66');
    expect(primary[4]?.deliveryMethodKind).toBe('done-for-you');
    expect(primary[4]?.scopeChips.map((c) => c.status)).toEqual([
      'included',
      'separate',
      'external',
      'not-confirmed',
    ]);
    expect(primary.every((row) => row.deliveryMethodLabel.length > 0)).toBe(true);
    expect(primary.every((row) => row.whatToCheckShort.length > 0)).toBe(true);
    expect(WEBSITE_SERVICE_COMPARISON_OPTIONS.length).toBeGreaterThanOrEqual(6);
    expect(WEBSITE_SERVICE_COMPARISON_OPTIONS.some((row) => row.id === 'jones-digital')).toBe(true);
    expect(offersData).toContain('https://www.vagaro.com/en-gb/pro/pricing');
    expect(offersData).toContain('https://www.fresha.com/en-GB/pricing');
    expect(offersData).toContain('https://www.setora.co.uk/pricing');
    expect(offersData).toContain('https://biz.booksy.com/en-gb/pricing');
    expect(offersData).toContain('Custom quote');
    expect(offersData).toContain('£39');
    expect(css).toContain('.bwcost-svc__table');
    expect(css).toContain('.bwcost-svc__delivery');
    expect(css).toContain('.bwcost-svc__delivery--self-build');
    expect(css).toContain('.bwcost-svc__delivery--done-for-you');
    expect(css).toContain('.bwcost-svc__matrix');
    expect(css).toContain('.bwcost-svc__matrix-item--not-confirmed');
    expect(css).not.toContain('.bwcost-svc__chip');
    expect(css).toContain('.bwcost-svc__table tbody .bwcost-svc__row--kersivo th');
    expect(css).toContain('.bwcost-svc__card--kersivo');
    expect(css).toContain('.bwcost-svc__mobile');
    expect(css).toContain('min(94vw, 91.1rem)');
    expect(css).toContain('@media (min-width: 1024px)');
  });

  it('rebuilds Section 03 with scope cards, model fit cards and four-chair insight', () => {
    expect(COST_MODELS_SECTION_ID).toBe('cost-options');
    expect(models).toContain('id={COST_MODELS_SECTION_ID}');
    expect(models).toContain('What are you actually paying for?');
    expect(models).toContain('COST_MODELS_EYEBROW');
    expect(models).toContain('COST_MODELS_INSIGHT_TITLE');
    expect(COST_MODELS_EYEBROW).toBe('KERSIVO / WHAT YOU GET');
    expect(COST_MODELS_INSIGHT_TITLE).toBe('What should a four-chair barbershop check?');
    expect(models).toContain('bwcost-models__scope');
    expect(models).toContain('bwcost-models__fit');
    expect(models).toContain('bwcost-models__insight');
    expect(models).toContain('row.badge');
    expect(models).not.toContain('{row.index}');
    expect(models).not.toContain('bwcost-models__fit-index');
    expect(models).toContain('COST_MODELS_INSIGHT_CTA_HREF');
    expect(models).toContain('COST_MODELS_INSIGHT_IMAGE_SRC');
    expect(COST_MODELS_INSIGHT_CTA_HREF).toBe('/barbershop-online-booking');
    expect(COST_MODELS_INSIGHT_IMAGE_SRC).toContain('four-chair-barbershop.webp');
    expect(COST_SCOPE_CARDS).toHaveLength(4);
    expect(COST_SCOPE_CARDS.map((card) => card.title)).toEqual([
      'Building the site',
      'Running the site',
      'Taking bookings & payments',
      'Control when leaving',
    ]);
    expect(COST_SCOPE_CARDS.every((card) => card.imageSrc.includes('/section-03/'))).toBe(true);
    expect(COST_SCOPE_CARDS.map((card) => card.imageSrc)).toEqual([
      '/images/barbershop-website-cost/section-03/building-the-site.webp',
      '/images/barbershop-website-cost/section-03/running-the-site.webp',
      '/images/barbershop-website-cost/section-03/taking-bookings-payments.webp',
      '/images/barbershop-website-cost/section-03/control-when-leaving.webp',
    ]);
    expect(COST_BUYING_MODELS).toHaveLength(4);
    expect(COST_BUYING_MODELS.map((row) => row.model)).toEqual([
      'DIY builder',
      'One-off project',
      'Managed website',
      'Integrated platform',
    ]);
    expect(COST_BUYING_MODELS[3]?.badge).toBe('WEBSITE + BOOKINGS');
    expect(COST_BUYING_MODELS[3]?.emphasized).toBe(true);
    expect(models).not.toContain("What's included — and what could cost extra?");
    expect(models).not.toContain('bwcost-table');
    expect(models).not.toContain('MOST COMPLETE');
    expect(models).not.toContain('No lock-in');
    expect(css).toContain('.bwcost-models__scope');
    expect(css).toContain('.bwcost-models__fit-card--accent');
    expect(css).toContain('--bwcost-models-surface');
    expect(css).toContain('background: var(--bwcost-models-surface)');
    expect(COST_MODELS_INSIGHT_BODY).toBe(
      'For a four-chair shop, check that clients can choose their barber and an available time — and whether confirmations and the shop diary cost extra.',
    );
    expect(COST_MODELS_INSIGHT_BODY).not.toContain('preferred barber');
    expect(css).toContain('--bwcost-models-display');
    expect(css).toMatch(
      /\.bwcost-models__inner\s*\{[^}]*width:\s*min\(94vw,\s*91\.1rem\)/s,
    );
    expect(css).toContain('.bwcost-models__scope-top .bwcost-models__index::after');
    expect(css).toContain('min-height: 11.5rem');
    expect(css).toContain('max-width: 13.2rem');
    expect(css).not.toContain('min-height: 17.5rem');
    expect(css).not.toContain('min-height: 14rem');
    expect(css).not.toContain('max-width: 17rem');
    expect(css).not.toContain('.bwcost-anatomy__list');
    expect(css).not.toContain('.bwcost-inset__title');
    const section03Dir = join(here, '../../../public/images/barbershop-website-cost/section-03');
    for (const file of [
      'building-the-site.webp',
      'running-the-site.webp',
      'taking-bookings-payments.webp',
      'control-when-leaving.webp',
      'four-chair-barbershop.webp',
    ]) {
      expect(existsSync(join(section03Dir, file))).toBe(true);
    }
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
