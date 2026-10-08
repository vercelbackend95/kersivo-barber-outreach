import { describe, expect, it } from 'vitest';
import { calculateMonthlyCosts, type CostScenarioInput } from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO, PROVIDER_RESULTS } from './calculatorUi';
import { projectCostCalculation } from './costProjection';
import { buildCalculatorView } from './resultView';
import { decodeScenarioQuery, encodeScenarioQuery } from './calculatorUrlState';
import { SQUARE_CALCULATOR_LIMITS, SQUARE_UK_PLANS, squareBaseMonthlyPriceGbp } from '@/lib/seo/squareFacts';
import { COST_CALCULATOR_SOURCES } from '@/lib/seo/barberCostCalculatorSources';

const calculate = (changes: Partial<CostScenarioInput> = {}) => {
  const output = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...changes });
  if (!output.ok) throw new Error(JSON.stringify(output.errors));
  return output;
};
const square = (changes: Partial<CostScenarioInput> = {}) =>
  calculate(changes).providers.find((p) => p.provider === 'square')!;

describe('Square Appointments UK cost-calculator integration', () => {
  it('uses one audited pricing source and puts Square in both engine and visible cards', () => {
    expect(SQUARE_UK_PLANS.map(p => p.monthlyGbp)).toEqual([0,29,69]);
    expect(calculate().providers.map(p=>p.provider)).toEqual(['booksy','fresha','nearcut','treatwell','setora','square','phorest','kersivo']);
    expect(PROVIDER_RESULTS.map(p=>p.id)).toEqual(['booksy','fresha','nearcut','treatwell','setora','square','phorest','kersivo']);
    expect(squareBaseMonthlyPriceGbp('plus')).toBe(29);
    expect(squareBaseMonthlyPriceGbp('premium')).toBe(69);
    expect(COST_CALCULATOR_SOURCES.filter(s=>s.provider==='Square Appointments').length).toBeGreaterThanOrEqual(2);
  });
  it('models Free as a published zero subscription without inventing booking or staff fees', () => {
    const free = square({ squarePlan:'free', bookableBarbers:30, monthlyAppointments:2000 });
    expect(free.status).toBe('calculated');
    if(free.status !== 'calculated')return;
    expect(free.amounts.cashTotalGbp).toBe(0);
    expect(free.lineItems.find(x=>x.id==='square-subscription')).toMatchObject({exVatGbp:0,plan:'free'});
    expect(free.lineItems.find(x=>x.id==='square-deposit-processing')).toMatchObject({status:'not-included',exVatGbp:0});
    expect(free.assumptions.map(x=>x.code)).toContain('square-fees-excluded');
  });
  it('shows the £29 and £69 published headline without inventing VAT or complete totals', () => {
    for(const [plan,headline] of [['plus',29],['premium',69]] as const) {
      const paid=square({ squarePlan:plan });
      expect(paid.status).toBe('custom-pricing');
      expect(paid.amounts).toBeNull();
      const sub=paid.lineItems.find(x=>x.id==='square-subscription')!;
      expect(sub.publishedHeadlineGbp).toBe(headline);
      expect(sub.exVatGbp).toBeNull();
      expect(paid.warnings.map(x=>x.code)).toContain('square-subscription-vat-unverified');
      const card=buildCalculatorView({...DEFAULT_SCENARIO,squarePlan:plan},'monthly').providers.find(x=>x.id==='square')!;
      expect(card.total).toBe('Not estimated');
      expect(card.breakdown['square-subscription']?.value).toContain('£'+headline+'.00/mo');
      expect(card.customNote).toContain('VAT');
    }
    expect(SQUARE_CALCULATOR_LIMITS.paidSubscriptionVatVerified).toBe(false);
  });
  it('never substitutes Square Online processing for Square Appointments deposits', () => {
    const withDeposits=square({squarePlan:'free',includeDepositProcessing:true,depositBookingsPerMonth:100});
    expect(withDeposits.status).toBe('custom-pricing');
    expect(withDeposits.amounts).toBeNull();
    expect(withDeposits.lineItems.find(x=>x.id==='square-deposit-processing')).toMatchObject({
      status:'custom-pricing',exVatGbp:null,unitExVatGbp:null,quantity:100
    });
    expect(withDeposits.warnings.map(x=>x.code)).toContain('square-deposit-processing-unverified');
    const withZero=square({squarePlan:'free',includeDepositProcessing:true,depositBookingsPerMonth:0});
    expect(withZero.status).toBe('calculated');
    expect(withZero.lineItems.find(x=>x.id==='square-deposit-processing')?.exVatGbp).toBe(0);
  });
  it('keeps Square headline consistent for monthly, annual and 3-year views', () => {
    for(const [period,months] of [['monthly',1],['annual',12],['threeYear',36]] as const){
      const free=projectCostCalculation(calculate({squarePlan:'free'}),period);
      if(!free.ok)throw Error('invalid');
      const squareFree=free.providers.find(x=>x.provider==='square')!;
      expect(squareFree.status).toBe('calculated');
      if(squareFree.status==='calculated')expect(squareFree.amounts.cashTotalGbp).toBe(0);
      const paid=projectCostCalculation(calculate({squarePlan:'plus'}),period);
      if(!paid.ok)throw Error('invalid');
      const squarePlus=paid.providers.find(x=>x.provider==='square')!;
      expect(squarePlus.status).toBe('custom-pricing');
      expect(squarePlus.lineItems.find(x=>x.id==='square-subscription')?.publishedHeadlineGbp).toBe(29);
      expect(paid.months).toBe(months);
    }
  });
  it('round trips every Square plan through a shareable link and repairs invalid params', () => {
    for(const squarePlan of ['free','plus','premium'] as const){
      const s={...DEFAULT_SCENARIO,squarePlan};
      expect(decodeScenarioQuery(encodeScenarioQuery(s,'annual')).scenario.squarePlan).toBe(squarePlan);
    }
    expect(decodeScenarioQuery('sq=other').scenario.squarePlan).toBe('free');
    expect(decodeScenarioQuery('sq=premium').scenario.squarePlan).toBe('premium');
  });
});
