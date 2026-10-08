import { describe, expect, it } from 'vitest';
import { NEARCUT_UK_COMMERCIAL_FACTS, requireIllustrativeNearcutFact, requireVerifiedNearcutFact } from '@/lib/seo/nearcutFacts';
import { calculateMonthlyCosts, type CostScenarioInput, type ProviderMonthlyResult } from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO } from './calculatorUi';
import { projectCostCalculation } from './costProjection';
import { buildCalculatorView } from './resultView';
import { decodeScenarioQuery, encodeScenarioQuery } from './calculatorUrlState';

const calc = (override: Partial<CostScenarioInput> = {}) => {
  const output = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...override });
  if (!output.ok) throw Error(JSON.stringify(output.errors));
  return output;
};
const nearcut = (override: Partial<CostScenarioInput> = {}): ProviderMonthlyResult => calc(override).providers[2];
const item = (result: ProviderMonthlyResult, id: string) => result.lineItems.find((x) => x.id === id)!;

describe('Nearcut integration: commercial truth over marketing estimates', () => {
  it('is the fourth competitor alongside Booksy, Fresha and KERSIVO', () => {
    expect(calc().providers.map(x=>x.provider)).toEqual(['booksy','fresha','nearcut','kersivo']);
    expect(calc().providers[3].provider).toBe('kersivo');
  });

  it('Free for You costs the shop £0 in this base model and DOES NOT charge the shop the customer fee', () => {
    expect(requireVerifiedNearcutFact('freeForYouMonthlySubscription').amountGbp).toBe(0);
    const illustration = requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample');
    expect(illustration.amountGbp).toBe(1.5);
    expect(illustration.status).toBe('illustrative');
    for (const appointments of [0, 50, 400, 5000]) {
      const shop = nearcut({ monthlyAppointments: appointments, nearcutSubscription: false });
      expect(shop.status).toBe('calculated');
      if (shop.status !== 'calculated') continue;
      expect(shop.amounts.cashTotalGbp).toBe(0);
      expect(shop.amounts.subscriptionExVatGbp).toBe(0);
      expect(shop.amounts.acquisitionFeesExVatGbp).toBe(0);
      expect(shop.warnings.map(w=>w.code)).toContain('nearcut-client-charge-not-universal');
      expect(shop.assumptions.map(a=>a.code)).toContain('nearcut-free-client-charge');
    }
  });

  it('Free for You deposit processing uses advertised zero fees with clear official terms caveat', () => {
    const shop = nearcut({ includeDepositProcessing: true, depositBookingsPerMonth: 100 });
    expect(item(shop, 'nearcut-deposit-processing')).toMatchObject({
      status:'calculated', category:'payment-processing', exVatGbp:0, quantity:100,
      unitExVatGbp:0, vatApplies:false, paymentMethod:'nearcut-free-online-payments',
    });
    expect(shop.assumptions.map(a=>a.code)).toContain('nearcut-free-online-payments');
    expect(NEARCUT_UK_COMMERCIAL_FACTS.standardOnlinePaymentProcessing.percent).toBe(2.9);
  });

  it('Subscription never invents the unpublished monthly quote or processes an example client fee', () => {
    const shop = nearcut({ nearcutSubscription:true, nearcutMonthlyQuoteGbp:0 });
    expect(shop.status).toBe('custom-pricing');
    expect(shop.amounts).toBeNull();
    expect(item(shop,'nearcut-subscription').status).toBe('custom-pricing');
    expect(shop.warnings.map(w=>w.code)).toContain('nearcut-quoted-cost-unknown');
  });

  it('Subscription accepts shop quote before VAT, removes customer charge, and projects correctly', () => {
    const scenario={ ...DEFAULT_SCENARIO, nearcutSubscription:true, nearcutMonthlyQuoteGbp:79.5, vatRegistered:true };
    const month=calculateMonthlyCosts(scenario);
    expect(month.ok).toBe(true);
    if (!month.ok) return;
    const shop=month.providers[2];
    expect(shop.status).toBe('calculated');
    if (shop.status !== 'calculated') return;
    expect(shop.amounts.subtotalExVatGbp).toBe(79.5);
    expect(shop.amounts.vatChargedGbp).toBe(15.9);
    expect(shop.amounts.cashTotalGbp).toBe(95.4);
    expect(shop.amounts.estimatedNetCostIfVatRecoverableGbp).toBe(79.5);
    expect(projectCostCalculation(month,'annual').providers[2].status).toBe('calculated');
    const annual=projectCostCalculation(month,'annual').providers[2];
    if (annual.status === 'calculated') expect(annual.amounts.cashTotalGbp).toBe(1144.8);
    expect(buildCalculatorView(scenario,'threeYear').providers[2].clientFeeNote).toContain('removes the client booking charge');
  });

  it('Subscription with online deposits is labelled Custom pricing until its processing terms are verified', () => {
    const shop=nearcut({nearcutSubscription:true,nearcutMonthlyQuoteGbp:79.5,includeDepositProcessing:true,depositBookingsPerMonth:100});
    expect(shop.status).toBe('custom-pricing');
    expect(shop.amounts).toBeNull();
    expect(item(shop,'nearcut-deposit-processing').status).toBe('custom-pricing');
    expect(shop.warnings.map(w=>w.code)).toContain('nearcut-processing-unresolved');
    const zero=nearcut({nearcutSubscription:true,nearcutMonthlyQuoteGbp:79.5,includeDepositProcessing:true,depositBookingsPerMonth:0});
    expect(zero.status).toBe('calculated');
  });

  it('invisible old quote cannot invalidate Free for You or leak into totals',()=>{
    const shop=nearcut({nearcutSubscription:false,nearcutMonthlyQuoteGbp:Number.NaN});
    expect(shop.status).toBe('calculated');
    const shared=calc({nearcutSubscription:false,nearcutMonthlyQuoteGbp:900}).providers[2];
    if(shared.status==='calculated')expect(shared.amounts.cashTotalGbp).toBe(0);
  });

  it('share URLs preserve plan choice, quoted price and cost periods',()=>{
    const scenario={...DEFAULT_SCENARIO,nearcutSubscription:true,nearcutMonthlyQuoteGbp:79.5};
    for(const period of ['monthly','annual','threeYear'] as const){
      const state=decodeScenarioQuery(encodeScenarioQuery(scenario,period));
      expect(state.scenario.nearcutSubscription).toBe(true);
      expect(state.scenario.nearcutMonthlyQuoteGbp).toBe(79.5);
      expect(state.period).toBe(period);
    }
  });

  it('Nearcut customer charge is visibly separate on every period and NOT a guaranteed numeric saving',()=>{
    const v=buildCalculatorView(DEFAULT_SCENARIO,'monthly').providers[2];
    expect(v.clientFeeNote).toContain('NOT a universal rate');
    expect(v.total).toBe('£0.00');
    expect(v.warnings.join(' ')).toContain('Client-paid costs');
  });
});
