import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  KAR_ANSWER,
  KAR_CHAPTERS,
  KAR_CLOSE_NOTE,
  KAR_DESCRIPTION,
  KAR_FAQS,
  KAR_HERO,
  KAR_METRICS,
  KAR_PAGE_PATH,
  KAR_PLAN_ROWS,
  KAR_TITLE,
} from './adminReportsExperience';
import { buildAdminReportsJsonLd } from './adminReportsJsonLd';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { buildLlmsTxt } from '@/pages/llms.txt';
import { buildKarStudioData } from '@/lib/landing/kar/reportsDemo';
import { karChartPaths, karKpis, normalise, resample } from '@/lib/landing/kar/studioFormat';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const page = read('../../pages/barbershop-reports/index.astro');
const content = read('./adminReportsExperience.ts');

type Graph = { '@graph': Array<Record<string, unknown>> };
const node = (type: string) => (buildAdminReportsJsonLd() as Graph)['@graph'].find((n) => n['@type'] === type)!;

describe('/barbershop-reports (Admin & Reports)', () => {
  it('is indexable, canonical, in the sitemap, the Product menu and llms.txt', () => {
    expect(KAR_PAGE_PATH).toBe('/barbershop-reports');
    expect(page).not.toMatch(/noindex/);
    expect(page).toContain('canonicalPath={KAR_PAGE_PATH}');
    expect(MARKETING_SITEMAP_ENTRIES.some((entry) => entry.path === KAR_PAGE_PATH)).toBe(true);
    const navItem = MARKETING_NAV_ITEMS.find((item) => item.id === 'platform-admin');
    expect(navItem).toMatchObject({ href: KAR_PAGE_PATH, group: 'product', label: 'Admin & reports' });
    expect(buildLlmsTxt('https://kersivo.co.uk')).toContain(`(https://kersivo.co.uk${KAR_PAGE_PATH})`);
  });

  it('has a hook title (no brand) and a description that keep the commercial wording', () => {
    // Deliberately long: a question-led hook the founder asked for. Google may trim the tail.
    expect(KAR_TITLE.length).toBeLessThanOrEqual(70);
    expect(KAR_TITLE).toMatch(/^Barbershop Reports/);
    expect(KAR_TITLE).not.toMatch(/KERSIVO/i);
    expect(KAR_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(KAR_DESCRIPTION).toContain('£39/month per location');
  });

  it('leads with Full KERSIVO and the free preview; Starter stays secondary', () => {
    expect(KAR_HERO.primary).toBe('Get my free preview');
    expect(KAR_HERO.facts[0]).toContain('£39/month per location');
    expect(page).toContain('href={FREE_PREVIEW_CTA_HREF} data-track="build_preview_click"');
    expect(page).toContain('href="/starter" data-track="starter_plan_explore_click"');
    expect(page.indexOf('build_preview_click')).toBeLessThan(page.indexOf('starter_plan_explore_click'));
  });

  it('pairs 0% KERSIVO commission with Stripe fees and never calls service value revenue', () => {
    expect(KAR_CLOSE_NOTE).toMatch(/0% KERSIVO commission/);
    expect(KAR_CLOSE_NOTE).toMatch(/Stripe/);
    expect(content).not.toMatch(/\brevenue\b/i);
    expect(page).not.toMatch(/>\s*(Sales|Revenue)\s*</);
  });

  it('keeps Reports a Full KERSIVO feature', () => {
    const reports = KAR_PLAN_ROWS.find((row) => row.label === 'Reports');
    expect(reports).toEqual({ label: 'Reports', starter: 'Not included', full: 'Included' });
    expect(KAR_FAQS.find((faq) => /Starter/.test(faq.question))?.answer).toMatch(/^No\./);
  });

  it('answers the "what is it" question in plain text and mirrors it in JSON-LD', () => {
    expect(KAR_ANSWER).toMatch(/^KERSIVO Admin & Reports is the owner dashboard in Full KERSIVO/);
    expect(node('WebPage').abstract).toBe(KAR_ANSWER);
  });

  it('mirrors the visible FAQ and metric glossary in JSON-LD word for word', () => {
    const faq = node('FAQPage') as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(KAR_FAQS.map((q) => q.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(KAR_FAQS.map((q) => q.answer));
    const terms = node('DefinedTermSet') as { hasDefinedTerm: { name: string; description: string }[] };
    expect(terms.hasDefinedTerm.map((t) => t.name)).toEqual(KAR_METRICS.map((m) => m.name));
    expect(terms.hasDefinedTerm.map((t) => t.description)).toEqual(KAR_METRICS.map((m) => m.definition));
    expect(JSON.stringify(buildAdminReportsJsonLd())).not.toMatch(/aggregateRating|review/i);
  });

  it('walks five dashboard screens named after real sidebar sections, in sidebar order', () => {
    expect(KAR_CHAPTERS.map((c) => c.section)).toEqual(['Bookings', 'Team', 'Reports', 'Clients', 'Sales']);
  });

  it('feeds the studio from the demo dashboard data for every range', () => {
    const data = buildKarStudioData();
    for (const key of ['1d', '7d', '30d', '1y'] as const) {
      const range = data[key];
      expect(range.bookings).toBeGreaterThan(0);
      expect(range.series.bookings.reduce((a, b) => a + b, 0)).toBe(range.bookings);
      expect(range.leaderboard.length).toBeGreaterThan(0);
      const kpis = karKpis(range);
      expect(kpis.bookings.value).toMatch(/\d/);
      const { line, area } = karChartPaths(normalise(resample(range.series.bookings)));
      expect(line.startsWith('M')).toBe(true);
      expect(area.endsWith('Z')).toBe(true);
    }
    expect(data['7d'].busiestBarber).toBe(data['7d'].leaderboard[0].name);
  });

  it('keeps three.js out of first paint and the page free of Prisma', () => {
    const experience = read('../landing/kar/experience.ts');
    expect(experience).toContain("await import('./heroScene')");
    expect(experience).not.toMatch(/from 'three'/);
    // Type-only imports are erased; the fixtures must never reach the client bundle.
    expect(experience).not.toMatch(/^import (?!type )[^;]*from '\.\/(reportsDemo|chapterDemo)'/m);
    const all = experience + read('../landing/kar/heroScene.ts') + read('../landing/kar/reportsDemo.ts') + read('../landing/kar/filmDirector.ts');
    expect(all).not.toMatch(/@\/lib\/db|prisma/i);
  });
});
