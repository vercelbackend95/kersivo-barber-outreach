import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKETING_SITEMAP_ENTRIES } from '@/lib/seo/marketingSitemap';
import { buildKersivoOrganizationNode, KERSIVO_KNOWS_ABOUT } from '@/lib/seo/kersivoEntityJsonLd';
import { buildInsightsArticleJsonLd, INSIGHTS_PUBLISHED_ARTICLES } from '@/lib/seo/insights';
import { GET as getLlms } from '@/pages/llms.txt';
import {
  EDITORIAL_STANDARDS_PATH,
  EDITORIAL_STANDARDS_SECTIONS,
  EDITORIAL_STANDARDS_SHORT_ANSWER,
  buildEditorialStandardsJsonLd,
  extractInsightsCitations,
} from './editorialStandards';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const words = (text: string) => text.trim().split(/\s+/).length;

describe('editorial standards page (GEO/AEO stage 5)', () => {
  it('is a public, indexable page in the sitemap and llms.txt', async () => {
    expect(MARKETING_SITEMAP_ENTRIES.map((e) => e.path)).toContain(EDITORIAL_STANDARDS_PATH);
    const page = read('src/pages/insights/editorial-standards.astro');
    expect(page).toContain('export const prerender = true');
    expect(page).not.toMatch(/noindex/);
    const llms = await (await getLlms({} as Parameters<typeof getLlms>[0])).text();
    expect(llms).toContain(`https://kersivo.co.uk${EDITORIAL_STANDARDS_PATH}`);
  });

  it('opens with a 40–80 word answer and uses question headings that lead with the answer', () => {
    const n = words(EDITORIAL_STANDARDS_SHORT_ANSWER.answer);
    expect(n).toBeGreaterThanOrEqual(40);
    expect(n).toBeLessThanOrEqual(80);
    for (const section of EDITORIAL_STANDARDS_SECTIONS) {
      expect(section.title, section.id).toMatch(/\?$/);
      expect(section.paragraphs.length, section.id).toBeGreaterThan(0);
    }
    expect(new Set(EDITORIAL_STANDARDS_SECTIONS.map((s) => s.id)).size).toBe(EDITORIAL_STANDARDS_SECTIONS.length);
  });

  it('names no person, team or company form and invents no numbers', () => {
    const copy = [
      EDITORIAL_STANDARDS_SHORT_ANSWER.question,
      EDITORIAL_STANDARDS_SHORT_ANSWER.answer,
      ...EDITORIAL_STANDARDS_SECTIONS.flatMap((s) => [s.title, ...s.paragraphs]),
    ].join(' ');
    expect(copy).not.toMatch(/founder|founded by|our team|\bLtd\b|\bCEO\b|editor-in-chief/i);
    expect(copy).not.toMatch(/\d/);
    expect(copy).not.toMatch(/\bcolor|organiz|recogniz/i);
  });

  it('emits WebPage and BreadcrumbList JSON-LD tied to the KERSIVO entity', () => {
    const [webPage, breadcrumbs] = buildEditorialStandardsJsonLd();
    expect(webPage['@type']).toBe('WebPage');
    expect(webPage.url).toBe('https://kersivo.co.uk/insights/editorial-standards');
    expect(webPage.publisher).toEqual({ '@id': 'https://kersivo.co.uk/#organization' });
    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
  });

  it('is linked from every article and from /about', () => {
    expect(read('src/layouts/InsightsArticleLayout.astro')).toContain('href={EDITORIAL_STANDARDS_PATH}');
    expect(read('src/pages/about.astro')).toContain('href={EDITORIAL_STANDARDS_PATH}');
  });
});

describe('Article JSON-LD: publishingPrinciples and citation', () => {
  const article = INSIGHTS_PUBLISHED_ARTICLES[0];
  const base = {
    path: article.path,
    headline: article.headline,
    description: article.description,
    publishedDate: article.publishedDate,
    verifiedDate: article.verifiedDate,
    heroImage: article.heroImage,
    ogImage: article.ogImage,
    categoryId: article.categoryId,
  };

  it('every article points at the editorial standards page', () => {
    const node = buildInsightsArticleJsonLd(base)[1] as Record<string, unknown>;
    expect(node.publishingPrinciples).toBe('https://kersivo.co.uk/insights/editorial-standards');
    expect(node).not.toHaveProperty('citation');
  });

  it('adds citation when the article has sources', () => {
    const citation = [{ '@type': 'CreativeWork' as const, name: 'National Minimum Wage rates', url: 'https://www.gov.uk/national-minimum-wage-rates' }];
    const node = buildInsightsArticleJsonLd({ ...base, citation })[1] as Record<string, unknown>;
    expect(node.citation).toEqual(citation);
  });

  it('extracts sources from a rendered References list, skipping bare home links and duplicates', () => {
    const html = `<h2>References</h2><ol>
      <li><a href="http://GOV.UK">GOV.UK</a>, <em>National Minimum Wage rates</em>. <a href="http://gov.uk/national-minimum-wage-rates">gov.uk/national-minimum-wage-rates</a> (accessed 16 Oct 2026).</li>
      <li><a href="https://www.hse.gov.uk/skin/">HSE: Skin at work</a></li>
      <li><a href="https://gov.uk/national-minimum-wage-rates">repeat</a></li>
    </ol><p>Context: <a href="https://www.nhbf.co.uk/news/x?a=1&amp;b=2">NHBF analysis</a></p>`;
    expect(extractInsightsCitations(html)).toEqual([
      { '@type': 'CreativeWork', name: 'National Minimum Wage rates', url: 'http://gov.uk/national-minimum-wage-rates' },
      { '@type': 'CreativeWork', name: 'HSE: Skin at work', url: 'https://www.hse.gov.uk/skin/' },
      { '@type': 'CreativeWork', name: 'NHBF analysis', url: 'https://www.nhbf.co.uk/news/x?a=1&b=2' },
    ]);
  });
});

describe('Organization.knowsAbout', () => {
  it('lists topics only, on every Organization node', () => {
    expect(buildKersivoOrganizationNode().knowsAbout).toEqual([...KERSIVO_KNOWS_ABOUT]);
    for (const topic of KERSIVO_KNOWS_ABOUT) expect(topic).not.toMatch(/\d|best|leading|#1|£/i);
  });
});
