import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FRESHA_ALTERNATIVE_DESCRIPTION,
  FRESHA_ALTERNATIVE_FAQ_ITEMS,
  FRESHA_ALTERNATIVE_LAST_UPDATED_ISO,
  FRESHA_ALTERNATIVE_LAST_UPDATED_LABEL,
  FRESHA_ALTERNATIVE_PAGE_PATH,
  FRESHA_ALTERNATIVE_TITLE,
  buildFreshaAlternativeFaqJsonLd,
} from './freshaAlternativeFaq';
import {
  FRESHA_COST_ITEMS,
  FRESHA_FIT_PATHS,
  FRESHA_MARKETPLACE_FEE_EXAMPLE,
  FRESHA_MARKETPLACE_FEE_POINTS,
  FRESHA_QUICK_ANSWER,
  FRESHA_QUICK_ANSWER_DETAIL,
  FRESHA_QUICK_ANSWER_FACTS,
  FRESHA_QUICK_ANSWER_KICKER,
  FRESHA_QUICK_ANSWER_LEAD,
  FRESHA_QUICK_ANSWER_TITLE,
  FRESHA_SWITCHING_LIMITS,
  FRESHA_SWITCHING_REASSURANCE,
  FRESHA_SWITCHING_STEPS,
  FRESHA_WHY_THEMES,
  FRESHA_WORKED_EXAMPLES,
  FRESHA_WORKED_EXAMPLES_NOTE,
  KERSIVO_MODEL_POINTS,
} from './freshaAlternativeContent';
import { buildFreshaAlternativeWebPageJsonLd, buildFreshaAlternativeBreadcrumbJsonLd } from './freshaAlternativeJsonLd';
import {
  FRESHA_COMPARE_SECTIONS,
  FRESHA_COMPARISON_FOOTNOTE,
  FRESHA_FACTS_CHECKED_DATE,
  FRESHA_FACTS_CHECKED_ISO,
  FRESHA_SOURCES,
  FRESHA_TRADEMARK_DISCLAIMER,
  FRESHA_UK_COMMERCIAL_FACTS,
  type FreshaCommercialFactKey,
  estimateFreshaMarketplaceNewClientFee,
  estimateFreshaMonthlySubscription,
  isVerifiedCommercialFact,
  requireVerifiedFreshaFact,
} from './freshaFacts';
import { resolveCanonicalUrl } from './meta';
import { buildMarketingSitemapEntries } from './marketingSitemap';

const here = dirname(fileURLToPath(import.meta.url));

