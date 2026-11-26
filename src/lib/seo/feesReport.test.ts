import { describe, expect, it } from 'vitest';
import { COST_SCENARIO_TABLES } from '@/lib/costCalculator/costScenarios';
import { estimateBooksyMonthlySubscription } from '@/lib/seo/booksyFacts';
import { estimateFreshaMonthlySubscription } from '@/lib/seo/freshaFacts';
import {
  FEES_REPORT_CARD_NOT_PUBLISHED,
  FEES_REPORT_CARD_ROWS,
  FEES_REPORT_COST_ROWS,
  FEES_REPORT_CSV_PATH,
  FEES_REPORT_PRESS_SUMMARY,
  FEES_REPORT_DIRECT_ANSWER,
  FEES_REPORT_FAQ_ITEMS,
  FEES_REPORT_NEW_CLIENT_ROWS,
  FEES_REPORT_PAGE_PATH,
  FEES_REPORT_QUOTE_ONLY,
  FEES_REPORT_SOURCES,
  FEES_REPORT_TEAM_SIZES,
  FEES_REPORT_TITLE,
  CSV_BOM,
  buildFeesReportCsv,
  buildFeesReportJsonLd,
  formatReportGbp,
} from '@/lib/seo/feesReport';
import { readFileSync, existsSync } from 'node:fs';
import {
  BOOKSY_VS_FRESHA_PAGE_PATH,
  BVF_COST_ROWS,
  BVF_CROSSOVER_BARBERS,
  BVF_DIRECT_ANSWER,
  BVF_ROWS,
  BVF_SOURCES,
  buildBooksyVsFreshaJsonLd,
} from '@/lib/seo/booksyVsFresha';
import { MARKETING_SITEMAP_ENTRIES } from '@/lib/seo/marketingSitemap';

