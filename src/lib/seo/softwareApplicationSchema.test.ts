import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBarberDemoJsonLd, buildKersivoSoftwareApplicationJsonLd } from './barberDemoJsonLd';

const ALTERNATIVE_PAGES = readdirSync('src/pages')
  .filter((dir) => dir.endsWith('-alternative'))
  .map((dir) => `src/pages/${dir}/index.astro`);

const COMMERCIAL_PAGES = ['src/pages/pricing.astro', 'src/pages/starter/index.astro', 'src/pages/compare/index.astro', ...ALTERNATIVE_PAGES];

describe('KERSIVO SoftwareApplication schema', () => {
  it('is a BusinessApplication on the Web with £0.00 and £39.00 GBP offers and no ratings', () => {
    const software = buildKersivoSoftwareApplicationJsonLd();
    expect(software['@context']).toBe('https://schema.org');
    expect(software['@type']).toBe('SoftwareApplication');
    expect(software['@id']).toBe('https://kersivo.co.uk/#software');
    expect(software.applicationCategory).toBe('BusinessApplication');
    expect(software.operatingSystem).toBe('Web');
    const offers = software.offers as Array<Record<string, unknown>>;
    expect(offers.map((offer) => [offer['@type'], offer.price, offer.priceCurrency]).sort()).toEqual([
      ['Offer', '0.00', 'GBP'],
      ['Offer', '39.00', 'GBP'],
    ]);
    expect(JSON.stringify(software)).not.toMatch(/aggregateRating|AggregateRating|"review"|"Review"|ratingValue/);
  });

  it('is the same node the homepage graph uses', () => {
    const graph = buildBarberDemoJsonLd()['@graph'] as Array<Record<string, unknown>>;
    const { '@context': _context, ...standalone } = buildKersivoSoftwareApplicationJsonLd();
    expect(graph.find((node) => node['@type'] === 'SoftwareApplication')).toEqual(standalone);
  });

  it('covers every /*-alternative page', () => {
    expect(ALTERNATIVE_PAGES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(COMMERCIAL_PAGES)('%s renders the SoftwareApplication block', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/jsonLd=\{\[buildKersivoSoftwareApplicationJsonLd\(\),|const ld = \[buildKersivoSoftwareApplicationJsonLd\(\),/);
  });
});
