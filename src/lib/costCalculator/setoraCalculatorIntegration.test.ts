import { describe, expect, it } from 'vitest';
import {
  SETORA_FACTS_CHECKED_ISO, SETORA_SOURCES,
  requireVerifiedSetoraFact,
} from '@/lib/seo/setoraFacts';
import {
  STRIPE_UK_STANDARD_CARD_FIXED_GBP,
  STRIPE_UK_STANDARD_CARD_PERCENT,
  STRIPE_FEE_VAT_CHARGED,
} from '@/lib/seo/stripeFacts';
import {
  calculateMonthlyCosts, type CostScenarioInput, type ProviderMonthlyResult,
} from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO, PROVIDER_RESULTS } from './calculatorUi';
import { projectCostCalculation } from './costProjection';
import { buildCalculatorView } from './resultView';
import { COST_CALCULATOR_SOURCES } from '@/lib/seo/barberCostCalculatorSources';

const calculate = (changes: Partial<CostScenarioInput> = {}) => {
  const result = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...changes });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
};
const setora = (changes: Partial<CostScenarioInput> = {}) => {
  return calculate(changes).providers.find((entry) => entry.provider === 'setora')!;
};
const line = (result: ProviderMonthlyResult, id: string) =>
  result.lineItems.find((entry) => entry.id === id)!;