const repoRoot = join(here, '..', '..', '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const componentDir = '../../components/freshaAlternative';
const pageSource = readRepoFile('../../pages/fresha-alternative/index.astro');
const heroSource = readRepoFile(componentDir, 'FreshaHero.astro');
const compareSource = readRepoFile(componentDir, 'FreshaCompare.astro');
const pricingSource = readRepoFile(componentDir, 'FreshaPricing.astro');
const proofSource = readRepoFile(componentDir, 'FreshaProof.astro');
const finalCtaSource = readRepoFile(componentDir, 'FreshaFinalCta.astro');
const quickAnswerSource = readRepoFile(componentDir, 'FreshaQuickAnswer.astro');
const editorialIntroSource = readRepoFile('../../components/editorial/EditorialIntro.astro');
const editorialIntroCss = readRepoFile('../../styles/components/editorial-intro.css');
const insightCardsSource = readRepoFile('../../components/editorial/InsightCards.astro');
const insightIconSource = readRepoFile('../../components/editorial/InsightIcon.astro');
const insightCardsCss = readRepoFile('../../styles/components/insight-cards.css');
const whySource = readRepoFile(componentDir, 'FreshaWhy.astro');
const costsSource = readRepoFile(componentDir, 'FreshaCosts.astro');
const fitSource = readRepoFile(componentDir, 'FreshaFit.astro');
const switchingSource = readRepoFile(componentDir, 'FreshaSwitching.astro');
const sourcesSource = readRepoFile(componentDir, 'FreshaSources.astro');
const contactSource = readRepoFile('../../components/contact16.astro');
const booksyPageSource = readRepoFile('../../pages/booksy-alternative/index.astro');
const factsSource = readRepoFile('freshaFacts.ts');
const contentSource = readRepoFile('freshaAlternativeContent.ts');
const faqSource = readRepoFile('freshaAlternativeFaq.ts');

const newComponentSources = [
  quickAnswerSource,
  editorialIntroSource,
  insightCardsSource,
  whySource,
  costsSource,
  fitSource,
  switchingSource,
  sourcesSource,
];

const renderedContentCopy = [
  FRESHA_QUICK_ANSWER_KICKER,
  FRESHA_QUICK_ANSWER_TITLE,
  FRESHA_QUICK_ANSWER,
  ...FRESHA_QUICK_ANSWER_FACTS.map((fact) => `${fact.label} ${fact.value}`),
  ...FRESHA_WHY_THEMES.map((theme) => `${theme.title} ${theme.body}`),
  ...FRESHA_COST_ITEMS.flatMap((item) => [item.kicker, item.figure, item.unit, ...item.notes]),
  ...FRESHA_WORKED_EXAMPLES.map((row) => Object.values(row).join(' ')),
  FRESHA_WORKED_EXAMPLES_NOTE,
  ...KERSIVO_MODEL_POINTS,
  ...FRESHA_MARKETPLACE_FEE_POINTS,
  FRESHA_MARKETPLACE_FEE_EXAMPLE,
  ...FRESHA_FIT_PATHS.flatMap((path) => [path.heading, ...path.points]),
  FRESHA_SWITCHING_REASSURANCE,
  ...FRESHA_SWITCHING_STEPS.map((step) => `${step.title} ${step.body}`),
  ...FRESHA_SWITCHING_LIMITS,
  FRESHA_COMPARISON_FOOTNOTE,
  ...FRESHA_COMPARE_SECTIONS.flatMap((section) => [
    section.freshaLead,
    ...section.freshaPoints,
    section.kersivoLead,
    ...section.kersivoPoints,
  ]),
  ...FRESHA_ALTERNATIVE_FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`),
].join('\n');

const pageCorpus = [
  pageSource,
  heroSource,
  compareSource,
  pricingSource,
  proofSource,
  finalCtaSource,
  ...newComponentSources,
  factsSource,
  renderedContentCopy,
].join('\n');

describe('fresha-alternative page SEO foundation', () => {
  it('wires LandingLayout with central title, description, canonical and JSON-LD', () => {
    expect(pageSource).toContain('title={FRESHA_ALTERNATIVE_TITLE}');
    expect(pageSource).toContain('description={FRESHA_ALTERNATIVE_DESCRIPTION}');
    expect(pageSource).toContain('canonicalPath={FRESHA_ALTERNATIVE_PAGE_PATH}');
    expect(pageSource).toContain(
      'jsonLd={[buildFreshaAlternativeWebPageJsonLd(), buildFreshaAlternativeBreadcrumbJsonLd(), buildFreshaAlternativeFaqJsonLd()]}',
    );
    expect(pageSource).not.toContain('noindex');
    expect(FRESHA_ALTERNATIVE_PAGE_PATH).toBe('/fresha-alternative');
    expect(FRESHA_ALTERNATIVE_TITLE).toBe('Fresha Alternative for UK Barbershops | KERSIVO');
    expect(resolveCanonicalUrl(FRESHA_ALTERNATIVE_PAGE_PATH)).toBe(
      'https://kersivo.co.uk/fresha-alternative',
    );
  });

  it('keeps the title and meta description within normal SERP lengths and on intent', () => {
    expect(FRESHA_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(60);
    expect(FRESHA_ALTERNATIVE_DESCRIPTION.length).toBeGreaterThanOrEqual(110);
    expect(FRESHA_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(FRESHA_ALTERNATIVE_DESCRIPTION).toBe(
      'Looking for a Fresha alternative in the UK? Compare KERSIVO and Fresha pricing, fees, branding, bookings and switching for independent barbershops.',
    );
    expect(FRESHA_ALTERNATIVE_DESCRIPTION).toContain('Fresha alternative');
    expect(FRESHA_ALTERNATIVE_DESCRIPTION.match(/Fresha/g)?.length).toBeLessThanOrEqual(2);
  });

  it('keeps exactly one H1 in the hero with the approved text', () => {
    expect(heroSource.match(/<h1\b/g)?.length).toBe(1);
    for (const source of [pageSource, ...newComponentSources]) {
      expect(source).not.toMatch(/<h1\b/);
    }
    const h1Text = heroSource
      .slice(heroSource.indexOf('<h1'), heroSource.indexOf('</h1>'))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(h1Text).toContain('A Fresha alternative built around your barbershop.');
  });

  it('renders the content sections in the agreed order', () => {
    const order = [
      '<FreshaHero',
      '<FreshaQuickAnswer',
      '<FreshaWhy',
      '<FreshaCosts',
      '<FreshaCompare',
      '<FreshaProof',
      '<FreshaFit',
      '<FreshaSwitching',
      '<FreshaPricing',
      '<Faq4',
      '<FreshaFinalCta',
      '<Contact16',
      '<FreshaSources',
      '<Footer50',
    ].map((tag) => pageSource.indexOf(tag));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('shows a concise Quick Answer directly after the hero', () => {
    expect(quickAnswerSource).toContain('lead={FRESHA_QUICK_ANSWER_LEAD}');
    expect(quickAnswerSource).toContain('detail={FRESHA_QUICK_ANSWER_DETAIL}');
    expect(quickAnswerSource).toContain('facts={FRESHA_QUICK_ANSWER_FACTS}');
    expect(quickAnswerSource).toContain('id="quick-answer"');
    expect(FRESHA_QUICK_ANSWER).toBe(`${FRESHA_QUICK_ANSWER_LEAD} ${FRESHA_QUICK_ANSWER_DETAIL}`);
    const words = FRESHA_QUICK_ANSWER.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(60);
    expect(words).toBeLessThanOrEqual(110);
    expect(FRESHA_QUICK_ANSWER_LEAD).toContain('Fresha alternative');
    expect(FRESHA_QUICK_ANSWER_LEAD).toContain('UK barbershops');
    expect(FRESHA_QUICK_ANSWER_LEAD).toContain('Stripe processing fees still apply');
    expect(FRESHA_QUICK_ANSWER_DETAIL).toMatch(/^Fresha follows a different model/);
  });

  it('presents the Quick Answer as an editorial intro with a real H2 and a fact list', () => {
    expect(FRESHA_QUICK_ANSWER_TITLE).toBe('A Fresha alternative built around your own brand.');
    expect(FRESHA_QUICK_ANSWER_TITLE.toLowerCase()).not.toMatch(/\b(best|better|cheaper)\b/);
    expect(FRESHA_QUICK_ANSWER_KICKER).toBe('The short version');

    expect(editorialIntroSource).toMatch(/<section\b[^>]*aria-labelledby=\{titleId\}/);
    expect(editorialIntroSource).toMatch(/<h2 id=\{titleId\}/);
    expect(editorialIntroSource).toContain('<dl class="editorial-intro__facts">');
    expect(editorialIntroSource).toContain('<dt>{fact.label}</dt>');
    expect(editorialIntroSource).toContain('<dd>{fact.value}</dd>');
    expect(editorialIntroSource).not.toMatch(/fresha/i);
  });

  it('renders the four Why themes as reusable insight cards with a distinct topic icon each', () => {
    expect(whySource).toContain('<InsightCards items={FRESHA_WHY_THEMES} />');
    expect(FRESHA_WHY_THEMES).toHaveLength(4);
    expect(FRESHA_WHY_THEMES.map((theme) => theme.icon)).toEqual([
      'seats',
      'storefront',
      'discovery',
      'stack',
    ]);
    for (const icon of ['seats', 'storefront', 'discovery', 'stack']) {
      expect(insightIconSource).toContain(`name === '${icon}'`);
    }
    expect(insightIconSource).toContain('aria-hidden="true"');
    expect(insightCardsSource).toContain('<h3 class="insight-card__title">{item.title}</h3>');
    expect(insightCardsSource).toContain('<p class="insight-card__body">{item.body}</p>');
    for (const source of [insightCardsSource, insightIconSource, insightCardsCss]) {
      expect(source).not.toMatch(/fresha/i);
    }
  });

  it('balances uneven insight-card rows by width instead of padding', () => {
    expect(insightCardsSource).toContain('const UNEVEN_ROW_RATIO = 1.3;');
    expect(insightCardsSource).toContain("`insight-card--${widths[index]}`");
    expect(insightCardsCss).toMatch(/\.insight-card--wide \{\s*grid-column: span 7;/);
    expect(insightCardsCss).toMatch(/\.insight-card--narrow \{\s*grid-column: span 5;/);
    expect(insightCardsCss).not.toMatch(/min-height/);
    const words = FRESHA_WHY_THEMES.map((theme) => theme.body.split(/\s+/).length);
    expect(words[2]).toBeGreaterThanOrEqual(words[3] * 1.3);
    expect(Math.max(words[0], words[1])).toBeLessThan(Math.min(words[0], words[1]) * 1.3);
  });

  it('renders the two models through the reusable model comparison with aligned summaries', () => {
    const modelComparisonSource = readRepoFile('../../components/editorial/ModelComparison.astro');
    const modelComparisonCss = readRepoFile('../../styles/components/model-comparison.css');
    expect(fitSource).toContain('<ModelComparison');
    expect(fitSource).toContain('conclusion={FRESHA_FIT_CLOSING}');
    expect(FRESHA_FIT_PATHS.map((path) => path.icon)).toEqual(['network', 'direct']);
    const summaryLabels = FRESHA_FIT_PATHS.map((path) => path.summary?.map((row) => row.label));
    expect(summaryLabels[0]).toEqual(summaryLabels[1]);
    expect(modelComparisonSource).toMatch(/<h3 id=\{`\$\{idPrefix\}-\$\{index\}-title`\}/);
    expect(modelComparisonSource).toContain('aria-hidden="true"');
    for (const source of [modelComparisonSource, modelComparisonCss]) {
      expect(source).not.toMatch(/fresha|\bvs\b|winner/i);
    }
  });

  it('renders the migration steps as one vertical, scroll-revealed process timeline', () => {
    const timelineSource = readRepoFile('../../components/editorial/ProcessTimeline.astro');
    const timelineCss = readRepoFile('../../styles/components/process-timeline.css');
    expect(switchingSource).toContain('<ProcessTimeline');
    expect(switchingSource).toContain('steps={FRESHA_SWITCHING_STEPS}');
    expect(switchingSource).toContain('<a href="#contact">Ask about moving your Fresha data');
    expect(timelineSource).toContain('<ol class="process-timeline__steps">');
    expect(timelineSource).toContain('<h3 class="process-timeline__title">');
    expect(timelineSource).toMatch(/process-timeline__node" aria-hidden="true"/);
    expect(timelineSource).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(timelineCss).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*\.process-timeline\.is-enhanced \.process-timeline__step \{/,
    );
    expect(timelineCss).not.toMatch(/dashed|@keyframes|animation|scale\(/);
    for (const source of [timelineSource, timelineCss]) {
      expect(source).not.toMatch(/fresha|kersivo|\bvs\b/i);
    }
    expect(readRepoFile('../../styles/components/fresha-alternative.css')).not.toMatch(
      /fresha-alt-switching__(steps|step|limits|cta)\b/,
    );
  });

  it('keeps insight card text visible without hover and motion opt-out', () => {
    expect(insightCardsCss).not.toMatch(/opacity:\s*0|display:\s*none|visibility:\s*hidden/);
    expect(insightCardsCss).not.toMatch(/@keyframes|animation/);
    expect(insightCardsCss).toContain('@media (hover: hover) and (pointer: fine)');
    expect(insightCardsCss).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('styles the editorial intro on the page canvas rather than as a card', () => {
    expect(editorialIntroCss).not.toMatch(/border-radius|box-shadow|gradient|animation|transition/);
    expect(editorialIntroCss).not.toMatch(/background:(?!\s*var\(--accent\);)/);
    expect(editorialIntroCss).not.toMatch(/border-left:\s*2px/);
    expect(readRepoFile('../../styles/components/fresha-alternative.css')).not.toContain(
      '.fresha-alt-quick',
    );
  });

  it('includes the required H2 sections', () => {
    const corpus = newComponentSources.join('\n').replace(/\s+/g, ' ');
    for (const heading of [
      'Why UK barbers look for a Fresha alternative',
      'Fresha pricing and fees for UK barbers',
      'Which model fits your barbershop?',
      'Switching from Fresha to KERSIVO',
      'Sources &amp; comparison notes',
    ]) {
      expect(corpus).toContain(heading);
    }
  });

  it('contains no draft or placeholder copy', () => {
    const lower = pageCorpus.toLowerCase();
    for (const phrase of [
      'next research pass',
      'will be verified',
      'before this page is launched',
      'launch-ready',
      'a first look at the kersivo model',
      'lorem ipsum',
      'todo',
      'tbd',
    ]) {
      expect(lower).not.toContain(phrase);
    }
  });

  it('renders the visible FAQ from the same data used for FAQPage JSON-LD', () => {
    expect(pageSource).toContain('faqs={FRESHA_ALTERNATIVE_FAQ_ITEMS}');
    expect(FRESHA_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(9);
    expect(FRESHA_ALTERNATIVE_FAQ_ITEMS.length).toBeLessThanOrEqual(10);

    const faqLd = buildFreshaAlternativeFaqJsonLd();
    expect(faqLd['@type']).toBe('FAQPage');
    expect(faqLd['@id']).toBe('https://kersivo.co.uk/fresha-alternative#faq');

    const entities = faqLd.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(entities).toHaveLength(FRESHA_ALTERNATIVE_FAQ_ITEMS.length);
    FRESHA_ALTERNATIVE_FAQ_ITEMS.forEach((item, index) => {
      expect(entities[index].name).toBe(item.question);
      expect(entities[index].acceptedAnswer.text).toBe(item.answer);
    });

    const questions = new Set(FRESHA_ALTERNATIVE_FAQ_ITEMS.map((item) => item.question));
    expect(questions.size).toBe(FRESHA_ALTERNATIVE_FAQ_ITEMS.length);
  });

  it('WebPage JSON-LD matches canonical and sitemap with no rating or review markup', () => {
    const webPage = buildFreshaAlternativeWebPageJsonLd();
    const canonical = resolveCanonicalUrl(FRESHA_ALTERNATIVE_PAGE_PATH);
    const sitemapEntry = buildMarketingSitemapEntries().find((entry) =>
      entry.loc.endsWith('/fresha-alternative'),
    );

    expect(webPage['@type']).toBe('WebPage');
    expect(webPage['@id']).toBe('https://kersivo.co.uk/fresha-alternative#webpage');
    expect(webPage.url).toBe(canonical);
    expect(webPage.url).toBe(sitemapEntry?.loc);
    expect(webPage.name).toBe(FRESHA_ALTERNATIVE_TITLE);
    expect(webPage.description).toBe(FRESHA_ALTERNATIVE_DESCRIPTION);
    expect(webPage.dateModified).toBe(FRESHA_ALTERNATIVE_LAST_UPDATED_ISO);
    expect(sitemapEntry?.lastmod).toBe(FRESHA_ALTERNATIVE_LAST_UPDATED_ISO);

    const serialized = JSON.stringify([webPage, buildFreshaAlternativeFaqJsonLd()]);
    for (const banned of ['aggregateRating', 'AggregateRating', 'reviewCount', '"Review"', 'SoftwareApplication']) {
      expect(serialized).not.toContain(banned);
    }
  });

  it('adds a BreadcrumbList that exactly mirrors visible Home / Fresha alternative navigation', () => {
    expect(heroSource).toContain('aria-label="Breadcrumb"');
    expect(heroSource).toContain('<a href="/">Home</a>');
    expect(heroSource).toContain('aria-current="page">Fresha alternative</span>');
    expect((heroSource.match(/aria-label="Breadcrumb"/g) ?? [])).toHaveLength(1);
    expect(pageSource).toContain('buildFreshaAlternativeBreadcrumbJsonLd()');

    const breadcrumb = buildFreshaAlternativeBreadcrumbJsonLd();
    const pageUrl = resolveCanonicalUrl(FRESHA_ALTERNATIVE_PAGE_PATH);
    expect(breadcrumb['@context']).toBe('https://schema.org');
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect(breadcrumb['@id']).toBe(`${pageUrl}#breadcrumb`);
    expect(breadcrumb.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://kersivo.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Fresha alternative', item: pageUrl },
    ]);
    expect(buildFreshaAlternativeWebPageJsonLd().breadcrumb).toEqual({ '@id': breadcrumb['@id'] });
  });

  it('lists /fresha-alternative exactly once in the sitemap with the visible last-updated date', () => {
    const matches = buildMarketingSitemapEntries().filter(
      (entry) => entry.loc === 'https://kersivo.co.uk/fresha-alternative',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].lastmod).toBe('2026-10-06');
    expect(FRESHA_ALTERNATIVE_LAST_UPDATED_ISO).toBe('2026-10-06');
    expect(FRESHA_ALTERNATIVE_LAST_UPDATED_LABEL).toBe('6 October 2026');
    expect(sourcesSource).toContain('FRESHA_ALTERNATIVE_LAST_UPDATED_LABEL');
    expect(sourcesSource).toContain('datetime={FRESHA_ALTERNATIVE_LAST_UPDATED_ISO}');
  });

  it('contains no fake reviews, ratings or testimonials', () => {
    const lower = pageCorpus.toLowerCase();
    for (const phrase of ['aggregaterating', 'reviewcount', '★', 'stars from', 'rated 4', 'rated 5', 'trustpilot']) {
      expect(lower).not.toContain(phrase);
    }
  });
});

