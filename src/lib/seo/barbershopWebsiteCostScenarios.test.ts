import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  WEBSITE_COST_PRIMARY_IDS,
  getBooksyMonthlyPriceGbp,
  vagaroUkPublishedMonthlySubtotalGbp,
} from '@/lib/seo/barbershopWebsiteCostOffers';
import {
  CARD_CHECKS,
  COST_SCENARIO_C_12,
  COST_SCENARIO_C_36,
  SCENARIO_BARBER_COUNTS,
  SCENARIO_DEFAULT,
  SCENARIO_PERIODS,
  VAGARO_PUBLISHED_MAX_BARBERS,
  buildScenarioPayload,
  fullKersivoTotalGbp,
  getScenarioComparison,
  getScenarioProviderRow,
} from '@/lib/seo/barbershopWebsiteCostScenarios';

describe('barbershopWebsiteCostScenarios', () => {
  it('defaults to 4 barbers / 36 months and uses the six canonical IDs', () => {
    expect(SCENARIO_DEFAULT).toEqual({ barbers: 4, period: '36' });
    const comparison = getScenarioComparison();
    expect(comparison.providers.map((row) => row.id)).toEqual([...WEBSITE_COST_PRIMARY_IDS]);
    expect(comparison.providers).toHaveLength(6);
  });

  it('keeps chart and card figures identical for every control combination', () => {
    for (const barbers of SCENARIO_BARBER_COUNTS) {
      for (const period of SCENARIO_PERIODS) {
        const comparison = getScenarioComparison(barbers, period);
        for (const row of comparison.providers) {
          const again = getScenarioProviderRow(row.id, barbers, period);
          expect(again.amountGbp).toBe(row.amountGbp);
          expect(again.displayFigure).toBe(row.displayFigure);
          expect(again.status).toBe(row.status);
          expect(again.vatBasisLabel).toBe(row.vatBasisLabel);
        }
      }
    }
  });

  it('keeps Full KERSIVO flat at £39 / £468 / £1,404 across 2–8 barbers', () => {
    expect(SAAS_MONTHLY_GBP).toBe(39);
    expect(fullKersivoTotalGbp(12)).toBe(468);
    expect(fullKersivoTotalGbp(36)).toBe(1404);
    expect(COST_SCENARIO_C_12).toBe(468);
    expect(COST_SCENARIO_C_36).toBe(1404);

    for (const barbers of SCENARIO_BARBER_COUNTS) {
      expect(getScenarioProviderRow('full-kersivo', barbers, 'monthly').amountGbp).toBe(39);
      expect(getScenarioProviderRow('full-kersivo', barbers, '12').amountGbp).toBe(468);
      expect(getScenarioProviderRow('full-kersivo', barbers, '36').amountGbp).toBe(1404);
      expect(getScenarioProviderRow('full-kersivo', barbers, '36').status).toBe('per-location');
    }
  });

  it('scales Booksy with team size and includes UXHM setup once in period totals', () => {
    const fourMonthly = getScenarioProviderRow('uxhm-salon-growth', 4, 'monthly');
    const sixMonthly = getScenarioProviderRow('uxhm-salon-growth', 6, 'monthly');
    const four36 = getScenarioProviderRow('uxhm-salon-growth', 4, '36');
    const six12 = getScenarioProviderRow('uxhm-salon-growth', 6, '12');

    expect(fourMonthly.amountGbp).toBe(66);
    expect(fourMonthly.amountGbp).toBe(getBooksyMonthlyPriceGbp(4, 'including'));
    expect(fourMonthly.figureSecondary).toContain('£499');
    expect(sixMonthly.amountGbp).toBe(78);
    expect(sixMonthly.amountGbp).toBe(getBooksyMonthlyPriceGbp(6, 'including'));

    expect(four36.amountGbp).toBe(499 + 66 * 36);
    expect(six12.amountGbp).toBe(499 + 78 * 12);
    expect(four36.setupGbpIncluded).toBe(499);
    expect(fourMonthly.setupGbpIncluded).toBeNull();
    expect(four36.status).toBe('combined-stack');
  });

  it('marks Fresha indicative, Nearcut quote-only, and Setora conflict', () => {
    const fresha = getScenarioProviderRow('fresha-team-smart-website', 4, 'monthly');
    expect(fresha.status).toBe('indicative');
    expect(fresha.amountGbp).toBe(52.75);
    expect(fresha.vatBasisLabel.toLowerCase()).toContain('excl. vat');
    expect(fresha.isCompleteSubtotal).toBe(false);

    for (const barbers of SCENARIO_BARBER_COUNTS) {
      for (const period of SCENARIO_PERIODS) {
        const nearcut = getScenarioProviderRow('nearcut-subscription', barbers, period);
        expect(nearcut.amountGbp).toBeNull();
        expect(nearcut.displayFigure).toBe('Custom quote');
        expect(nearcut.status).toBe('quote-required');
      }
    }

    const setora = getScenarioProviderRow('setora-core', 8, '36');
    expect(setora.amountGbp).toBe(59 * 36);
    expect(setora.status).toBe('price-conflict');
    expect(setora.figureSecondary).toContain('£39');
    expect(getScenarioProviderRow('setora-core', 2, 'monthly').amountGbp).toBe(59);
  });

  it('publishes Vagaro for 2–7 and requires a quote at 8 calendars', () => {
    expect(VAGARO_PUBLISHED_MAX_BARBERS).toBe(7);
    expect(getScenarioProviderRow('vagaro-mysite', 4, 'monthly').amountGbp).toBe(65);
    expect(getScenarioProviderRow('vagaro-mysite', 4, 'monthly').amountGbp).toBe(
      vagaroUkPublishedMonthlySubtotalGbp(4),
    );
    expect(getScenarioProviderRow('vagaro-mysite', 6, 'monthly').amountGbp).toBe(85);
    expect(getScenarioProviderRow('vagaro-mysite', 7, 'monthly').amountGbp).toBe(
      vagaroUkPublishedMonthlySubtotalGbp(7),
    );
    expect(getScenarioProviderRow('vagaro-mysite', 7, '12').amountGbp).toBe(
      vagaroUkPublishedMonthlySubtotalGbp(7) * 12,
    );

    const eight = getScenarioProviderRow('vagaro-mysite', 8, '36');
    expect(eight.amountGbp).toBeNull();
    expect(eight.displayFigure).toBe('Quote required');
    expect(eight.status).toBe('quote-required');
  });

  it('never converts unknown amounts to zero and keeps VAT limitations visible', () => {
    const payload = buildScenarioPayload();
    expect(Object.keys(payload.states)).toHaveLength(
      SCENARIO_BARBER_COUNTS.length * SCENARIO_PERIODS.length,
    );

    for (const state of Object.values(payload.states)) {
      for (const row of state.providers) {
        if (row.amountGbp === null) {
          expect(row.displayFigure === 'Custom quote' || row.displayFigure === 'Quote required').toBe(
            true,
          );
        } else {
          expect(row.amountGbp).toBeGreaterThan(0);
        }
        expect(row.vatBasisLabel.length).toBeGreaterThan(0);
        expect(row.isCompleteSubtotal).toBe(false);
      }
      const nearcut = state.providers.find((row) => row.id === 'nearcut-subscription');
      expect(nearcut?.amountGbp).toBeNull();
    }
  });

  it('shows static check lists and no expandable breakdown', () => {
    expect(CARD_CHECKS['vagaro-mysite']).toEqual([
      'Website builder',
      'Online booking',
      'Per-calendar pricing',
      'Self-build setup',
    ]);
    expect(CARD_CHECKS['fresha-team-smart-website']).toEqual([
      'Smart Website',
      'Online booking',
      'Team-based pricing',
      'Indicative pricing',
    ]);
    expect(CARD_CHECKS['nearcut-subscription']).toEqual([
      'Website + booking',
      'Quote required',
      'Subscription model',
      'Custom pricing',
    ]);
    expect(CARD_CHECKS['setora-core']).toEqual([
      'Platform website',
      'Online booking',
      'Per-location pricing',
      'Price conflict',
    ]);
    expect(CARD_CHECKS['uxhm-salon-growth']).toEqual([
      'Done-for-you website',
      'Booksy booking',
      '£499 setup',
      'Separate booking cost',
    ]);
    expect(CARD_CHECKS['full-kersivo']).toEqual([
      'Branded website',
      'Online booking',
      '2–8 barbers included',
      'SMS reminders',
      'Shop tools',
    ]);

    const sectionDir = dirname(fileURLToPath(import.meta.url));
    const astro = readFileSync(
      join(sectionDir, '../../components/barbershop-website-cost/WebsiteCostScenarios.astro'),
      'utf8',
    );
    const script = readFileSync(
      join(sectionDir, '../../scripts/barbershopWebsiteCostScenarios.ts'),
      'utf8',
    );
    expect(astro).toContain('calc-segmented__option');
    expect(astro).toContain('bwcost-scenarios__checks');
    expect(astro).not.toContain('bwcost-scenarios-breakdown');
    expect(astro).not.toContain('data-bwcost-breakdown');
    expect(script).not.toContain('renderBreakdown');
    expect(script).not.toContain('data-bwcost-breakdown');
    expect(astro).not.toContain('bwcost-scenarios__wordmark');
    expect(astro).not.toContain('£948');
  });

  it('shows a distinct VAT line on every provider card', () => {
    const rows = Object.fromEntries(
      getScenarioComparison(4, '36').providers.map((row) => [row.id, row.cardVatLabel]),
    );
    expect(rows['vagaro-mysite']).toBe('VAT unconfirmed');
    expect(rows['fresha-team-smart-website']).toBe('Indicative, excluding VAT');
    expect(rows['nearcut-subscription']).toBe('Quote required');
    expect(rows['setora-core']).toBe('VAT and price conflict');
    expect(rows['uxhm-salon-growth']).toBe('Booksy includes VAT; website VAT unconfirmed');
    expect(rows['full-kersivo']).toBe('No VAT currently added');
  });

  it('builds a KERSIVO summary that matches the Full KERSIVO row', () => {
    const comparison = getScenarioComparison(4, '36');
    expect(comparison.kersivoSummary.amountGbp).toBe(1404);
    expect(comparison.kersivoSummary.displayFigure).toBe('£1,404');
    expect(comparison.kersivoSummary.ctaLabel).toBe('Your 3-year subtotal');
    expect(comparison.kersivoSummary.ctaSupport).toBe("At today's subscription rate");
    expect(getScenarioComparison(4, '12').kersivoSummary).toMatchObject({
      displayFigure: '£468',
      ctaLabel: 'Your 1-year subtotal',
    });
    expect(getScenarioComparison(8, 'monthly').kersivoSummary).toMatchObject({
      displayFigure: '£39',
      ctaLabel: 'Monthly subscription',
      ctaSupport: 'Per location',
    });
    expect(comparison.chartTitle).toBe('36-month published / indicative subtotals');
    expect(comparison.chartSubheading).toBe('For 4 bookable barbers');
    expect(comparison.chartDescription).toContain('4 bookable barbers');
    expect(comparison.chartDescription).toContain('not guaranteed complete costs');
    expect(getScenarioComparison(8, 'monthly').chartDescription).toContain('8 bookable barbers');
    expect(getScenarioComparison(5, '12').chartTitle).toBe(
      '12-month published / indicative subtotals',
    );
    expect(comparison.providers.find((row) => row.id === 'full-kersivo')?.amountGbp).toBe(
      comparison.kersivoSummary.amountGbp,
    );
  });
});