describe('Setora cost calculator: documented UK commercial facts', () => {
  it('reads a checked standard subscription directly from Setora source of truth', () => {
    expect(SETORA_FACTS_CHECKED_ISO).toBe('2026-10-08');
    expect(requireVerifiedSetoraFact('canonicalMonthlyGbp').value).toBe(59);
    expect(requireVerifiedSetoraFact('barberLandingMonthlyGbp').value).toBe(59);
    expect(requireVerifiedSetoraFact('vatCurrentlyAdded').value).toBe(false);
    expect(requireVerifiedSetoraFact('platformBookingCommissionPercent').value).toBe(0);
    expect(requireVerifiedSetoraFact('platformSetupFeeGbp').value).toBe(0);
    expect(SETORA_SOURCES.find((s) => s.id === 'pricing')?.url).toBe('https://www.setora.co.uk/pricing');
  });

  it('adds Setora before KERSIVO in engine, cards and source list', () => {
    expect(calculate().providers.map((x) => x.provider)).toEqual([
      'booksy', 'fresha', 'nearcut', 'treatwell', 'setora', 'square', 'phorest', 'kersivo',
    ]);
    expect(PROVIDER_RESULTS.map((x) => x.id)).toEqual([
      'booksy', 'fresha', 'nearcut', 'treatwell', 'setora', 'square', 'phorest', 'kersivo',
    ]);
    expect(COST_CALCULATOR_SOURCES.filter((s) => s.provider === 'Setora')).toHaveLength(2);
    expect(COST_CALCULATOR_SOURCES.some((s) => s.provider === 'Stripe' && s.url === 'https://stripe.com/gb/pricing')).toBe(true);
  });

  it.each([1, 2, 4, 12, 30])('charges the same published price with %i bookable barbers', (bookableBarbers) => {
    const result = setora({ bookableBarbers });
    expect(result.status).toBe('calculated');
    if (result.status !== 'calculated') return;
    const monthly = requireVerifiedSetoraFact('canonicalMonthlyGbp').value;
    expect(result.amounts.cashTotalGbp).toBe(monthly);
    expect(line(result, 'setora-subscription').exVatGbp).toBe(monthly);
    expect(line(result, 'setora-additional-staff').exVatGbp).toBe(0);
    expect(line(result, 'setora-additional-staff').quantity).toBe(Math.max(0, bookableBarbers - 1));
    expect(result.amounts.vatChargedGbp).toBe(0);
    expect(line(result, 'setora-commission').exVatGbp).toBe(0);
  });

  it('never fabricates a marketplace charge from appointments or acquisition counts', () => {
    const result = setora({ monthlyAppointments: 2000, averageAppointmentValueGbp: 100, marketplaceClients: 20 });
    expect(line(result, 'setora-commission').exVatGbp).toBe(0);
    expect(line(result, 'setora-deposit-processing').status).toBe('not-included');
  });

  it('models Stripe standard UK card £5 deposit only when explicitly switched on', () => {
    expect([STRIPE_UK_STANDARD_CARD_PERCENT, STRIPE_UK_STANDARD_CARD_FIXED_GBP, STRIPE_FEE_VAT_CHARGED])
      .toEqual([1.5, 0.2, false]);
    const result = setora({ includeDepositProcessing: true, depositBookingsPerMonth: 100 });
    expect(result.status).toBe('calculated');
    if (result.status !== 'calculated') return;
    const processing = line(result, 'setora-deposit-processing');
    expect(processing.paymentMethod).toBe('stripe-setora-standard-uk-card');
    expect(processing.quantity).toBe(100);
    expect(processing.unitExVatGbp).toBe(0.28);
    expect(processing.exVatGbp).toBe(28);
    expect(processing.vatApplies).toBe(false);
    expect(result.amounts.cashTotalGbp).toBe(87);
    expect(result.assumptions.map((x) => x.code)).toContain('setora-standard-stripe-benchmark');
    expect(result.assumptions.map((x) => x.code)).toContain('setora-sms-excluded');
    const off = setora({ includeDepositProcessing: false, depositBookingsPerMonth: 100 });
    expect(line(off, 'setora-deposit-processing')).toMatchObject({ status:'not-included', exVatGbp:0 });
    expect(off.assumptions.map((x) => x.code)).not.toContain('setora-standard-stripe-benchmark');
  });

  it('handles £0 deposit volume and VAT-registered scenario without inventing tax', () => {
    const none = setora({ includeDepositProcessing: true, depositBookingsPerMonth: 0 });
    expect(line(none, 'setora-deposit-processing').exVatGbp).toBe(0);
    const vatShop = setora({ vatRegistered: true, includeDepositProcessing: true, depositBookingsPerMonth: 100 });
    expect(vatShop.status).toBe('calculated');
    if (vatShop.status !== 'calculated') return;
    expect(vatShop.amounts.vatChargedGbp).toBe(0);
    expect(vatShop.amounts.estimatedNetCostIfVatRecoverableGbp).toBe(87);
  });

  it('projects unchanged monthly estimates for 12 and 36 months', () => {
    const monthly = calculate({ includeDepositProcessing: true, depositBookingsPerMonth: 100 });
    for (const [period, months] of [['annual',12],['threeYear',36]] as const) {
      const output = projectCostCalculation(monthly, period);
      if (!output.ok) throw new Error('invalid');
      const result = output.providers.find((p) => p.provider === 'setora');
      expect(result?.status).toBe('calculated');
      if (result?.status !== 'calculated') continue;
      expect(result.amounts.cashTotalGbp).toBe(87 * months);
      expect(result.amounts.subscriptionExVatGbp).toBe(59 * months);
      expect(result.amounts.paymentProcessingExVatGbp).toBe(28 * months);
    }
  });

  it('renders cost and caveats in both server and client-shared view pipeline', () => {
    const view = buildCalculatorView(
      { ...DEFAULT_SCENARIO, includeDepositProcessing: true, depositBookingsPerMonth: 100 },
      'monthly',
    );
    const card = view.providers.find((p) => p.id === 'setora');
    expect(card?.total).toBe('£87.00');
    expect(card?.breakdown['setora-subscription']?.value).toBe('£59.00');
    expect(card?.breakdown['setora-deposit-processing']?.value).toBe('£28.00');
    expect(card?.assumptions.join(' ')).toContain('SMS credits');
    expect(card?.assumptions.join(' ')).toContain('standard UK online cards');
    expect(card?.assumptions.join(' ')).toContain('does not add VAT');
  });
});
