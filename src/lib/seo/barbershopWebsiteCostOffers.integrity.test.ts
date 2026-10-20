import { describe, expect, it } from 'vitest';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  WEBSITE_COST_CURRENT_FINDINGS,
  WEBSITE_COST_PRIMARY_IDS,
  WEBSITE_COST_RESEARCH_BUYER,
  freshaUkIndicatedMonthlySubtotalGbp,
  getBooksyMonthlyPriceGbp,
  getComparableWebsiteCostFigures,
  getPrimaryWebsiteCostOffers,
  requireWebsiteCostOfferById,
  vagaroUkPublishedMonthlySubtotalGbp,
} from '@/lib/seo/barbershopWebsiteCostOffers';
import {
  COST_OFFER_PRIMARY_IDS,
  assertPrimaryOffersBoundToCanonicalCatalogue,
  getPrimaryCostOffers,
} from '@/lib/seo/barbershopWebsiteCostComparisonOffers';
import { getPrimaryWebsiteServiceComparisonOptions } from '@/lib/seo/websiteServiceComparison';

describe('website cost catalogue data integrity', () => {
  it('uses one primary ID list for Section 02 and the canonical catalogue', () => {
    expect(COST_OFFER_PRIMARY_IDS).toEqual([...WEBSITE_COST_PRIMARY_IDS]);
    expect([...WEBSITE_COST_PRIMARY_IDS]).toEqual([
      'vagaro-mysite',
      'fresha-team-smart-website',
      'nearcut-subscription',
      'setora-core',
      'uxhm-salon-growth',
      'full-kersivo',
    ]);
    assertPrimaryOffersBoundToCanonicalCatalogue();
  });

  it('derives Section 02 figures from canonical helpers (not a second price list)', () => {
    const barbers = WEBSITE_COST_RESEARCH_BUYER.bookableBarbers;
    const vagaro = getComparableWebsiteCostFigures('vagaro-mysite', barbers);
    const fresha = getComparableWebsiteCostFigures('fresha-team-smart-website', barbers);
    const nearcut = getComparableWebsiteCostFigures('nearcut-subscription', barbers);
    const setora = getComparableWebsiteCostFigures('setora-core', barbers);
    const uxhm = getComparableWebsiteCostFigures('uxhm-salon-growth', barbers);
    const kersivo = getComparableWebsiteCostFigures('full-kersivo', barbers);

    expect(vagaro.recurringGbpPerMonth).toBe(vagaroUkPublishedMonthlySubtotalGbp(barbers));
    expect(vagaro.recurringGbpPerMonth).toBe(WEBSITE_COST_CURRENT_FINDINGS.vagaroUkFourBarbersPlusMySite);
    expect(vagaro.recurringGbpPerMonth).toBe(65);

    expect(fresha.recurringGbpPerMonth).toBe(freshaUkIndicatedMonthlySubtotalGbp(barbers, false));
    expect(fresha.recurringGbpPerMonth).toBe(WEBSITE_COST_CURRENT_FINDINGS.freshaUkIndicativeFourExVat);
    expect(fresha.recurringGbpPerMonth).toBe(52.75);
    expect(fresha.recurringIncludingVatGbp).toBe(63.3);

    expect(nearcut.recurringGbpPerMonth).toBeNull();
    expect(nearcut.confidence).toBe('custom-quote');

    expect(setora.recurringGbpPerMonth).toBe(
      WEBSITE_COST_CURRENT_FINDINGS.setoraOwnerApprovedHeadlineGbp,
    );
    expect(setora.recurringGbpPerMonth).toBe(59);
    expect(setora.conflictingPublishedRecurringGbp).toEqual([39, 59]);
    expect(setora.conflictingPublishedRecurringGbp).toContain(
      WEBSITE_COST_CURRENT_FINDINGS.setoraOfficialSourceConflictGbp,
    );
    expect(setora.confidence).toBe('conflict');

    expect(uxhm.setupGbp).toBe(WEBSITE_COST_CURRENT_FINDINGS.uxhmSalonGrowthSetupGbp);
    expect(uxhm.setupGbp).toBe(499);
    expect(uxhm.externalBooksyMonthlyExVatGbp).toBe(getBooksyMonthlyPriceGbp(barbers, 'excluding'));
    expect(uxhm.externalBooksyMonthlyIncVatGbp).toBe(getBooksyMonthlyPriceGbp(barbers, 'including'));
    expect(uxhm.externalBooksyMonthlyIncVatGbp).toBe(66);

    expect(kersivo.recurringGbpPerMonth).toBe(SAAS_MONTHLY_GBP);
    expect(kersivo.recurringGbpPerMonth).toBe(39);
  });

  it('exposes the same comparable figures for future Section 04 cost calculations', () => {
    const forSection04 = WEBSITE_COST_PRIMARY_IDS.map((id) => getComparableWebsiteCostFigures(id));
    expect(forSection04).toHaveLength(6);
    expect(forSection04.every((row) => row.offerId.length > 0)).toBe(true);
    expect(forSection04.map((row) => row.offerId)).toEqual([...WEBSITE_COST_PRIMARY_IDS]);

    // Section 04 may sum setup + recurring where both are known; Nearcut stays quote-gated.
    const nearcut = forSection04.find((row) => row.offerId === 'nearcut-subscription');
    expect(nearcut?.recurringGbpPerMonth).toBeNull();
    expect(nearcut?.confidence).toBe('custom-quote');

    const kersivo = forSection04.find((row) => row.offerId === 'full-kersivo');
    expect(kersivo?.setupGbp).toBe(0);
    expect(kersivo?.recurringGbpPerMonth).toBe(SAAS_MONTHLY_GBP);
  });

  it('keeps Care distinct from hosting for self-build / self-setup / platform rows', () => {
    const offers = getPrimaryWebsiteCostOffers();
    const byId = Object.fromEntries(offers.map((offer) => [offer.id, offer]));

    expect(byId['vagaro-mysite']?.features.hosting).toBe('confirmed-in-plan');
    expect(byId['vagaro-mysite']?.comparisonScope?.care).toBe('not-in-tier');
    expect(byId['fresha-team-smart-website']?.features.hosting).toBe('confirmed-in-plan');
    expect(byId['fresha-team-smart-website']?.comparisonScope?.care).toBe('not-in-tier');
    expect(byId['setora-core']?.features.hosting).toBe('confirmed-in-plan');
    expect(byId['setora-core']?.comparisonScope?.care).toBe('not-in-tier');
    expect(byId['uxhm-salon-growth']?.comparisonScope?.care).toBe('separate');
    expect(byId['full-kersivo']?.comparisonScope?.care).toBe('included');
  });

  it('binds Section 02 presentation prices to canonical comparable figures', () => {
    const presentation = getPrimaryCostOffers();
    const section02 = getPrimaryWebsiteServiceComparisonOptions();
    const figures = Object.fromEntries(
      WEBSITE_COST_PRIMARY_IDS.map((id) => [id, getComparableWebsiteCostFigures(id)]),
    );

    expect(presentation.map((row) => row.id)).toEqual([...WEBSITE_COST_PRIMARY_IDS]);
    expect(section02.map((row) => row.id)).toEqual([...WEBSITE_COST_PRIMARY_IDS]);

    expect(section02[0]?.priceFigure).toBe(`£${figures['vagaro-mysite']!.recurringGbpPerMonth}`);
    expect(section02[1]?.priceFigure).toBe(`£${figures['fresha-team-smart-website']!.recurringGbpPerMonth}`);
    expect(section02[1]?.priceFigureSecondary).toContain('£63.30');
    expect(section02[2]?.priceFigure).toBe('Custom quote');
    expect(section02[3]?.priceFigure).toBe(`£${figures['setora-core']!.recurringGbpPerMonth}`);
    expect(section02[3]?.priceSecondary).toContain('£39');
    expect(section02[4]?.priceFigure).toBe(`£${figures['uxhm-salon-growth']!.setupGbp}`);
    expect(section02[4]?.priceFigureSecondary).toContain(
      `£${figures['uxhm-salon-growth']!.externalBooksyMonthlyIncVatGbp}`,
    );
    expect(section02[5]?.priceFigure).toBe(`£${figures['full-kersivo']!.recurringGbpPerMonth}`);

    // Legacy presentation IDs must not reappear as a parallel catalogue.
    expect(section02.some((row) => row.id === 'vagaro-pro-mysite')).toBe(false);
    expect(section02.some((row) => row.id === 'setora')).toBe(false);
    expect(section02.some((row) => row.id === 'uxhm-salon-growth-booksy')).toBe(false);

    expect(requireWebsiteCostOfferById('vagaro-mysite').id).toBe(section02[0]?.id);
  });
});
