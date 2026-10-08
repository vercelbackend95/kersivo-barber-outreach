import { describe, expect, it } from 'vitest';
import { calculateMonthlyCosts, validateCostScenario, type CostScenarioInput } from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO } from './calculatorUi';
import { projectCostCalculation } from './costProjection';
import { buildCalculatorView } from './resultView';
import { decodeScenarioQuery, encodeScenarioQuery } from './calculatorUrlState';
import { requireVerifiedVagaroFact } from '@/lib/seo/vagaroFacts';

const run = (overrides: Partial<CostScenarioInput> = {}) => {
 const result = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...overrides });
 if (!result.ok) throw new Error(JSON.stringify(result.errors));
 const vagaro = result.providers.find(p => p.provider === 'vagaro');
 if (!vagaro || vagaro.status !== 'calculated') throw new Error('Vagaro must be calculated');
 return { result, vagaro };
};
const line = (overrides: Partial<CostScenarioInput>, id: string) => run(overrides).vagaro.lineItems.find(x => x.id === id)!;

describe('Vagaro calculator end-to-end source-driven model', () => {
 it('uses only published calendar facts and never charges beyond seven calendars', () => {
   const base = requireVerifiedVagaroFact('oneCalendarDisplayedMonthlyGbp').value;
   expect(base).toBe(20);
   for (const [barbers, expected] of [[1,20],[3,40],[5,60],[7,80],[8,80],[30,80]]) {
      const { vagaro } = run({bookableBarbers:barbers});
      expect(line({bookableBarbers:barbers},'vagaro-subscription').exVatGbp).toBe(expected);
      expect(vagaro.amounts.cashTotalGbp).toBe(expected);
   }
 });
 it('keeps the £20 displayed offer distinct from the crossed-out £30 reference', () => {
    expect(line({bookableBarbers:3,vagaroDisplayedOffer:true}, 'vagaro-subscription').exVatGbp).toBe(40);
    expect(line({bookableBarbers:3,vagaroDisplayedOffer:false}, 'vagaro-subscription').exVatGbp).toBe(50);
    expect(run({vagaroDisplayedOffer:true}).vagaro.warnings.map(x=>x.code)).toContain('vagaro-promotion-duration-unverified');
 });
 it('does not assume every appointment is a paid Vagaro acquisition', () => {
    expect(run({monthlyAppointments:1000,marketplaceClients:0}).vagaro.amounts.acquisitionFeesExVatGbp).toBe(0);
    expect(run({monthlyAppointments:1000,marketplaceClients:3,averageAppointmentValueGbp:25}).vagaro.amounts.acquisitionFeesExVatGbp).toBe(15);
    expect(run({splitMarketplaceAssumptions:true,marketplaceClients:50,vagaroMarketplaceClients:2,averageAppointmentValueGbp:30}).vagaro.amounts.acquisitionFeesExVatGbp).toBe(12);
    expect(line({splitMarketplaceAssumptions:true,vagaroMarketplaceClients:0},'vagaro-marketplace-fees').quantity).toBe(0);
 });
 it('adds MySite only when selected and keeps VAT as an explicit shop-provided assumption', () => {
    expect(run({bookableBarbers:3,marketplaceClients:3,averageAppointmentValueGbp:25}).vagaro.amounts.cashTotalGbp).toBe(55);
    const included = run({bookableBarbers:3,marketplaceClients:3,averageAppointmentValueGbp:25,vagaroMySite:true});
    expect(included.vagaro.amounts.cashTotalGbp).toBe(70);
    expect(included.vagaro.amounts.vatChargedGbp).toBe(0);
    const withAssumedVat=run({bookableBarbers:3,marketplaceClients:3,averageAppointmentValueGbp:25,vagaroMySite:true,vagaroAssumeVat:true});
    expect(withAssumedVat.vagaro.amounts.vatChargedGbp).toBe(14);
    expect(withAssumedVat.vagaro.amounts.cashTotalGbp).toBe(84);
    expect(withAssumedVat.vagaro.warnings.map(x=>x.code)).toContain('vagaro-vat-unknown');
 });
 it('models only explicitly selected £5 online deposits at standard Vagaro UK rate', () => {
    expect(line({},'vagaro-deposit-processing').status).toBe('not-included');
    const options={includeDepositProcessing:true,depositBookingsPerMonth:100};
    expect(line(options,'vagaro-deposit-processing').unitExVatGbp).toBe(0.32);
    expect(line(options,'vagaro-deposit-processing').exVatGbp).toBe(32);
    expect(run(options).vagaro.amounts.cashTotalGbp).toBe(72);
    expect(run({includeDepositProcessing:false,depositBookingsPerMonth:100}).vagaro.amounts.paymentProcessingExVatGbp).toBe(0);
 });
 it('handles zero new-client cases, rejects inactive split overbooking and protects active count validation', () => {
    const s={...DEFAULT_SCENARIO,splitMarketplaceAssumptions:true,monthlyAppointments:10,vagaroMarketplaceClients:11};
    expect(validateCostScenario(s)).toContainEqual({field:'vagaroMarketplaceClients',code:'exceeds-monthly-appointments'});
    expect(validateCostScenario({...s,vagaroMarketplaceClients:10})).toEqual([]);
    expect(validateCostScenario({...s,splitMarketplaceAssumptions:false,marketplaceClients:0})).toEqual([]);
    expect(validateCostScenario({...DEFAULT_SCENARIO,vagaroDisplayedOffer:12 as unknown as boolean}))
      .toContainEqual({field:'vagaroDisplayedOffer',code:'not-boolean'});
 });
 it('round-trips Vagaro flags, separate counts and projects the monthly calculation for 12 and 36 months', () => {
    const s={...DEFAULT_SCENARIO,bookableBarbers:5,splitMarketplaceAssumptions:true,vagaroMarketplaceClients:4,vagaroMySite:true,vagaroDisplayedOffer:false,vagaroAssumeVat:true};
    const encoded=encodeScenarioQuery(s,'threeYear');
    expect(decodeScenarioQuery(encoded)).toEqual({scenario:s,period:'threeYear',hasScenarioParams:true});
    const monthly=calculateMonthlyCosts(s);
    if (!monthly.ok) throw new Error('invalid');
    const cost=run(s).vagaro.amounts.cashTotalGbp;
    const projected=projectCostCalculation(monthly,'threeYear');
    if (!projected.ok) throw new Error('invalid projection');
    const vagaro=projected.providers.find(x=>x.provider==='vagaro');
    expect(vagaro?.status).toBe('calculated');
    if (vagaro?.status!=='calculated') throw new Error('invalid Vagaro projection');
    expect(vagaro.amounts.cashTotalGbp).toBe(cost*36);
    expect(buildCalculatorView(s,'annual').providers.find(x=>x.id==='vagaro')?.total).toBe('£'+(cost*12).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}));
 });
});
