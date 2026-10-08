import { describe, expect, it } from 'vitest';
import { calculateMonthlyCosts } from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO, PROVIDER_RESULTS } from './calculatorUi';
import { projectCostCalculation } from './costProjection';
import { buildCalculatorView } from './resultView';
import { decodeScenarioQuery, encodeScenarioQuery } from './calculatorUrlState';
import { requireVerifiedTimelyFact } from '@/lib/seo/timelyFacts';

const run = (extras: Partial<typeof DEFAULT_SCENARIO> = {}) => {
  const output = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...extras });
  if (!output.ok) throw new Error(JSON.stringify(output.errors));
  return output;
};
const timely = (extras: Partial<typeof DEFAULT_SCENARIO> = {}) => run(extras).providers.find(x => x.provider === 'timely')!;
const line = (name: string, extras: Partial<typeof DEFAULT_SCENARIO> = {}) => timely(extras).lineItems.find(x=>x.id===name)!;

describe('Timely integration with the current UK calculator', () => {
  it('preserves nine prior providers and adds Timely as a tenth model', () => {
    const providers=run().providers.map(x=>x.provider);
    expect(providers).toEqual(['booksy','fresha','nearcut','timely','treatwell','setora','square','phorest','kersivo','vagaro']);
    expect(PROVIDER_RESULTS.map(x=>x.id)).toContain('timely');
    expect(new Set(providers).size).toBe(10);
  });
  it('requires the real UK invoice, rather than silently treating an unverified subscription as free', () => {
    expect(timely().status).toBe('custom-pricing');
    expect(timely().amounts).toBeNull();
    expect(line('timely-subscription').exVatGbp).toBeNull();
    expect(timely().warnings.map(x=>x.code)).toContain('timely-quote-unknown');
    expect(buildCalculatorView(DEFAULT_SCENARIO,'monthly').providers.find(x=>x.id==='timely')?.state).toBe('custom-pricing');
  });
  it('computes actual quote and published domestic UK TimelyPay fee without double-charging VAT', () => {
    const actual=timely({timelyMonthlyInvoiceGbp:60,includeDepositProcessing:true,depositBookingsPerMonth:100,vatRegistered:true});
    expect(actual.status).toBe('calculated');
    if (actual.status!=='calculated') throw new Error('unpriced');
    expect(line('timely-deposit-processing',{timelyMonthlyInvoiceGbp:60,includeDepositProcessing:true,depositBookingsPerMonth:100})).toMatchObject({quantity:100,unitExVatGbp:0.39,exVatGbp:39});
    expect(actual.amounts.cashTotalGbp).toBe(99);
    expect(actual.amounts.vatChargedGbp).toBe(0);
    expect(actual.amounts.estimatedNetCostIfVatRecoverableGbp).toBeNull();
    const rate=requireVerifiedTimelyFact('ukOnlinePaymentProcessing');
    expect(rate).toMatchObject({status:'verified',percent:1.85,fixedGbp:0.30,market:'UK'});
  });
  it('projects confirmed Timely amounts for 12 and 36 months',()=>{
    const inputs={...DEFAULT_SCENARIO,timelyMonthlyInvoiceGbp:60,includeDepositProcessing:true,depositBookingsPerMonth:100};
    const a=projectCostCalculation(calculateMonthlyCosts(inputs),'annual');
    const b=projectCostCalculation(calculateMonthlyCosts(inputs),'threeYear');
    if(!a.ok||!b.ok)throw new Error('invalid');
    const year=a.providers.find(x=>x.provider==='timely');
    const three=b.providers.find(x=>x.provider==='timely');
    expect(year?.status).toBe('calculated');expect(three?.status).toBe('calculated');
    if(year?.status==='calculated')expect(year.amounts.cashTotalGbp).toBe(1188);
    if(three?.status==='calculated')expect(three.amounts.cashTotalGbp).toBe(3564);
  });
  it('uses unique ti URL key, keeping existing Treatwell tq untouched',()=>{
    const s={...DEFAULT_SCENARIO,timelyMonthlyInvoiceGbp:72.5,treatwellMonthlyQuoteGbp:88};
    const query=encodeScenarioQuery(s,'annual');
    expect(query).toContain('ti=72.5');
    expect(query).toContain('tq=88');
    expect(decodeScenarioQuery(query).scenario).toEqual(s);
  });
});
