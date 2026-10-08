import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HUB_PLATFORMS } from '@/lib/compare/alternativesHubData';
import {
  ALTERNATIVES_HUB_DESCRIPTION,
  ALTERNATIVES_HUB_LAST_UPDATED_ISO,
  ALTERNATIVES_HUB_PAGE_PATH,
  ALTERNATIVES_HUB_TITLE,
} from './alternativesHubSeo';
import {
  buildAlternativesHubBreadcrumbJsonLd,
  buildAlternativesHubCollectionPageJsonLd,
  buildAlternativesHubItemListJsonLd,
} from './alternativesHubJsonLd';
import { buildMarketingSitemapEntries } from './marketingSitemap';

const repoSrc = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('Alternatives Hub discovery and search intent', () => {
  it('uses UK barber-booking comparison wording without third-party awards or rankings', () => {
    expect(ALTERNATIVES_HUB_PAGE_PATH).toBe('/compare');
    expect(ALTERNATIVES_HUB_TITLE).toMatch(/compare.*barber booking.*UK/i);
    expect(ALTERNATIVES_HUB_DESCRIPTION).toMatch(/UK barbershops/i);
    expect(ALTERNATIVES_HUB_DESCRIPTION).toMatch(/Booksy.*Fresha.*Nearcut/);
    expect(ALTERNATIVES_HUB_TITLE).not.toMatch(/#1|award|rated/i);
  });

  it('has a current, explicit sitemap lastmod matching the visible content update', () => {
    const item = buildMarketingSitemapEntries().find((entry) => entry.loc === 'https://kersivo.co.uk/compare');
    expect(item?.lastmod).toBe(ALTERNATIVES_HUB_LAST_UPDATED_ISO);
    const hero = readFileSync(join(repoSrc, 'components/alternativesHub/HubHero.astro'), 'utf8');
    expect(hero).toContain('ALTERNATIVES_HUB_LAST_UPDATED_LABEL');
    expect(hero).toContain('datetime={ALTERNATIVES_HUB_LAST_UPDATED_ISO}');
  });

  it('offers a crawlable contextual /compare link on the indexed homepage', () => {
    const homepageSwitcher = readFileSync(join(repoSrc, 'components/landingSwitcherReassurance.astro'), 'utf8');
    const homepage = readFileSync(join(repoSrc, 'pages/index.astro'), 'utf8');
    expect(homepage).toContain('<LandingSwitcherReassurance');
    expect(homepageSwitcher).toContain('href="/compare"');
    expect(homepageSwitcher).toContain('compare UK barber booking systems');
  });

  it('describes one properly identified editorial hub and all comparison destinations in schema', () => {
    const site = 'https://kersivo.co.uk';
    const page = buildAlternativesHubCollectionPageJsonLd(site);
    const crumbs = buildAlternativesHubBreadcrumbJsonLd(site);
    const list = buildAlternativesHubItemListJsonLd(site);
    expect(page['@type']).toBe('CollectionPage');
    expect(page.url).toBe(site + '/compare');
    expect(page.publisher).toEqual({ '@id': site + '/#organization' });
    expect(crumbs.itemListElement).toHaveLength(2);
    expect(list.numberOfItems).toBe(HUB_PLATFORMS.length);
    const items = list.itemListElement as Array<{ position: number; url: string }>;
    expect(items.map((item) => item.position)).toEqual(HUB_PLATFORMS.map((_, i) => i + 1));
    expect(items.map((item) => item.url)).toEqual(HUB_PLATFORMS.map((p) => site + p.href));
  });
});