describe('fees report', () => {
  it('takes every monthly cost from the calculator engine worked examples', () => {
    expect(FEES_REPORT_TEAM_SIZES).toEqual(COST_SCENARIO_TABLES.map((table) => table.barbers));
    for (const row of FEES_REPORT_COST_ROWS) {
      row.monthly.forEach((value, index) => {
        const engine = COST_SCENARIO_TABLES[index].rows.find((entry) => entry.providerId === row.providerId)!;
        expect(value).toBe(engine.monthlyGbp);
      });
    }
  });

  it('lists quote-only providers instead of estimating them', () => {
    expect(FEES_REPORT_QUOTE_ONLY.length).toBeGreaterThan(0);
    for (const name of FEES_REPORT_QUOTE_ONLY) {
      expect(FEES_REPORT_COST_ROWS.find((row) => row.name === name)!.monthly.every((value) => value === null)).toBe(true);
    }
  });

  it('computes card fees on £25 with VAT only where the provider adds it', () => {
    const booksy = FEES_REPORT_CARD_ROWS.find((row) => row.id === 'booksy')!;
    expect(booksy.feeOnExample).toBe(Math.round((25 * 0.0129 + 0.2) * 1.2 * 100) / 100);
    const kersivo = FEES_REPORT_CARD_ROWS.find((row) => row.id === 'kersivo')!;
    expect(kersivo.vat).toBe('none');
    expect(kersivo.feeOnExample).toBe(0.57);
    const sorted = [...FEES_REPORT_CARD_ROWS].sort((a, b) => a.feeOnExample - b.feeOnExample);
    expect(FEES_REPORT_CARD_ROWS).toEqual(sorted);
  });

  it('shows KERSIVO at 0% on new clients', () => {
    expect(FEES_REPORT_NEW_CLIENT_ROWS.find((row) => row.id === 'kersivo')!.fees.every((fee) => fee === 0)).toBe(true);
  });

  it('dates every source and keeps the title and answer stable', () => {
    for (const source of FEES_REPORT_SOURCES) {
      expect(source.checked).toMatch(/^\d{1,2} [A-Z][a-z]+ 20\d\d$/);
      expect(source.url).toMatch(/^https:\/\//);
    }
    expect(FEES_REPORT_TITLE.length).toBeLessThanOrEqual(60);
    expect(FEES_REPORT_DIRECT_ANSWER).toMatch(/^On published UK prices/);
    expect(FEES_REPORT_FAQ_ITEMS[0].answer).toBe(FEES_REPORT_DIRECT_ANSWER);
  });

  it('publishes Report, Dataset, BreadcrumbList and FAQPage JSON-LD', () => {
    expect(buildFeesReportJsonLd().map((node) => node['@type'])).toEqual(['Report', 'Dataset', 'BreadcrumbList', 'FAQPage']);
  });

  it('exports every table figure to CSV, one per row', () => {
    const csv = buildFeesReportCsv();
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split(/\r\n/);
    expect(lines[0]).toBe('table,system,detail,input,value_gbp,note');
    const expectedRows =
      FEES_REPORT_COST_ROWS.length * FEES_REPORT_TEAM_SIZES.length +
      FEES_REPORT_NEW_CLIENT_ROWS.reduce((sum, row) => sum + row.fees.length, 0) +
      FEES_REPORT_CARD_ROWS.length +
      FEES_REPORT_CARD_NOT_PUBLISHED.length;
    expect(lines).toHaveLength(expectedRows + 1);
    for (const row of FEES_REPORT_COST_ROWS) {
      for (const value of row.monthly) {
        if (value !== null) expect(csv).toContain(`,${value.toFixed(2)},`);
      }
    }
    for (const row of FEES_REPORT_CARD_ROWS) expect(csv).toContain(`,${row.feeOnExample.toFixed(2)},`);
    expect(csv).not.toContain('undefined');
    expect(csv).not.toContain('NaN');
  });

  it('serves the CSV as a static file and lists it as the Dataset download', () => {
    expect(FEES_REPORT_CSV_PATH).toBe(`${FEES_REPORT_PAGE_PATH}/fees.csv`);
    expect(existsSync('src/pages/barber-booking-fees-uk/fees.csv.ts')).toBe(true);
    const route = readFileSync('src/pages/barber-booking-fees-uk/fees.csv.ts', 'utf8');
    expect(route).toContain('export const prerender = true');
    expect(route).toContain('text/csv');
    const dataset = buildFeesReportJsonLd().find((node) => node['@type'] === 'Dataset')!;
    expect(dataset.distribution).toMatchObject({ '@type': 'DataDownload', encodingFormat: 'text/csv' });
    expect(String((dataset.distribution as { contentUrl: string }).contentUrl)).toMatch(/\/barber-booking-fees-uk\/fees\.csv$/);
    const page = readFileSync('src/pages/barber-booking-fees-uk/index.astro', 'utf8');
    expect(page).toContain('href={FEES_REPORT_CSV_PATH}');
    expect(page).toContain('{FEES_REPORT_PRESS_SUMMARY}');
  });

  it('builds the quotable paragraph only from figures in the tables, with a disclosure', () => {
    const tableFigures = new Set<string>([
      '£0',
      '£25',
      ...FEES_REPORT_COST_ROWS.flatMap((row) => row.monthly.filter((v): v is number => v !== null).map(formatReportGbp)),
      ...FEES_REPORT_NEW_CLIENT_ROWS.flatMap((row) => row.fees.map(formatReportGbp)),
      ...FEES_REPORT_CARD_ROWS.map((row) => formatReportGbp(row.feeOnExample)),
    ]);
    for (const figure of FEES_REPORT_PRESS_SUMMARY.match(/£\d+(?:\.\d{2})?/g) ?? []) {
      expect(tableFigures.has(figure), figure).toBe(true);
    }
    expect(FEES_REPORT_PRESS_SUMMARY).toMatch(/^According to KERSIVO’s UK barber booking software fees report/);
    expect(FEES_REPORT_PRESS_SUMMARY).toContain('KERSIVO sells booking software');
  });
});

describe('/booksy-vs-fresha', () => {
  it('builds team-size costs from the facts estimators', () => {
    for (const row of BVF_COST_ROWS) {
      expect(row.booksy).toBe(estimateBooksyMonthlySubscription(row.barbers).incVatGbp);
      expect(row.fresha).toBe(estimateFreshaMonthlySubscription(row.barbers).incVatGbp);
    }
  });

  it('finds the team size where Booksy becomes cheaper and says so in the answer', () => {
    expect(BVF_CROSSOVER_BARBERS).toBe(8);
    expect(BVF_DIRECT_ANSWER).toContain('cheaper up to 7 barbers; from 8 barbers, Booksy’s is cheaper');
  });

  it('keeps one row per topic and dated sources for both providers', () => {
    expect(new Set(BVF_ROWS.map((row) => row.topic)).size).toBe(BVF_ROWS.length);
    expect(new Set(BVF_SOURCES.map((source) => source.provider))).toEqual(new Set(['Booksy', 'Fresha']));
    expect(buildBooksyVsFreshaJsonLd().map((node) => node['@type'])).toEqual(['WebPage', 'BreadcrumbList', 'FAQPage']);
  });
});

describe('sitemap', () => {
  it('lists both new pages', () => {
    const paths = MARKETING_SITEMAP_ENTRIES.map((entry) => entry.path);
    expect(paths).toContain(FEES_REPORT_PAGE_PATH);
    expect(paths).toContain(BOOKSY_VS_FRESHA_PAGE_PATH);
  });
});
