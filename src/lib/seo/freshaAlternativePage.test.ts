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
  FRESHA_ESTIMATOR_CONFIG,
  FRESHA_ESTIMATOR_NOTE,
  FRESHA_FIT_PATHS,
  FRESHA_HERO_FACTS,
  FRESHA_HERO_LEAD,
  FRESHA_HERO_TITLE_LINES,
  FRESHA_JOURNEY_ACTS,
  FRESHA_MARKETPLACE_FEE_EXAMPLE,
  FRESHA_MARKETPLACE_FEE_POINTS,
  FRESHA_OUTCOMES,
  FRESHA_OUTCOMES_INTRO,
  FRESHA_REASONS,
  FRESHA_REASONS_INTRO,
  FRESHA_SWITCHING_LIMITS,
  FRESHA_SWITCHING_REASSURANCE,
  FRESHA_SWITCHING_STEPS,
  FRESHA_SWITCHING_TITLE,
  FRESHA_VERDICT,
  FRESHA_VERDICT_DETAIL,
  FRESHA_VERDICT_FACTS,
  FRESHA_VERDICT_FIT,
  FRESHA_VERDICT_KICKER,
  FRESHA_VERDICT_LEAD,
  FRESHA_VERDICT_TITLE,
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
const verdictSource = readRepoFile(componentDir, 'FreshaVerdict.astro');
const reasonsSource = readRepoFile(componentDir, 'FreshaReasons.astro');
const reasonVisualSource = readRepoFile(componentDir, 'FreshaReasonVisual.astro');
const outcomesSource = readRepoFile(componentDir, 'FreshaOutcomes.astro');
const railSource = readRepoFile(componentDir, 'FreshaJourneyRail.astro');
const compareSource = readRepoFile(componentDir, 'FreshaCompare.astro');
const pricingSource = readRepoFile(componentDir, 'FreshaPricing.astro');
const finalCtaSource = readRepoFile('../../components/comparison/ComparisonFinalCta.astro');
const costsSource = readRepoFile(componentDir, 'FreshaCosts.astro');
const fitSource = readRepoFile(componentDir, 'FreshaFit.astro');
const switchingSource = readRepoFile(componentDir, 'FreshaSwitching.astro');
const sourcesSource = readRepoFile(componentDir, 'FreshaSources.astro');
const contactSource = readRepoFile('../../components/contact16.astro');
const booksyPageSource = readRepoFile('../../pages/booksy-alternative/index.astro');
const journeyCss = readRepoFile('../../styles/components/fresha-journey.css');
const journeyScript = readRepoFile('../landing/freshaJourney.ts');
const factsSource = readRepoFile('freshaFacts.ts');
const contentSource = readRepoFile('freshaAlternativeContent.ts');
const faqSource = readRepoFile('freshaAlternativeFaq.ts');

/** Components written for the journey page (shared components are checked on their own). */
const newComponentSources = [
  verdictSource,
  reasonsSource,
  reasonVisualSource,
  costsSource,
  outcomesSource,
  railSource,
  fitSource,
  switchingSource,
  sourcesSource,
];

const renderedContentCopy = [
  ...FRESHA_HERO_TITLE_LINES,
  FRESHA_HERO_LEAD,
  ...FRESHA_HERO_FACTS,
  FRESHA_VERDICT_KICKER,
  FRESHA_VERDICT_TITLE,
  FRESHA_VERDICT,
  ...FRESHA_VERDICT_FACTS.map((fact) => `${fact.label} ${fact.value}`),
  ...FRESHA_VERDICT_FIT.flatMap((group) => [group.label, ...group.points]),
  FRESHA_REASONS_INTRO,
  ...FRESHA_REASONS.flatMap((reason) => [reason.kicker, reason.title, reason.body, reason.kersivo]),
  ...FRESHA_COST_ITEMS.flatMap((item) => [item.kicker, item.figure, item.unit, ...item.notes]),
  FRESHA_ESTIMATOR_NOTE,
  ...FRESHA_WORKED_EXAMPLES.map((row) => Object.values(row).join(' ')),
  FRESHA_WORKED_EXAMPLES_NOTE,
  ...KERSIVO_MODEL_POINTS,
  ...FRESHA_MARKETPLACE_FEE_POINTS,
  FRESHA_MARKETPLACE_FEE_EXAMPLE,
  FRESHA_OUTCOMES_INTRO,
  ...FRESHA_OUTCOMES.map((outcome) => `${outcome.title} ${outcome.body}`),
  ...FRESHA_FIT_PATHS.flatMap((path) => [path.heading, ...path.points]),
  FRESHA_SWITCHING_TITLE,
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
  finalCtaSource,
  ...newComponentSources,
  factsSource,
  renderedContentCopy,
].join('\n');

