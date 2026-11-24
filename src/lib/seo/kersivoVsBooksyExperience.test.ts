import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { estimateBill, estimateBoost } from '@/lib/landing/booksyMath';
import {
  KVB_BILL_LEAD,
  KVB_BILL_NOTE,
  KVB_CHAPTERS,
  KVB_FEATURES,
  KVB_HERO,
  KVB_LEDGER_ROWS,
  KVB_PAGE_PATH,
} from './kersivoVsBooksyExperience';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const page = read('../../pages/kersivo-vs-booksy/index.astro');
const content = read('./kersivoVsBooksyExperience.ts');

describe('/kersivo-vs-booksy experience', () => {
  it('is indexable, in the sitemap and in the Compare menu', () => {
    expect(KVB_PAGE_PATH).toBe('/kersivo-vs-booksy');
    expect(page).not.toMatch(/noindex/);
    expect(page).toContain('canonicalPath={KVB_PAGE_PATH}');
    expect(page).toContain('buildKersivoVsBooksyWebPageJsonLd()');
    expect(MARKETING_SITEMAP_ENTRIES.some((entry) => entry.path === KVB_PAGE_PATH)).toBe(true);
    expect(MARKETING_NAV_ITEMS.some((item) => item.href === KVB_PAGE_PATH && item.group === 'compare')).toBe(true);
  });

  it('leads with Full KERSIVO and the free preview CTA; Starter stays secondary', () => {
    expect(KVB_HERO.primary).toBe('Get my free preview');
    expect(KVB_HERO.facts[0]).toBe('£39/month per location');
    expect(page).toContain('href={FREE_PREVIEW_CTA_HREF} data-track="build_preview_click"');
    expect(page).toContain('href="/starter" data-track="starter_plan_explore_click"');
  });

  it('pairs every 0% KERSIVO commission claim with Stripe fees', () => {
    const lines = [...KVB_HERO.facts, ...KVB_FEATURES.map((f) => f.body), ...KVB_LEDGER_ROWS.map((r) => r.kersivo)];
    for (const line of lines.filter((l) => /0% KERSIVO commission/.test(l))) {
      expect(line).toMatch(/Stripe/);
    }
  });

  it('takes every Booksy figure from booksyFacts rather than hard-coding it', () => {
    expect(content).not.toMatch(/£40|£5 plus|30%/);
    expect(KVB_BILL_LEAD).toContain('£40 a month plus VAT');
    expect(KVB_BILL_LEAD).toContain('£5 plus VAT for each additional user');
    expect(KVB_BILL_NOTE).toMatch(/not a total cost of ownership/);
  });

  it('walks three chapters, each with both sides and phone labels', () => {
    expect(KVB_CHAPTERS.map((c) => c.id)).toEqual(['land', 'brand', 'return']);
    for (const chapter of KVB_CHAPTERS) {
      expect(chapter.booksy.length).toBeGreaterThan(20);
      expect(chapter.kersivo.length).toBeGreaterThan(20);
      expect(chapter.marketChip && chapter.ownChip).toBeTruthy();
    }
  });

  it('matches the calculator maths the page animates', () => {
    expect(estimateBill(3).booksyIncVatGbp).toBe(60);
    const boost = estimateBoost({ newClients: 6, firstVisitGbp: 25 });
    expect(estimateBill(8).booksyIncVatGbp + boost.monthlyIncVatGbp).toBe(144);
  });

  it('keeps three.js out of the first paint and the page free of Prisma', () => {
    const experience = read('../landing/kvb/experience.ts');
    expect(experience).toContain("await import('./heroScene')");
    expect(experience).not.toMatch(/from 'three'/);
    expect(experience + read('../landing/kvb/heroScene.ts')).not.toMatch(/@\/lib\/db|prisma/i);
  });
});
