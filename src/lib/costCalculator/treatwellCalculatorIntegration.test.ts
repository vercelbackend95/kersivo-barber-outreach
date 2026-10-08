import { describe, expect, it } from 'vitest';
import { calculateMonthlyCosts, validateCostScenario, type CostScenarioInput } from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO, PROVIDER_RESULTS } from './calculatorUi';
import { buildCalculatorView } from './resultView';
import { projectCostCalculation } from './costProjection';
import { encodeScenarioQuery, decodeScenarioQuery } from './calculatorUrlState';
import {
  TREATWELL_UK_COMMERCIAL_FACTS,
  TREATWELL_SOURCES,
  requireVerifiedTreatwellFact,
} from '@/lib/seo/treatwellFacts';

function run(changes: Partial<CostScenarioInput> = {}) {
  const result = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...changes });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}
const item = (p: ReturnType<typeof treatwell>, id: string) => p.lineItems.find(x=>x.id===id)!;
function treatwell(changes: Partial<CostScenarioInput> = {}) {
  return run(changes).providers.find(x => x.provider === 'treatwell')!;
}

describe('Treatwell UK calculator integration', () => {
  it('uses the single verified UK source of truth, not hardcoded provider rates', () => {
    expect(requireVerifiedTreatwellFact('newMarketplaceClientCommission')).toMatchObject({ percent:35, vat:'exclusive',payer:'barbershop' });
    expect(requireVerifiedTreatwellFact('onlinePrepaymentProcessing')).toMatchObject({ percent:2.5,vat:'exclusive' });
    expect(TREATWELL_UK_COMMERCIAL_FACTS.softwareMonthlySubscription.status).toBe('unresolved');
    expect(TREATWELL_SOURCES.some(s=>s.id==='pricingUk')).toBe(true);
  });

  it('does not show a fictitious free monthly total when quote or quote VAT is unknown', () => {
    const result = treatwell({ marketplaceClients: 3, averageAppointmentValueGbp: 100 });
    expect(result.status).toBe('custom-pricing');
    expect(result.amounts).toBeNull();
    expect(item(result,'treatwell-subscription').exVatGbp).toBeNull();
    expect(item(result,'treatwell-new-client-commission').exVatGbp).toBe(105);
    expect(result.warnings.map(x=>x.code)).toContain('treatwell-monthly-quote-required');
    const vatUnknown = treatwell({ treatwellMonthlyQuoteGbp: 50 });
    expect(vatUnknown.status).toBe('custom-pricing');
    expect(vatUnknown.warnings.map(x=>x.code)).toContain('treatwell-quote-vat-unknown');
    expect(buildCalculatorView({ ...DEFAULT_SCENARIO },'monthly').providers.find(x=>x.id==='treatwell')?.total).toBe('Custom pricing');
  });

  it('computes eligible marketplace first-visit commission, 2.5% deposit processing and VAT separately', () => {
    const changes = {
      monthlyAppointments: 400, averageAppointmentValueGbp: 100, marketplaceClients: 3,
      treatwellMonthlyQuoteGbp: 50, treatwellQuoteVatPercent: 20,
      includeDepositProcessing: true, depositBookingsPerMonth: 100,
    } satisfies Partial<CostScenarioInput>;
    const result=treatwell(changes);
    expect(result.status).toBe('calculated');
    if(result.status!=='calculated') return;
    expect(item(result,'treatwell-subscription').exVatGbp).toBe(50);
    expect(item(result,'treatwell-new-client-commission')).toMatchObject({quantity:3,unitExVatGbp:35,exVatGbp:105,vatApplies:true});
    expect(item(result,'treatwell-deposit-processing')).toMatchObject({quantity:100,unitExVatGbp:0.13,exVatGbp:13,vatApplies:true,paymentMethod:'treatwell-online-prepayment'});
    expect(result.amounts).toMatchObject({subscriptionExVatGbp:50,acquisitionFeesExVatGbp:105,paymentProcessingExVatGbp:13,subtotalExVatGbp:168,vatChargedGbp:33.6,cashTotalGbp:201.6});
    expect(result.assumptions.map(x=>x.code)).toContain('treatwell-eligibility-365-days');
    const view=buildCalculatorView({...DEFAULT_SCENARIO,...changes},'monthly').providers.find(x=>x.id==='treatwell')!;
    expect(view.total).toBe('£201.60');
    expect(view.breakdown['treatwell-new-client-commission']?.value).toBe('£105.00');
    expect(view.breakdown['treatwell-deposit-processing']?.value).toBe('£13.00');
    const projection=projectCostCalculation(run(changes),'threeYear');
    if(!projection.ok) throw Error('Invalid');
    const year3=projection.providers.find(x=>x.provider==='treatwell')!;
    expect(year3.status).toBe('calculated');
    if(year3.status==='calculated') expect(year3.amounts.cashTotalGbp).toBe(7257.6);
  });

  it('keeps a 0% VAT subscription quote separate from VAT on commission and prepayments', () => {
    const p=treatwell({treatwellMonthlyQuoteGbp:50,treatwellQuoteVatPercent:0,marketplaceClients:1,averageAppointmentValueGbp:100});
    expect(p.status).toBe('calculated');
    if(p.status==='calculated') expect(p.amounts).toMatchObject({subtotalExVatGbp:85,vatChargedGbp:7,cashTotalGbp:92});
    const net=treatwell({treatwellMonthlyQuoteGbp:50,treatwellQuoteVatPercent:20,vatRegistered:true});
    expect(net.status).toBe('calculated');
    if(net.status==='calculated') expect(net.amounts.estimatedNetCostIfVatRecoverableGbp).toBe(50);
  });

  it('uses the separate Treatwell split count only when enabled', () => {
    const shared=treatwell({marketplaceClients:2,treatwellMarketplaceClients:9,averageAppointmentValueGbp:100});
    expect(item(shared,'treatwell-new-client-commission').quantity).toBe(2);
    const split=treatwell({splitMarketplaceAssumptions:true,marketplaceClients:2,treatwellMarketplaceClients:4,averageAppointmentValueGbp:100});
    expect(item(split,'treatwell-new-client-commission')).toMatchObject({quantity:4,exVatGbp:140});
    expect(validateCostScenario({...DEFAULT_SCENARIO,monthlyAppointments:3,splitMarketplaceAssumptions:true,treatwellMarketplaceClients:4}))
      .toContainEqual({field:'treatwellMarketplaceClients',code:'exceeds-monthly-appointments'});
  });

  it('rejects invalid VAT input and safely roundtrips quote, VAT and eligibility URL fields',()=>{
    expect(validateCostScenario({...DEFAULT_SCENARIO,treatwellQuoteVatPercent:5}))
      .toContainEqual({field:'treatwellQuoteVatPercent',code:'invalid-treatwell-vat'});
    const scenario={...DEFAULT_SCENARIO,splitMarketplaceAssumptions:true,treatwellMarketplaceClients:4,treatwellMonthlyQuoteGbp:125.5,treatwellQuoteVatPercent:20};
    const decoded=decodeScenarioQuery(encodeScenarioQuery(scenario,'annual'));
    expect(decoded.scenario).toEqual(scenario);
    expect(decoded.period).toBe('annual');
    expect(PROVIDER_RESULTS.map(x=>x.id)).toContain('treatwell');
    expect(PROVIDER_RESULTS.length).toBe(10);
  });
});