const textOf = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

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
    expect(FRESHA_ALTERNATIVE_TITLE).toBe('Fresha Alternative UK: Keep Your Clients & Brand | KERSIVO');
    expect(resolveCanonicalUrl(FRESHA_ALTERNATIVE_PAGE_PATH)).toBe(
      'https://kersivo.co.uk/fresha-alternative',
    );
  });

  it('keeps the title and meta description within normal SERP lengths and on intent', () => {
    expect(FRESHA_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(60);
    expect(FRESHA_ALTERNATIVE_TITLE.startsWith('Fresha Alternative UK')).toBe(true);
    expect(FRESHA_ALTERNATIVE_DESCRIPTION.length).toBeGreaterThanOrEqual(110);
    expect(FRESHA_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(FRESHA_ALTERNATIVE_DESCRIPTION).toBe(
      'Looking for a Fresha alternative? KERSIVO gives UK barbershops their own booking website, flat pricing and 0% KERSIVO commission (Stripe fees apply).',
    );
    expect(FRESHA_ALTERNATIVE_DESCRIPTION).toContain('Fresha alternative');
    expect(FRESHA_ALTERNATIVE_DESCRIPTION.match(/Fresha/g)?.length).toBeLessThanOrEqual(2);
  });

  it('keeps exactly one H1 in the hero with the approved text', () => {
    expect(heroSource.match(/<h1\b/g)?.length).toBe(1);
    for (const source of [pageSource, ...newComponentSources]) {
      expect(source).not.toMatch(/<h1\b/);
    }
    expect(FRESHA_HERO_TITLE_LINES.join(' ')).toBe(
      'The Fresha alternative for barbershops that want to own the booking',
    );
    expect(heroSource).toContain('{FRESHA_HERO_TITLE_LINES.map(');
  });

  it('renders the journey sections in the agreed order', () => {
    const order = [
      '<FreshaHero',
      '<FreshaVerdict',
      '<FreshaReasons',
      '<FreshaCosts',
      '<FreshaOutcomes',
      '<FreshaCompare',
      '<FreshaFit',
      '<FreshaSwitching',
      '<FreshaPricing',
      '<Faq4',
      '<ComparisonFinalCta',
      '<Contact16',
      '<CompareHubLink',
      '<FreshaSources',
      '<Footer50',
      '<FreshaJourneyRail',
    ].map((tag) => pageSource.indexOf(tag));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('tells the story in four acts whose ids exist on the page', () => {
    expect(FRESHA_JOURNEY_ACTS.map((act) => act.id)).toEqual(['why-switch', 'costs', 'life-on-kersivo', 'switching']);
    const sections = [reasonsSource, costsSource, outcomesSource, switchingSource];
    FRESHA_JOURNEY_ACTS.forEach((act, index) => {
      expect(sections[index]).toContain(`id="${act.id}"`);
      expect(sections[index]).toContain(`data-fj-act="${act.numeral}"`);
    });
    expect(heroSource).toContain('aria-label="On this page"');
    expect(railSource).toContain('aria-label="Story progress"');
  });

  it('answers the switching question in 30 seconds directly after the hero', () => {
    expect(verdictSource).toContain('id="quick-answer"');
    expect(verdictSource).toMatch(/<h2 id="fresha-verdict-title"[^>]*>\{FRESHA_VERDICT_TITLE\}<\/h2>/);
    expect(FRESHA_VERDICT).toBe(`${FRESHA_VERDICT_LEAD} ${FRESHA_VERDICT_DETAIL}`);
    const words = FRESHA_VERDICT.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(60);
    expect(words).toBeLessThanOrEqual(140);
    expect(FRESHA_VERDICT_LEAD).toContain('Stay with Fresha if');
    expect(FRESHA_VERDICT_LEAD).toContain('Stripe processing fees still apply');
    expect(FRESHA_VERDICT_TITLE.toLowerCase()).not.toMatch(/\b(best|cheaper)\b/);
    expect(FRESHA_VERDICT_FIT.map((group) => group.tone)).toEqual(['kersivo', 'fresha']);
    expect(verdictSource).toContain('<dt>{fact.label}</dt>');
  });

  it('covers the five switching reasons the brief names, each with an honest KERSIVO answer', () => {
    expect(FRESHA_REASONS.map((reason) => reason.kicker)).toEqual([
      'Commission',
      'Fees',
      'Client control',
      'Your own website',
      'Branding',
    ]);
    for (const reason of FRESHA_REASONS) {
      expect(reason.kersivo.length).toBeGreaterThan(40);
    }
    expect(FRESHA_REASONS[0].kersivo).toContain('Stripe processing fees still apply');
    expect(FRESHA_REASONS_INTRO).toContain('plenty of shops do well on it');
    expect(reasonsSource).toContain('<h3 class="fj-reason__title">{reason.title}</h3>');
  });

  it('keeps every reason readable without the pinned stage', () => {
    expect(reasonsSource).toContain('class="fj-reason__inline-visual"');
    expect(reasonsSource).toMatch(/class="fj-reasons__stage" aria-hidden="true"/);
    expect(reasonVisualSource.match(/aria-hidden="true"/g)?.length).toBe(5);
    // Dimmed, never hidden; fully visible again on narrow screens.
    expect(journeyCss).toMatch(/\.fj-reason\[data-active='false'\] \{\s*opacity: 0\.5;/);
    expect(journeyCss).not.toMatch(/\.fj-reason(\[data-active='false'\])? \{[^}]*(display: none|visibility: hidden)/);
  });

  it('runs its motion once, without dependencies, and rests under reduced motion', () => {
    expect(heroSource).toContain('data-enter');
    expect(journeyCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(journeyCss).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.fj-enter \{\s*animation: none;/);
    expect(journeyScript).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(journeyScript).not.toMatch(/from '(gsap|three|motion|framer-motion)/);
    expect(pageSource).toContain("document.addEventListener('astro:before-swap', cleanup, { once: true });");
  });

  it('feeds the estimator only verified Fresha rates', () => {
    const team = requireVerifiedFreshaFact('teamPlanPerMember');
    const independent = requireVerifiedFreshaFact('independentPlan');
    const marketplace = requireVerifiedFreshaFact('marketplaceNewClientFee');
    expect(FRESHA_ESTIMATOR_CONFIG.teamPerMemberGbp).toBe(team.amountGbp);
    expect(FRESHA_ESTIMATOR_CONFIG.independentGbp).toBe(independent.amountGbp);
    expect(FRESHA_ESTIMATOR_CONFIG.marketplacePercent).toBe(marketplace.percent);
    expect(FRESHA_ESTIMATOR_CONFIG.marketplaceMinimumGbp).toBe(marketplace.minimumGbp);
    expect(costsSource).toContain('data-fj-estimator={JSON.stringify(config)}');
    expect(FRESHA_ESTIMATOR_NOTE).toContain('leaves out payment processing on both sides');
    for (const id of ['fj-barbers', 'fj-new-clients', 'fj-first-visit']) {
      expect(costsSource).toContain(`<label for="${id}">`);
    }
    expect(costsSource).toContain('aria-live="polite"');
  });

  it('includes the required H2 sections', () => {
    const corpus = [...newComponentSources, contentSource].join('\n').replace(/\s+/g, ' ');
    for (const heading of [
      'Why UK barbers look for a Fresha alternative',
      'Fresha pricing and fees for UK barbers, line by line',
      'What changes when the booking is yours',
      'Which model fits your barbershop?',
      'Switching from Fresha to KERSIVO without a gap in the diary',
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
    expect(FRESHA_ALTERNATIVE_FAQ_ITEMS.length).toBeLessThanOrEqual(11);

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
    expect(matches[0].lastmod).toBe('2026-11-14');
    expect(FRESHA_ALTERNATIVE_LAST_UPDATED_ISO).toBe('2026-11-14');
    expect(FRESHA_ALTERNATIVE_LAST_UPDATED_LABEL).toBe('14 November 2026');
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
  const homepageIncludedSource = readRepoFile('../../components/homeV2/HomeV2Included.astro');
  const booksyFitSource = readRepoFile('../../components/booksyAlternative/BooksyFit.astro');
  const allSources = [pageSource, heroSource, compareSource, pricingSource, finalCtaSource, ...newComponentSources];

  function countLinks(source: string, href: string): number {
    return source.split(`href="${href}"`).length - 1;
  }

  it('links the homepage switching line to /fresha-alternative with a crawlable anchor', () => {
    expect(homepageSource).toContain('<HomeV2Included />');
    expect(countLinks(homepageIncludedSource, '/fresha-alternative')).toBe(1);
    expect(homepageIncludedSource).toContain('href="/fresha-alternative">Fresha</a>');
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
    for (const source of allSources.filter((source) => source !== fitSource)) {
      expect(countLinks(source, '/booksy-alternative')).toBe(0);
    }
  });

  it('links to the cost calculator exactly once, from the costs section, with a descriptive anchor', () => {
    expect(countLinks(costsSource, '/barber-software-cost-calculator')).toBe(1);
    expect(costsSource).toMatch(
      /<a href="\/barber-software-cost-calculator">\s*Barber Software Cost Calculator\s*<\/a>/,
    );
    for (const source of [...allSources.filter((source) => source !== costsSource), faqSource, contentSource]) {
      expect(source).not.toContain('/barber-software-cost-calculator');
    }
    for (const source of allSources) {
      expect(source).not.toContain('/barber-booking-software-cost-calculator');
    }
  });

  it('links out to the website, online booking and demo pages from the story', () => {
    const reasonLinks = FRESHA_REASONS.flatMap((reason) => (reason.link ? [reason.link.href] : []));
    expect(reasonLinks).toEqual(['/barbershop-websites', '/barbershop-online-booking']);
    expect(reasonsSource).toContain('href={reason.link.href}');
    expect(countLinks(outcomesSource, '/demo')).toBe(1);
    expect(outcomesSource).toContain('data-track="view_live_demo_click"');
    for (const path of ['barbershop-websites', 'barbershop-online-booking', 'demo']) {
      const page = join(here, '../../pages', path);
      expect(existsSync(`${page}.astro`) || existsSync(join(page, 'index.astro')), path).toBe(true);
    }
  });

  it('links to the /compare hub only through the shared CompareHubLink component', () => {
    expect(pageSource).toContain('<CompareHubLink />');
    expect(pageSource.indexOf('<CompareHubLink />')).toBeLessThan(pageSource.indexOf('<FreshaSources />'));
    for (const source of [pageSource, ...newComponentSources, booksyFitSource]) {
      expect(source).not.toMatch(/href="\/compare/);
    }
    // The homepage switching line is a distinct navigation context
    // where a direct link to the comparison hub is intentional and useful.
    expect(homepageIncludedSource).toContain('href="/compare"');
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
  const heroCss = journeyCss;

  it('renders the shared live dashboard showcase below the hero copy', () => {
    expect(heroSource).toContain("import HeroDashboardShowcase from '@/components/marketing/HeroDashboardShowcase.astro';");
    expect(heroSource.indexOf('<HeroDashboardShowcase />')).toBeGreaterThan(heroSource.indexOf('fj-hero__facts'));
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
    expect(heroCss).toMatch(/^\.fj-hero \{[^}]*background: #030303;/m);
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