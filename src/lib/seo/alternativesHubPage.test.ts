import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPETITOR_HUB_PLATFORMS, HUB_PLATFORMS } from '@/lib/compare/alternativesHubData';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { GET as getRobots } from '../../pages/robots.txt';
import {
  ALTERNATIVES_HUB_DESCRIPTION,
  ALTERNATIVES_HUB_FAQ_ITEMS,
  ALTERNATIVES_HUB_H1,
  ALTERNATIVES_HUB_LAST_UPDATED_ISO,
  ALTERNATIVES_HUB_PAGE_PATH,
  ALTERNATIVES_HUB_TITLE,
} from './alternativesHubSeo';
import {
  buildAlternativesHubBreadcrumbJsonLd,
  buildAlternativesHubCollectionPageJsonLd,
  buildAlternativesHubFaqJsonLd,
  buildAlternativesHubItemListJsonLd,
} from './alternativesHubJsonLd';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl } from './meta';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/compare/index.astro');
const hero = read('../../components/alternativesHub/HubHero.astro');
const comparison = read('../../components/alternativesHub/HubComparison.astro');
const platformCard = read('../../components/alternativesHub/HubPlatformCard.astro');
const kersivoCard = read('../../components/alternativesHub/HubKersivoCard.astro');
const guide = read('../../components/alternativesHub/HubGuide.astro');
const sources = read('../../components/alternativesHub/HubSources.astro');
const methodology = read('../../components/alternativesHub/HubMethodology.astro');
const css = read('../../styles/components/alternatives-hub.css');
const siteUrl = 'https://kersivo.co.uk';
const pageUrl = `${siteUrl}/compare`;

const ALTERNATIVE_PAGES = [
  'booksy-alternative',
  'fresha-alternative',
  'nearcut-alternative',
  'treatwell-alternative',
  'timely-alternative',
  'phorest-alternative',
  'setora-alternative',
  'square-appointments-alternative',
  'squire-alternative',
  'vagaro-alternative',
  'barber-software-cost-calculator',
];

describe('Alternatives hub: metadata and indexability', () => {
  it('uses /compare as the canonical with unique title, description and H1', () => {
    expect(ALTERNATIVES_HUB_PAGE_PATH).toBe('/compare');
    expect(resolveCanonicalUrl(ALTERNATIVES_HUB_PAGE_PATH)).toBe(pageUrl);
    expect(ALTERNATIVES_HUB_TITLE).toBe('Compare Barber Booking Software UK | KERSIVO');
    expect(ALTERNATIVES_HUB_TITLE.length).toBeLessThanOrEqual(65);
    expect(ALTERNATIVES_HUB_DESCRIPTION.length).toBeLessThanOrEqual(165);
    expect(ALTERNATIVES_HUB_H1).toBe('Find the right barber booking system');
  });

  it('wires LandingLayout with canonical metadata and all JSON-LD blocks, without noindex', () => {
    expect(page).toContain('title={ALTERNATIVES_HUB_TITLE}');
    expect(page).toContain('description={ALTERNATIVES_HUB_DESCRIPTION}');
    expect(page).toContain('canonicalPath={ALTERNATIVES_HUB_PAGE_PATH}');
    expect(page).toContain('buildAlternativesHubCollectionPageJsonLd()');
    expect(page).toContain('buildAlternativesHubBreadcrumbJsonLd()');
    expect(page).toContain('buildAlternativesHubItemListJsonLd()');
    expect(page).toContain('buildAlternativesHubFaqJsonLd()');
    expect(page).toContain('faqs={ALTERNATIVES_HUB_FAQ_ITEMS}');
    expect(page).not.toMatch(/noindex|Astro\.redirect/);
  });

  it('renders exactly one H1 with the red accent and a visible last-updated date', () => {
    const all = [page, hero, comparison, platformCard, kersivoCard, guide, sources, methodology].join('\n');
    expect(all.match(/<h1\b/g)).toHaveLength(1);
    expect(hero).toContain('alt-hub-hero__accent');
    expect(hero).toContain('datetime={ALTERNATIVES_HUB_LAST_UPDATED_ISO}');
    expect(hero).toContain('Published by KERSIVO');
  });

  it('is in the sitemap with a genuine lastmod, in the Compare menu and crawlable in robots', async () => {
    const entries = buildMarketingSitemapEntries().filter((e) => e.loc === pageUrl);
    expect(entries).toHaveLength(1);
    expect(entries[0].lastmod).toBe(ALTERNATIVES_HUB_LAST_UPDATED_ISO);
    const navItems = MARKETING_NAV_ITEMS.filter((item) => item.href === '/compare');
    expect(navItems).toHaveLength(1);
    expect(navItems[0].group).toBe('compare');
    expect(getRouteFamily('/compare')).toBe('marketing');
    const robots = await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
    expect(robots).not.toContain('Disallow: /compare');
    expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
  });
});

