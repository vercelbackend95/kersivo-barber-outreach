import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HUB_CRITERIA,
  HUB_CRITERION_IDS,
  HUB_SUGGESTED_CRITERIA,
} from '@/lib/compare/alternativesHubCriteria';
import {
  COMPETITOR_HUB_PLATFORMS,
  HUB_PLATFORMS,
  KERSIVO_HUB_PLATFORM,
  buildHubStatusMatrix,
} from '@/lib/compare/alternativesHubData';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(here, '../../pages');

function pageExists(href: string): boolean {
  const path = href.replace(/^\//, '');
  return existsSync(join(pagesDir, path, 'index.astro')) || existsSync(join(pagesDir, `${path}.astro`));
}

const EXPECTED_COMPETITOR_ROUTES = [
  '/booksy-alternative',
  '/fresha-alternative',
  '/nearcut-alternative',
  '/treatwell-alternative',
  '/timely-alternative',
  '/phorest-alternative',
  '/setora-alternative',
  '/square-appointments-alternative',
  '/squire-alternative',
  '/vagaro-alternative',
];

describe('alternatives hub criteria', () => {
  it('defines 12 criteria with precise definitions and yes/partial rules', () => {
    expect(HUB_CRITERIA).toHaveLength(12);
    expect(HUB_CRITERIA.map((c) => c.id)).toEqual([...HUB_CRITERION_IDS]);
    for (const criterion of HUB_CRITERIA) {
      expect(criterion.definition.length, criterion.id).toBeGreaterThan(30);
      expect(criterion.yes.length, criterion.id).toBeGreaterThan(10);
      expect(criterion.limited.length, criterion.id).toBeGreaterThan(10);
    }
  });

  it('separates platform commission from payment processing and uses a published price threshold', () => {
    const commission = HUB_CRITERIA.find((c) => c.id === 'zeroCommission')!;
    expect(commission.definition).toMatch(/payment-processing fees are excluded/i);
    const affordable = HUB_CRITERIA.find((c) => c.id === 'affordable')!;
    expect(affordable.definition).toContain('£40/month');
    expect(affordable.definition).toMatch(/before VAT/);
    const data = HUB_CRITERIA.find((c) => c.id === 'clientDataExport')!;
    expect(data.definition).toMatch(/not legal ownership/);
  });

  it('only suggests known criteria', () => {
    for (const id of HUB_SUGGESTED_CRITERIA) expect(HUB_CRITERION_IDS).toContain(id);
  });
});

describe('alternatives hub platforms', () => {
  it('lists KERSIVO first followed by every existing competitor alternative page', () => {
    expect(HUB_PLATFORMS[0]).toBe(KERSIVO_HUB_PLATFORM);
    expect(HUB_PLATFORMS.filter((p) => p.isFirstParty)).toHaveLength(1);
    expect(COMPETITOR_HUB_PLATFORMS.map((p) => p.href)).toEqual(EXPECTED_COMPETITOR_ROUTES);
  });

  it('points every card at an existing page route', () => {
    for (const platform of HUB_PLATFORMS) {
      expect(pageExists(platform.href), platform.href).toBe(true);
    }
  });

  it('includes every existing *-alternative page in the hub', () => {
    const hrefs = new Set(HUB_PLATFORMS.map((p) => p.href));
    const alternativePages = ['booksy', 'fresha', 'nearcut', 'treatwell', 'timely', 'phorest', 'setora', 'square-appointments', 'squire', 'vagaro'];
    for (const slug of alternativePages) expect(hrefs.has(`/${slug}-alternative`)).toBe(true);
  });

  it('gives every platform a status for every criterion', () => {
    for (const platform of HUB_PLATFORMS) {
      expect(Object.keys(platform.attributes).sort(), platform.id).toEqual([...HUB_CRITERION_IDS].sort());
    }
  });

  it('cites a source present in that platform’s sources for every non-unverified status', () => {
    for (const platform of HUB_PLATFORMS) {
      const sourceIds = new Set(platform.sources.map((s) => s.id));
      for (const [criterion, attribute] of Object.entries(platform.attributes)) {
        expect(attribute.note.length, `${platform.id}.${criterion}`).toBeGreaterThan(5);
        if (attribute.status !== 'unverified') {
          expect(attribute.sourceId, `${platform.id}.${criterion}`).toBeTruthy();
          expect(sourceIds.has(attribute.sourceId!), `${platform.id}.${criterion} -> ${attribute.sourceId}`).toBe(true);
        }
      }
    }
  });

  it('uses only official https sources and a verification date for competitors', () => {
    for (const platform of COMPETITOR_HUB_PLATFORMS) {
      expect(platform.sources.length, platform.id).toBeGreaterThan(0);
      expect(platform.checkedIso, platform.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const source of platform.sources) expect(source.url, platform.id).toMatch(/^https:\/\//);
    }
  });

  it('never marks a competitor as definitively lacking deposits, booking or client data without evidence', () => {
    for (const platform of COMPETITOR_HUB_PLATFORMS) {
      for (const criterion of ['deposits', 'clientDataExport', 'migration'] as const) {
        expect(platform.attributes[criterion].status, `${platform.id}.${criterion}`).not.toBe('no');
      }
    }
  });

  it('keeps SQUIRE without a price because no UK GBP price is verified', () => {
    const squire = COMPETITOR_HUB_PLATFORMS.find((p) => p.id === 'squire')!;
    expect(squire.pricingSummary).toBeNull();
    expect(squire.attributes.affordable.status).toBe('unverified');
  });

  it('benchmarks KERSIVO on the Full plan with claims-policy wording', () => {
    expect(KERSIVO_HUB_PLATFORM.pricingSummary).toContain(`£${SAAS_MONTHLY_GBP}/month per location`);
    expect(KERSIVO_HUB_PLATFORM.pricingSummary).not.toMatch(/including VAT|forever/i);
    expect(KERSIVO_HUB_PLATFORM.attributes.zeroCommission.note).toMatch(/Stripe processing fees apply separately/);
    expect(KERSIVO_HUB_PLATFORM.attributes.smsReminders.note).toMatch(/allowance/);
    expect(KERSIVO_HUB_PLATFORM.attributes.smsReminders.note).not.toMatch(/unlimited/i);
  });

  it('builds a status matrix for every platform', () => {
    const matrix = buildHubStatusMatrix();
    expect(Object.keys(matrix)).toEqual(HUB_PLATFORMS.map((p) => p.id));
  });
});
