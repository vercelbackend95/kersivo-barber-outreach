import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET } from '../../pages/llms-full.txt';
import { buildLlmsTxt } from '../../pages/llms.txt';
import { LLMS_FULL_TXT_PATH, buildLlmsFullTxt, getLlmsFullSections } from './llmsFullTxt';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';

const site = 'https://kersivo.co.uk';

describe('/llms-full.txt', () => {
  for (const freePreview of [false, true]) {
    const body = buildLlmsFullTxt(site, freePreview);
    const sections = getLlmsFullSections(freePreview);
    const pages = sections.flatMap((section) => section.pages);

    it(`starts with an H1 and the entity summary with the Stripe qualifier (freePreview=${freePreview})`, () => {
      expect(body.startsWith('# KERSIVO: answers from the product and comparison pages\n\n> ')).toBe(true);
      expect(body).toContain('£39/month per location');
      expect(body).toMatch(/0% KERSIVO commission\. Standard Stripe payment-processing fees apply to online payments\./);
      // Page copy may say "unlimited barbers … subject to fair use" or "not a guaranteed date", so only
      // the phrases that are banned everywhere are checked here; claims-guard covers the sources.
      // "Nearcut advertises zero commission" is a sourced competitor fact, so only KERSIVO's own claim is checked.
      expect(body).not.toMatch(/KERSIVO[^.]{0,40}zero commission|free forever|1–2 weeks|\d+\s*[–-]\s*\d+ (working )?days/i);
      expect(body).not.toMatch(/undefined|\[object Object\]/);
    });

    it(`covers every page once, each with a URL, a date and some content (freePreview=${freePreview})`, () => {
      const paths = pages.map((page) => page.path);
      expect(new Set(paths).size).toBe(paths.length);
      expect(pages.length).toBeGreaterThanOrEqual(23);
      for (const page of pages) {
        expect(body).toContain(`URL: ${site}${page.path}\nLast updated: `);
        expect(page.answer.length + page.faqs.length, page.path).toBeGreaterThan(0);
        for (const faq of page.faqs) {
          expect(faq.question.trim(), page.path).not.toBe('');
          expect(faq.answer.trim(), page.path).not.toBe('');
        }
      }
    });

    it(`lists only indexable sitemap pages (freePreview=${freePreview})`, () => {
      const sitemapPaths = new Set(MARKETING_SITEMAP_ENTRIES.map((entry) => entry.path));
      for (const page of pages) expect(sitemapPaths.has(page.path), page.path).toBe(true);
    });
  }

  it('reads every paragraph from the constants the pages render, not from copy of its own', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/seo/llmsFullTxt.ts'), 'utf8');
    const ownSentences = source.match(/'[A-Z][^'\n]{60,}'/g) ?? [];
    // Only the file's own introduction may be written here.
    expect(ownSentences).toEqual([]);
    for (const page of getLlmsFullSections(false).flatMap((section) => section.pages)) {
      const route = join(process.cwd(), 'src/pages', page.path === '/' ? 'index' : page.path.slice(1));
      expect(existsSync(`${route}.astro`) || existsSync(join(route, 'index.astro')), page.path).toBe(true);
    }
  });

  it('serves plain text and is linked from /llms.txt', async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toContain('## Comparisons');
    expect(buildLlmsTxt(site)).toContain(`(${site}${LLMS_FULL_TXT_PATH})`);
  });
});