describe('Alternatives hub: server-rendered content and links', () => {
  it('server-renders every platform card from the shared registry with crawlable hrefs', () => {
    expect(comparison).toContain('ranked.map(');
    expect(platformCard).toContain('href={platform.href}');
    expect(kersivoCard).toContain('href={platform.href}');
    expect(guide).toContain('COMPETITOR_HUB_PLATFORMS.map(');
    expect(guide).toContain('href={platform.href}');
    expect(HUB_PLATFORMS).toHaveLength(11);
  });

  it('does not write filter state to the URL (no crawlable parameter combinations)', () => {
    const script = read('../compare/initAlternativesHub.ts');
    expect(script).not.toMatch(/history\.(push|replace)State|location\.search|URLSearchParams/);
  });

  it('uses accessible toggle semantics and a labelled sort control', () => {
    expect(comparison).toContain('aria-pressed=');
    expect(comparison).toContain('<label for="alt-hub-sort"');
    expect(comparison).toContain('aria-live="polite"');
    expect(comparison).toContain('aria-expanded="false"');
    expect(comparison).toContain('<noscript>');
  });

  it('identifies KERSIVO as the publisher and not an independent ranking', () => {
    expect(methodology).toContain('published by KERSIVO');
    expect(methodology).toContain('not an independent');
    expect(sources).toContain('not affiliated with, endorsed by or');
    expect(sources).toContain('not an independent review or rating');
    expect(kersivoCard).toContain('Our platform');
    expect(kersivoCard).not.toMatch(/#1|Best (?:Software|match)\b/);
  });

  it('respects reduced motion, focus visibility and mobile layout rules', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toContain('alt-hub-pill--extra');
  });

  it('links back to the hub from every alternative page and the calculator, before their sources', () => {
    for (const slug of ALTERNATIVE_PAGES) {
      const source = read(`../../pages/${slug}/index.astro`);
      expect(source, slug).toContain("import CompareHubLink from '@/components/alternativesHub/CompareHubLink.astro'");
      expect(source.match(/<CompareHubLink \/>/g), slug).toHaveLength(1);
    }
    const link = read('../../components/alternativesHub/CompareHubLink.astro');
    expect(link).toContain('href={ALTERNATIVES_HUB_PAGE_PATH}');
    expect(link).toContain('Compare all barber booking systems');
  });
});

describe('Alternatives hub: structured data', () => {
  it('emits CollectionPage, BreadcrumbList and ItemList with absolute production URLs', () => {
    const collection = buildAlternativesHubCollectionPageJsonLd(siteUrl);
    expect(collection['@type']).toBe('CollectionPage');
    expect(collection.url).toBe(pageUrl);
    expect(collection.publisher).toEqual({ '@id': `${siteUrl}/#organization` });

    const breadcrumb = buildAlternativesHubBreadcrumbJsonLd(siteUrl) as { itemListElement: { item: string }[] };
    expect(breadcrumb.itemListElement.map((i) => i.item)).toEqual([`${siteUrl}/`, pageUrl]);

    const list = buildAlternativesHubItemListJsonLd(siteUrl) as {
      numberOfItems: number;
      itemListElement: { position: number; url: string }[];
    };
    expect(list.numberOfItems).toBe(HUB_PLATFORMS.length);
    expect(list.itemListElement.map((i) => i.url)).toEqual(HUB_PLATFORMS.map((p) => `${siteUrl}${p.href}`));
    for (const platform of COMPETITOR_HUB_PLATFORMS) {
      expect(list.itemListElement.some((i) => i.url === `${siteUrl}${platform.href}`)).toBe(true);
    }
  });

  it('mirrors the visible FAQ in FAQPage and never fabricates ratings or reviews', () => {
    const faq = buildAlternativesHubFaqJsonLd() as { mainEntity: { name: string }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(ALTERNATIVES_HUB_FAQ_ITEMS.map((i) => i.question));
    expect(ALTERNATIVES_HUB_FAQ_ITEMS).toHaveLength(6);
    const all = JSON.stringify([
      buildAlternativesHubCollectionPageJsonLd(siteUrl),
      buildAlternativesHubItemListJsonLd(siteUrl),
      faq,
    ]);
    expect(all).not.toMatch(/AggregateRating|"Review"|ratingValue|award/i);
  });

  it('answers the commission FAQ by separating processing fees', () => {
    const answer = ALTERNATIVES_HUB_FAQ_ITEMS.find((i) => i.question.startsWith('Does 0% commission'))!.answer;
    expect(answer).toMatch(/^No\./);
    expect(answer).toContain('Standard Stripe payment-processing fees still apply.');
    const exportAnswer = ALTERNATIVES_HUB_FAQ_ITEMS.find((i) => i.question.startsWith('Can I move my client data'))!.answer;
    expect(exportAnswer).toContain('With KERSIVO you may request a free CSV export');
  });
});