describe('fresha facts verification', () => {
  const verifiedEntries = Object.entries(FRESHA_UK_COMMERCIAL_FACTS).filter(([, fact]) =>
    isVerifiedCommercialFact(fact),
  );

  it('records a checked date only alongside official Fresha sources', () => {
    expect(FRESHA_SOURCES.length).toBeGreaterThan(0);
    expect(FRESHA_FACTS_CHECKED_DATE).toBe('30 September 2026');
    expect(FRESHA_FACTS_CHECKED_ISO).toBe('2026-09-30');
    for (const source of FRESHA_SOURCES) {
      expect(source.url).toMatch(/^https:\/\/www\.fresha\.com\//);
    }
    const ids = FRESHA_SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ties every verified fact to an official source and the checked date', () => {
    expect(verifiedEntries.length).toBeGreaterThan(0);
    const sourceIds = new Set(FRESHA_SOURCES.map((source) => source.id));
    for (const [, fact] of verifiedEntries) {
      if (!isVerifiedCommercialFact(fact)) continue;
      expect(sourceIds.has(fact.sourceId)).toBe(true);
      expect(fact.checkedIso).toBe(FRESHA_FACTS_CHECKED_ISO);
    }
  });

  it('takes UK prices from the UK pricing page', () => {
    const pricing = FRESHA_SOURCES.find((source) => source.id === 'pricingUk');
    expect(pricing?.url).toBe('https://www.fresha.com/en-GB/pricing');
  });

  it('refuses to render unresolved facts', () => {
    const unresolved = Object.entries(FRESHA_UK_COMMERCIAL_FACTS).filter(
      ([, fact]) => !isVerifiedCommercialFact(fact),
    );
    expect(unresolved.length).toBeGreaterThan(0);
    for (const [key] of unresolved) {
      expect(() => requireVerifiedFreshaFact(key as FreshaCommercialFactKey)).toThrow();
    }
  });

  it('keeps Fresha figures out of hand-written copy', () => {
    for (const source of [contentSource, faqSource, ...newComponentSources]) {
      expect(source).not.toMatch(/£\s?\d/);
      expect(source).not.toMatch(/(?<![\d.])(?!0%)\d+(\.\d+)?\s?%/);
    }
  });

  it('computes worked subscription examples from verified values', () => {
    expect(estimateFreshaMonthlySubscription(1)).toMatchObject({
      plan: 'Independent',
      exVatGbp: 14.95,
      incVatGbp: 17.94,
    });
    expect(estimateFreshaMonthlySubscription(3)).toMatchObject({
      plan: 'Team',
      exVatGbp: 29.85,
      incVatGbp: 35.82,
    });
    expect(estimateFreshaMonthlySubscription(5)).toMatchObject({
      plan: 'Team',
      exVatGbp: 49.75,
      incVatGbp: 59.7,
    });
    expect(FRESHA_WORKED_EXAMPLES.map((row) => row.freshaIncVat)).toEqual([
      '£17.94',
      '£35.82',
      '£59.70',
    ]);
    expect(FRESHA_WORKED_EXAMPLES.map((row) => row.kersivo)).toEqual([
      '£0 Starter or £39 Full',
      '£0 Starter or £39 Full',
      '£39 Full',
    ]);
  });

  it('describes the Marketplace fee as one-time for brand-new Marketplace clients', () => {
    expect(estimateFreshaMarketplaceNewClientFee(25)).toBe(5);
    expect(estimateFreshaMarketplaceNewClientFee(15)).toBe(4);
    const marketplaceCopy = FRESHA_MARKETPLACE_FEE_POINTS.join(' ');
    expect(marketplaceCopy).toContain('one-time');
    expect(marketplaceCopy).toContain('Returning clients never trigger it');
    expect(marketplaceCopy).toContain('Fresha tracks each client’s source');
  });
});

describe('fresha claim safety', () => {
  it('avoids prohibited KERSIVO and Fresha claims', () => {
    const lower = pageCorpus.toLowerCase();
    for (const phrase of [
      '£39 forever',
      'one plan. one barbershop location',
      'unlimited sms',
      'no fees whatsoever',
      'guaranteed more bookings',
      'guaranteed more customers',
      'guaranteed revenue',
      'guaranteed no-show reduction',
      'complete migration guaranteed',
      'guaranteed uptime',
      'fully bespoke',
      'custom-built website',
      '20% of all bookings',
      'commission on every booking',
      'clients must download',
      'the best fresha alternative is kersivo',
    ]) {
      expect(lower).not.toContain(phrase);
    }
    expect(lower).not.toMatch(/(?<![a-z])no fees(?![a-z-])/);
  });

  it('keeps the approved migration wording and card-data limit', () => {
    const switching = FRESHA_SWITCHING_STEPS.map((step) => step.body).join(' ');
    expect(switching).toContain(
      'We’ll help migrate the usable business data available from your current booking system, including supported CSV exports.',
    );
    expect(FRESHA_SWITCHING_REASSURANCE).toBe('Keep Fresha live while your KERSIVO setup is prepared.');
    expect(FRESHA_SWITCHING_LIMITS.join(' ')).toContain('cannot be exported');
  });

  it('shows the trademark disclaimer and visible source links', () => {
    expect(pageSource).toContain('<FreshaSources');
    expect(sourcesSource).toContain('{FRESHA_TRADEMARK_DISCLAIMER}');
    expect(sourcesSource).toContain('FRESHA_SOURCES.map');
    expect(sourcesSource).toContain('rel="noopener noreferrer"');
    expect(sourcesSource).not.toContain('nofollow');
    expect(sourcesSource).toContain('{source.label}');
    expect(sourcesSource).toContain('{source.supports}');
    expect(sourcesSource).not.toContain('{source.url}</');
    expect(sourcesSource).toContain('datetime={FRESHA_FACTS_CHECKED_ISO}');
    expect(sourcesSource).toContain('Pricing and product features can change');
    for (const source of FRESHA_SOURCES) {
      expect(source.supports.length).toBeGreaterThan(5);
    }
    expect(FRESHA_TRADEMARK_DISCLAIMER).toBe(
      'Fresha is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Fresha.',
    );
  });

  it('comparison component reads Fresha facts from the central module', () => {
    expect(compareSource).toContain('FRESHA_COMPARE_SECTIONS');
    expect(compareSource).toContain('FRESHA_COMPARISON_FOOTNOTE');
    expect(compareSource).not.toContain('freshaPoints: [');
  });
});

describe('comparison cluster internal links', () => {
  const homepageSource = readRepoFile('../../pages/index.astro');
  const switcherSource = readRepoFile('../../components/landingSwitcherReassurance.astro');
  const booksyFitSource = readRepoFile('../../components/booksyAlternative/BooksyFit.astro');

  function countLinks(source: string, href: string): number {
    return source.split(`href="${href}"`).length - 1;
  }

  it('links the homepage switching section to /fresha-alternative with a crawlable anchor', () => {
    expect(homepageSource).toContain(
      '<LandingSwitcherReassurance showBooksyCompareLink showFreshaCompareLink />',
    );
    expect(switcherSource).toContain('showFreshaCompareLink');
    expect(countLinks(switcherSource, '/fresha-alternative')).toBe(1);
    expect(switcherSource).toContain('Compare KERSIVO and Fresha');
  });

  it('links /booksy-alternative to /fresha-alternative once, from the fit section', () => {
    expect(countLinks(booksyFitSource, '/fresha-alternative')).toBe(1);
    expect(booksyFitSource).toContain('Also comparing Fresha?');
    expect(booksyFitSource).toContain('Compare KERSIVO and Fresha');
    expect(countLinks(booksyPageSource, '/fresha-alternative')).toBe(0);
  });

  it('links /fresha-alternative to /booksy-alternative exactly once, from the fit section', () => {
    expect(countLinks(fitSource, '/booksy-alternative')).toBe(1);
    expect(fitSource).toContain('Also comparing Booksy?');
    expect(fitSource).toContain('Compare KERSIVO and Booksy');
    const otherSources = [
      pageSource,
      heroSource,
      compareSource,
      pricingSource,
      proofSource,
      finalCtaSource,
      quickAnswerSource,
      whySource,
      costsSource,
      switchingSource,
      sourcesSource,
    ];
    for (const source of otherSources) {
      expect(countLinks(source, '/booksy-alternative')).toBe(0);
    }
  });

  it('links to the cost calculator exactly once, from the costs section, with a descriptive anchor', () => {
    expect(countLinks(costsSource, '/barber-software-cost-calculator')).toBe(1);
    expect(costsSource).toMatch(
      /<a href="\/barber-software-cost-calculator">\s*Barber Software Cost Calculator\s*<\/a>/,
    );
    expect(costsSource.indexOf('/barber-software-cost-calculator')).toBeGreaterThan(
      costsSource.indexOf('{FRESHA_WORKED_EXAMPLES_NOTE}'),
    );
    const otherSources = [
      pageSource,
      heroSource,
      compareSource,
      pricingSource,
      proofSource,
      finalCtaSource,
      quickAnswerSource,
      whySource,
      fitSource,
      switchingSource,
      sourcesSource,
      faqSource,
      contentSource,
    ];
    for (const source of otherSources) {
      expect(source).not.toContain('/barber-software-cost-calculator');
    }
    for (const source of [costsSource, ...otherSources]) {
      expect(source).not.toContain('/barber-booking-software-cost-calculator');
    }
  });

  it('links to the /compare hub only through the shared CompareHubLink component', () => {
    expect(pageSource).toContain('<CompareHubLink />');
    expect(pageSource.indexOf('<CompareHubLink />')).toBeLessThan(pageSource.indexOf('<FreshaSources />'));
    for (const source of [pageSource, ...newComponentSources, booksyFitSource, switcherSource]) {
      expect(source).not.toMatch(/href="\/compare/);
    }
  });
});

describe('contact form placeholder', () => {
  it('uses neutral wording by default and page-specific wording on comparison pages', () => {
    expect(contactSource).toContain('placeholder={messagePlaceholder}');
    expect(contactSource).not.toContain('placeholder="For example: switching from Booksy');
    expect(pageSource).toContain('messagePlaceholder="For example: switching from Fresha');
    expect(booksyPageSource).toContain('messagePlaceholder="For example: switching from Booksy');
  });
});

describe('hero dashboard showcase', () => {
  const showcaseSource = readRepoFile('../../components/marketing/HeroDashboardShowcase.astro');
  const heroCss = readRepoFile('../../styles/components/fresha-alternative.css');

  it('renders the shared live dashboard showcase below the hero copy', () => {
    expect(heroSource).toContain("import HeroDashboardShowcase from '@/components/marketing/HeroDashboardShowcase.astro';");
    expect(heroSource.indexOf('<HeroDashboardShowcase />')).toBeGreaterThan(heroSource.indexOf('fresha-alt-hero__meta'));
    expect(heroSource.indexOf('<HeroDashboardShowcase />')).toBeLessThan(heroSource.indexOf('</section>'));
    expect(showcaseSource).toContain('data-deferred-src="/demo/admin?embed=hero&section=bookings_dashboard"');
  });

  it('keeps no page-specific copy of the showcase markup, styles or loader', () => {
    expect(heroSource).not.toMatch(/<iframe|<script|data-deferred-demo-frame|mountDeferredDemoFrame/);
    expect(heroSource).not.toMatch(/poster|dashboard-showcase-v2|\.webp|fetchpriority/i);
    expect(heroCss).not.toMatch(/fresha-alt-hero__product-|fresha-admin-demo-max-width|freshaAltProductIn|product-poster/);
    expect(existsSync(join(repoRoot, 'public/images/fresha-alternative'))).toBe(false);
    expect(existsSync(join(repoRoot, 'scripts/capture-fresha-dashboard-posters.mjs'))).toBe(false);
  });

  it('keeps the black hero background the showcase loads into', () => {
    expect(heroCss).toMatch(/^\.fresha-alt-hero \{[^}]*background: #030303;/m);
  });

  it('lets touch scrolling chain from the fixed hero showcase to the landing page', () => {
    const adminPage = readRepoFile('../../pages/demo/admin.astro');
    expect(adminPage).toMatch(
      /body\.admin-hero-embed-body,\s*body\.admin-hero-embed-body \* \{\s*overscroll-behavior: auto !important;\s*\}/,
    );
    expect(adminPage).not.toMatch(/overscroll-behavior(?:-y)?: none/);
  });

  it('pins the BLACKLINE lockup to the sidebar left edge in the hero showcase', () => {
    const adminPage = readRepoFile('../../pages/demo/admin.astro');
    expect(adminPage).toMatch(
      /body\.admin-hero-embed-body\s+\.admin-shell--showcase\s+> \.admin-sidebar\s+> \.admin-sidebar-brand--blackline \{[^}]*justify-self: stretch;[^}]*width: 100%;[^}]*align-items: flex-start;[^}]*justify-content: flex-start;/,
    );
    expect(adminPage).toMatch(
      /> \.admin-sidebar-brand--blackline\s+\.bl-lockup \{\s*align-self: flex-start;\s*margin-inline: 0 auto;/,
    );
  });
});

describe('fresha-alternative: v1.18 Starter / Full distinction', () => {
  const sentences = renderedContentCopy.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);

  it('never presents KERSIVO as one paid plan for one location', () => {
    expect(pricingSource).not.toContain('One plan. One barbershop location.');
    expect(pricingSource).toContain('KERSIVO Starter');
    expect(pricingSource).toContain('Full KERSIVO');
  });

  it('scopes unlimited barbers, branded site, own domain and Retail to Full KERSIVO', () => {
    for (const sentence of sentences.filter((s) => /unlimited barbers/i.test(s))) {
      expect(sentence, sentence).toMatch(/Full/);
    }
    for (const sentence of sentences.filter((s) => !s.endsWith('?') && /\b(own domain|standard domain)\b/i.test(s))) {
      expect(sentence, sentence).toMatch(/Full|Starter/);
    }
  });
});