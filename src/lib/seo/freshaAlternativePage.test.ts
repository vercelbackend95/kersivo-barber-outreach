import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FRESHA_ALTERNATIVE_DESCRIPTION,
  FRESHA_ALTERNATIVE_FAQ_ITEMS,
  FRESHA_ALTERNATIVE_LAST_UPDATED_ISO,
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
  FRESHA_QUICK_ANSWER_FACTS,
  FRESHA_SWITCHING_LIMITS,
  FRESHA_SWITCHING_REASSURANCE,
  FRESHA_SWITCHING_STEPS,
  FRESHA_WHY_THEMES,
  FRESHA_WORKED_EXAMPLES,
  FRESHA_WORKED_EXAMPLES_NOTE,
  KERSIVO_MODEL_POINTS,
} from './freshaAlternativeContent';
import { buildFreshaAlternativeWebPageJsonLd } from './freshaAlternativeJsonLd';
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
  whySource,
  costsSource,
  fitSource,
  switchingSource,
  sourcesSource,
];

const renderedContentCopy = [
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
      'jsonLd={[buildFreshaAlternativeWebPageJsonLd(), buildFreshaAlternativeFaqJsonLd()]}',
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
    expect(FRESHA_ALTERNATIVE_DESCRIPTION).toMatch(/^Compare KERSIVO and Fresha pricing, fees/);
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
    expect(quickAnswerSource).toContain('{FRESHA_QUICK_ANSWER}');
    const words = FRESHA_QUICK_ANSWER.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(60);
    expect(words).toBeLessThanOrEqual(110);
    expect(FRESHA_QUICK_ANSWER).toContain('Fresha alternative');
    expect(FRESHA_QUICK_ANSWER).toContain('UK barbershops');
    expect(FRESHA_QUICK_ANSWER).toContain('Stripe processing fees still apply');
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

  it('lists /fresha-alternative exactly once in the sitemap with the visible last-updated date', () => {
    const matches = buildMarketingSitemapEntries().filter(
      (entry) => entry.loc === 'https://kersivo.co.uk/fresha-alternative',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].lastmod).toBe('2026-09-30');
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
    expect(FRESHA_WORKED_EXAMPLES.every((row) => row.kersivo === '£39')).toBe(true);
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
  const booksyDecisionSource = readRepoFile('../../components/booksyAlternative/BooksyDecision.astro');

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

  it('links /booksy-alternative to /fresha-alternative once, from the decision section', () => {
    expect(countLinks(booksyDecisionSource, '/fresha-alternative')).toBe(1);
    expect(booksyDecisionSource).toContain('Also comparing Fresha?');
    expect(booksyDecisionSource).toContain('See KERSIVO vs Fresha');
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

  it('does not link to a calculator or /compare hub before they exist', () => {
    for (const source of [pageSource, ...newComponentSources, booksyDecisionSource, switcherSource]) {
      expect(source).not.toMatch(/href="\/(compare|barber-booking-software-cost-calculator)/);
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

describe('hero dashboard progressive loading', () => {
  const heroCss = readRepoFile('../../styles/components/fresha-alternative.css');
  const frameMarkup = heroSource.slice(
    heroSource.indexOf('<iframe'),
    heroSource.indexOf('</iframe>'),
  );

  it('defers the dashboard iframe behind a poster at the same viewport', () => {
    expect(heroSource).toContain('data-deferred-demo-frame');
    expect(frameMarkup).toContain(
      'data-deferred-src="/demo/admin?embed=hero&section=bookings_dashboard"',
    );
    expect(frameMarkup).not.toMatch(/\ssrc=/);
    expect(frameMarkup).toContain('title="Interactive KERSIVO owner dashboard demo"');
    expect(frameMarkup).not.toContain('sandbox');
    expect(heroSource).toContain('mountDeferredDemoFrame(viewport)');
  });

  it('ships lightweight WebP posters with explicit dimensions and a no-JS fallback', () => {
    for (const variant of ['mobile', 'tablet', 'desktop']) {
      expect(heroSource).toContain(`/images/fresha-alternative/dashboard-poster-${variant}.webp`);
    }
    expect(heroSource).toMatch(/<picture class="fresha-alt-hero__product-poster" aria-hidden="true">/);
    expect(heroSource).toMatch(/<img[\s\S]*?alt=""[\s\S]*?width="1437"[\s\S]*?height="805"/);
    expect(heroSource).toMatch(
      /<noscript>\s*<iframe\s+src="\/demo\/admin\?embed=hero&section=bookings_dashboard"/,
    );
  });

  it('keeps the frame non-interactive only until ready and respects reduced motion', () => {
    expect(heroCss).toMatch(
      /\[data-frame-state='ready'\] \.fresha-alt-hero__product-frame \{\s*opacity: 1;\s*pointer-events: auto;/,
    );
    expect(heroCss).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*\.fresha-alt-hero__product-viewport \.fresha-alt-hero__product-frame \{\s*transition: opacity/,
    );
    expect(heroCss).toMatch(/\.fresha-alt-hero__product-viewport \{[^}]*height: clamp\(38rem, 56vw, 51rem\)/);
  });
});
