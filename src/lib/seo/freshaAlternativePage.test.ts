import { existsSync, readFileSync } from 'node:fs';
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
    expect(heroSource).toMatch(
      /mountDeferredDemoFrame\(viewport, window, \{ readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE \}\);/,
    );
  });

  const posterBands: Array<[variant: string, media: string | null, width: number, height: number]> = [
    ['mobile', '(max-width: 25rem)', 378, 608],
    ['mobile-wide', '(max-width: 38rem)', 418, 640],
    ['tablet', '(max-width: 48rem)', 756, 704],
    ['tablet-wide', '(max-width: 50rem)', 768, 544],
    ['desktop-narrow', '(max-width: 53.5rem)', 769, 544],
    ['desktop-mid', '(max-width: 60rem)', 864, 603],
    ['desktop-compact', '(max-width: 64rem)', 983, 686],
    ['desktop-laptop', '(max-width: 85rem)', 1203, 717],
    ['desktop', '(max-width: 96.875rem)', 1354, 806],
    ['desktop-wide', null, 1458, 816],
  ];

  it('ships versioned WebP posters for every band with explicit dimensions and a no-JS fallback', () => {
    const posterMarkup = heroSource.slice(heroSource.indexOf('<picture'), heroSource.indexOf('</picture>'));
    for (const [variant, media, width, height] of posterBands) {
      const url = `/images/fresha-alternative/dashboard-showcase-v2-${variant}.webp`;
      expect(existsSync(join(repoRoot, 'public', url))).toBe(true);
      const tag = media
        ? new RegExp(`media="${media.replace(/[().]/g, '\\$&')}"\\s+srcset="${url}(?: 2x)?"\\s+width="${width}"\\s+height="${height}"`)
        : new RegExp(`<img\\s+src="${url}"\\s+alt=""\\s+width="${width}"\\s+height="${height}"`);
      expect(posterMarkup).toMatch(tag);
    }
    expect(posterMarkup.match(/<source/g)).toHaveLength(posterBands.length - 1);
    expect(heroSource).not.toContain('dashboard-poster-');
    expect(heroSource).toMatch(/<picture class="fresha-alt-hero__product-poster" aria-hidden="true">/);
    expect(heroCss).toMatch(/\.fresha-alt-hero__product-poster img \{\s*object-fit: none;/);
    expect(heroSource).toMatch(
      /<noscript>\s*<iframe\s+src="\/demo\/admin\?embed=hero&section=bookings_dashboard"/,
    );
  });

  const productRules = () =>
    heroCss.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]*\.fresha-alt-hero__product-(?:shell|viewport|poster|frame)[^{}]*\{[^}]*\}/g) ?? [];
  const ruleFor = (selector: RegExp) => productRules().filter((rule) => selector.test(rule.split('{')[0]));

  it('keeps the poster fully visible and the live frame transparent until the swap', () => {
    expect(heroCss).toMatch(
      /\.fresha-alt-hero__product-viewport \.fresha-alt-hero__product-frame \{\s*opacity: 0;\s*pointer-events: none;\s*\}/,
    );
    const posterRules = ruleFor(/product-poster/);
    expect(posterRules.length).toBeGreaterThan(0);
    for (const rule of posterRules) expect(rule).not.toMatch(/opacity|transition/);
    expect(heroCss).toMatch(/\.fresha-alt-hero__product-viewport \{[^}]*height: clamp\(38rem, 56vw, 51rem\)/);
  });

  it('swaps poster and live frame atomically: visible and interactive together, poster hidden', () => {
    const readyFrame = ruleFor(/^\s*\.fresha-alt-hero__product-viewport\[data-frame-state='ready'\] \.fresha-alt-hero__product-frame\s*$/);
    expect(readyFrame).toHaveLength(1);
    expect(readyFrame[0]).toMatch(/\{\s*opacity: 1;\s*pointer-events: auto;\s*\}$/);
    const readyPoster = ruleFor(/\[data-frame-state='ready'\] \.fresha-alt-hero__product-poster/);
    expect(readyPoster).toHaveLength(1);
    expect(readyPoster[0]).toMatch(/\{\s*visibility: hidden;\s*\}$/);
    for (const rule of ruleFor(/product-frame/).filter((r) => r.includes('pointer-events: auto'))) {
      expect(rule).toContain('opacity: 1;');
    }
  });

  it('reveals the live frame with no fade, transition or reveal-specific state', () => {
    for (const rule of productRules()) expect(rule).not.toMatch(/transition|animation|filter|will-change/);
    expect(heroCss).not.toMatch(/live-visible|680ms/);
    expect(heroCss).not.toMatch(/prefers-reduced-motion: (?:reduce|no-preference)\) \{\s*\.fresha-alt-hero__product/);
    expect(heroSource).not.toMatch(/liveVisible|onReady/);
    expect(heroSource).not.toMatch(/window\.addEventListener\('load'|productFrame\.(?:onload|addEventListener\('load')|setTimeout/);
  });

  it('keeps the product shell at full opacity and untransformed at all times', () => {
    for (const rule of ruleFor(/product-shell/)) {
      expect(rule).not.toMatch(/opacity|transition|transform:\s*(?!none)/);
    }
    expect(heroCss).not.toContain('data-showcase-ready');
    expect(heroSource).not.toContain('showcaseReady');
  });

  it('never moves, scales or animates the product dashboard', () => {
    expect(heroCss).not.toContain('freshaAltProductIn');
    const rules = productRules();
    expect(rules.length).toBeGreaterThan(5);
    for (const rule of rules) {
      expect(rule).not.toMatch(/animation|transition|scale|zoom|translate|rotate|will-change/);
      const transform = rule.match(/transform:\s*([^;]+);/);
      if (transform) expect(transform[1]).toBe('none');
    }
  });

  it('keeps the live dashboard clickable once revealed', () => {
    expect(heroCss).toMatch(
      /\[data-frame-state='ready'\] \.fresha-alt-hero__product-frame \{\s*opacity: 1;\s*pointer-events: auto;\s*\}/,
    );
    expect(heroCss).not.toMatch(/\.fresha-alt-hero__product-shell[^{]*\{[^}]*pointer-events: none/);
  });

  it('forwards wheel scrolling over the hero iframe to the landing page', () => {
    const adminPage = readRepoFile('../../pages/demo/admin.astro');
    expect(heroSource).toContain('receiveHeroShowcaseWheel(productFrame, window)');
    expect(adminPage).toMatch(
      /import \{ forwardHeroShowcaseWheel \} from '@\/lib\/admin\/heroShowcaseWheel';\s*if \(document\.body\.classList\.contains\('admin-hero-embed-body'\)\) forwardHeroShowcaseWheel\(window\);/,
    );
    expect(adminPage).not.toContain('parent.scrollBy');
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
