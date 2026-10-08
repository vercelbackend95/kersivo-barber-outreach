import { describe, expect, it } from 'vitest';
import { calculateMonthlyCosts, validateCostScenario } from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO, PROVIDER_RESULTS } from './calculatorUi';
import { buildCalculatorView } from './resultView';
import { projectCostCalculation } from './costProjection';
import { encodeScenarioQuery, decodeScenarioQuery } from './calculatorUrlState';
import type { CostScenarioInput, ProviderMonthlyResult } from './barberSoftwareCostEngine';
import { PHOREST_UK_COMMERCIAL_FACTS } from '@/lib/seo/phorestFacts';

function phorest(override: Partial<CostScenarioInput> = {}): ProviderMonthlyResult {
  const result = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...override });
  if (!result.ok) throw new Error('Input rejected: ' + JSON.stringify(result.errors));
  return result.providers.find(x => x.provider === 'phorest')!;
}
describe('Phorest: safely integrated into the cost calculator', () => {
  it('keeps published subscription null and defaults to custom pricing', () => {
    expect(PHOREST_UK_COMMERCIAL_FACTS.monthlySubscriptionGbp.status).toBe('quote_required');
    const p = phorest();
    expect(p.status).toBe('custom-pricing');
    expect(p.amounts).toBeNull();
    expect(p.lineItems.find(x=>x.id==='phorest-subscription')).toMatchObject({
      status:'custom-pricing', exVatGbp:null,
    });
    expect(p.warnings.map(w=>w.code)).toContain('phorest-quote-required');
    expect(PROVIDER_RESULTS.find(x=>x.id==='phorest')?.breakdown).toHaveLength(3);
  });
  it('requires an actual pre-VAT quote AND confirmed VAT', () => {
    const quoteOnly = phorest({ phorestMonthlyQuoteGbp:125.50 });
    expect(quoteOnly.status).toBe('custom-pricing');
    expect(quoteOnly.warnings.map(x=>x.code)).toContain('phorest-vat-unknown');
    const withVat = phorest({ phorestMonthlyQuoteGbp:125.5, phorestQuoteVatPercent:20 });
    expect(withVat.status).toBe('calculated');
    if(withVat.status!=='calculated') throw new Error('not calculated');
    expect(withVat.amounts).toMatchObject({
      subscriptionExVatGbp:125.5, subtotalExVatGbp:125.5,
      vatChargedGbp:25.1, cashTotalGbp:150.6,
    });
    const noVat = phorest({ phorestMonthlyQuoteGbp:125.5, phorestQuoteVatPercent:0 });
    expect(noVat.status).toBe('calculated');
    if(noVat.status!=='calculated') throw new Error('not calculated');
    expect(noVat.amounts.cashTotalGbp).toBe(125.5);
    expect(noVat.amounts.vatChargedGbp).toBe(0);
  });
  it('does not invent PhorestPay fees when paid deposits are included',()=>{
    const p = phorest({
      phorestMonthlyQuoteGbp:125.5, phorestQuoteVatPercent:20,
      includeDepositProcessing:true, depositBookingsPerMonth:100,
    });
    expect(p.status).toBe('custom-pricing');
    expect(p.amounts).toBeNull();
    expect(p.lineItems.find(x=>x.id==='phorest-deposit-processing'))
      .toMatchObject({ status:'custom-pricing', quantity:100, exVatGbp:null });
    expect(p.warnings.map(x=>x.code)).toContain('phorest-processing-unknown');
    expect(p.lineItems.some(x=>x.paymentMethod === 'stripe-checkout-standard-uk-card')).toBe(false);
  });
  it('does not mistake zero deposit volume for a paid transaction',()=>{
    const p=phorest({
      phorestMonthlyQuoteGbp:100, phorestQuoteVatPercent:0,
      includeDepositProcessing:true, depositBookingsPerMonth:0,
    });
    expect(p.status).toBe('calculated');
    expect(p.lineItems.find(x=>x.id==='phorest-deposit-processing')).toMatchObject({
      status:'not-included', exVatGbp:0, quantity:0,
    });
  });
  it('rejects invalid quotes and VAT input without corrupting other providers',()=>{
    expect(validateCostScenario({ ...DEFAULT_SCENARIO,phorestMonthlyQuoteGbp:-1 }))
      .toContainEqual({field:'phorestMonthlyQuoteGbp',code:'below-minimum'});
    expect(validateCostScenario({ ...DEFAULT_SCENARIO,phorestMonthlyQuoteGbp:Number.NaN }))
      .toContainEqual({field:'phorestMonthlyQuoteGbp',code:'not-a-number'});
    expect(validateCostScenario({ ...DEFAULT_SCENARIO,phorestQuoteVatPercent:5 }))
      .toContainEqual({field:'phorestQuoteVatPercent',code:'invalid-phorest-vat'});
    const result=calculateMonthlyCosts(DEFAULT_SCENARIO);
    if(!result.ok) throw new Error('invalid');
    expect(result.providers.map(x=>x.provider)).toEqual(['booksy','fresha','nearcut','timely','treatwell','setora','square','phorest','kersivo','vagaro']);
    expect(result.providers[8].status).toBe('calculated');
  });
  it('quotes round-trip through shareable URL and project only confirmed values',()=>{
    const scenario={...DEFAULT_SCENARIO,phorestMonthlyQuoteGbp:125.5,phorestQuoteVatPercent:20};
    expect(decodeScenarioQuery(encodeScenarioQuery(scenario,'annual')).scenario).toEqual(scenario);
    const monthly=calculateMonthlyCosts(scenario);
    const projected=projectCostCalculation(monthly,'threeYear');
    if(!projected.ok)throw new Error('invalid');
    const p=projected.providers.find(x=>x.provider==='phorest');
    expect(p?.status).toBe('calculated');
    if(!p||p.status!=='calculated')throw new Error('not calculated');
    expect(p.amounts.cashTotalGbp).toBe(5421.6);
    const defaultView=buildCalculatorView(DEFAULT_SCENARIO,'monthly');
    expect(defaultView.providers.find(x=>x.id==='phorest')?.total).toBe('Custom pricing');
    const view=buildCalculatorView(scenario,'monthly');
    expect(view.providers.find(x=>x.id==='phorest')?.total).toContain('150.60');
    expect(view.providers.find(x=>x.id==='phorest')?.customNote).toContain('not the full Phorest bill');
  });
});
