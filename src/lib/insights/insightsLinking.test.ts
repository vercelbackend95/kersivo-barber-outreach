import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { INSIGHTS_PUBLISHED_ARTICLES } from '@/lib/seo/insights';
import { getInsightsCommercialNext, getInsightsRelatedLinks } from './insightsLinking';

const pagesRoot = join(process.cwd(), 'src/pages');

describe('Insights linking map', () => {
  it('points related and commercial destinations at routes that exist in the app', () => {
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      const links = [...getInsightsRelatedLinks(article.slug)];
      const commercial = getInsightsCommercialNext(article.slug);
      if (commercial) links.push({ href: commercial.href, label: commercial.label, kind: 'guide' });

      for (const link of links) {
        const pathname = link.href.split('#')[0];
        if (pathname.startsWith('/insights/') && pathname !== '/insights') {
          const slug = pathname.replace('/insights/', '');
          expect(INSIGHTS_PUBLISHED_ARTICLES.some((item) => item.slug === slug), pathname).toBe(true);
          continue;
        }

        const candidates = [
          join(pagesRoot, pathname.slice(1), 'index.astro'),
          join(pagesRoot, `${pathname.slice(1)}.astro`),
        ];
        expect(
          candidates.some((candidate) => existsSync(candidate)),
          `${pathname} missing among ${candidates.join(' | ')}`,
        ).toBe(true);
      }
    }
  });
});
