import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET, buildLlmsTxt } from '../../pages/llms.txt';
import { buildHomepageJsonLd } from './barberDemoJsonLd';
import { INSIGHTS_PUBLISHED_ARTICLES } from './insights';

const site = 'https://kersivo.co.uk';
const body = buildLlmsTxt(site);

describe('/llms.txt', () => {
  it('serves plain text with an H1, a summary quote and link sections', async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(body.startsWith('# KERSIVO\n\n> ')).toBe(true);
    for (const heading of ['## Product', '## Comparisons', '## Insights', '## Optional']) {
      expect(body).toContain(heading);
    }
  });

  it('states prices with the Stripe qualifier and no banned claims', () => {
    expect(body).toContain('£39/month per location');
    expect(body).toContain('£0/month');
    expect(body).toMatch(/0% KERSIVO commission\. Standard Stripe payment-processing fees still apply\./);
    expect(body).not.toMatch(/zero commission|free forever|unlimited|guarantee|1–2 weeks|\d+\s*[–-]\s*\d+ days/i);
  });

  it('links only to routes that exist, plus every published Insights article', () => {
    const paths = [...body.matchAll(/\]\(https:\/\/kersivo\.co\.uk(\/[^)]*)\)/g)].map((m) => m[1]);
    for (const path of paths.filter((p) => !p.startsWith('/insights/'))) {
      const base = join(process.cwd(), 'src/pages', path.slice(1));
      expect(existsSync(`${base}.astro`) || existsSync(join(base, 'index.astro')), path).toBe(true);
    }
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) expect(paths).toContain(article.path);
    expect(body).not.toContain('/seo-growth');
  });
});

describe('homepage JSON-LD', () => {
  it('puts the FAQPage into the main @graph as one block', () => {
    const jsonLd = buildHomepageJsonLd();
    const graph = jsonLd['@graph'] as Record<string, unknown>[];
    const faq = graph.find((node) => node['@type'] === 'FAQPage');
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(faq?.['@id']).toBe(`${site}/#faq`);
    expect(faq).not.toHaveProperty('@context');
    expect(graph.map((node) => node['@type'])).toEqual(
      expect.arrayContaining(['Organization', 'WebSite', 'WebPage', 'SoftwareApplication', 'FAQPage']),
    );
  });
});
