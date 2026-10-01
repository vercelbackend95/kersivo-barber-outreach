import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatGbp, requireVerifiedFreshaFact } from '@/lib/seo/freshaFacts';
import { buildBarberCostCalculatorJsonLd } from '@/lib/seo/barberCostCalculatorJsonLd';
import type { CostScenarioInput, LineItemId } from './barberSoftwareCostEngine';
import {
  ADVANCED_COSTS_LABEL,
  APPOINTMENTS_FIELD,
  APPOINTMENT_VALUE_FIELD,
  BARBERS_FIELD,
  BOOST_TOGGLE,
  CALC_PANEL_LABEL,
  CUSTOM_PRICING_NOTE,
  DEFAULT_PERIOD,
  DEFAULT_SCENARIO,
  EXCEEDS_APPOINTMENTS_MESSAGE,
  FRESHA_ADD_ONS,
  INSIGHT_EYEBROW,
  INSIGHT_INVALID,
  MARKETPLACE_CLIENTS_FIELD,
  MARKETPLACE_HEADING,
  NUMBER_FIELDS,
  DEPOSIT_BOOKINGS_FIELD,
  DEPOSIT_EXCEEDS_APPOINTMENTS_MESSAGE,
  DEPOSIT_PROCESSING_TOGGLE,
  PERIOD_OPTIONS,
  PROJECTION_ASSUMPTION,
  PROVIDER_RESULTS,
  RESULTS_HEADING,
  RESULTS_SUPPORTING,
  SPLIT_ASSUMPTIONS_TOGGLE,
  SPLIT_FIELDS,
  SUMMARY_ROWS,
  THREE_YEAR_NOTE,
  VAT_OPTIONS,
  validationMessage,
} from './calculatorUi';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...segments: string[]) => readFileSync(join(here, ...segments), 'utf8');

const panelSource = read('../../components/costCalculator/CostCalcPanel.astro');
const resultsSource = read('../../components/costCalculator/CostResults.astro');
const configSource = read('calculatorUi.ts');
const shellSource = read('initCalculatorShell.ts');

describe('calculator panel inputs', () => {
  it('labels every core input', () => {
    expect(CALC_PANEL_LABEL).toBe('YOUR BARBERSHOP');
    expect(BARBERS_FIELD.label).toBe('Bookable barbers');
    expect(APPOINTMENTS_FIELD.label).toBe('Monthly appointments');
    expect(APPOINTMENTS_FIELD.helper).toBe('Approximate total bookings across the shop.');
    expect(APPOINTMENT_VALUE_FIELD.label).toBe('Average appointment value');
    for (const name of ['BARBERS_FIELD', 'APPOINTMENTS_FIELD', 'APPOINTMENT_VALUE_FIELD', 'MARKETPLACE_CLIENTS_FIELD']) {
      expect(panelSource).toContain(`for={${name}.id}`);
      expect(panelSource).toContain(`id={${name}.id}`);
    }
    expect(panelSource).toContain('{CALC_PANEL_LABEL}');
  });

  it('names every control after its engine scenario key', () => {
    const names = [
      ...NUMBER_FIELDS.map((field) => field.name),
      BOOST_TOGGLE.name,
      SPLIT_ASSUMPTIONS_TOGGLE.name,
      VAT_OPTIONS.name,
      ...FRESHA_ADD_ONS.map((addOn) => addOn.name),
      DEPOSIT_PROCESSING_TOGGLE.name,
    ].sort();
    expect(names).toEqual(Object.keys(DEFAULT_SCENARIO).sort());
  });

  it('renders the barber stepper with labelled buttons and a £ prefix on appointment value', () => {
    expect(panelSource).toContain('data-calc-stepper');
    expect(panelSource).toContain('aria-label="Remove one bookable barber"');
    expect(panelSource).toContain('aria-label="Add one bookable barber"');
    expect(panelSource).toMatch(/calc-input__prefix" aria-hidden="true">£</);
    expect(BARBERS_FIELD.min).toBe(1);
  });

  it('defaults marketplace clients to zero and Boost to off', () => {
    expect(MARKETPLACE_HEADING).toBe('MARKETPLACE ACTIVITY');
    expect(MARKETPLACE_CLIENTS_FIELD.defaultValue).toBe(0);
    for (const field of SPLIT_FIELDS) expect(field.defaultValue).toBe(0);
    expect(BOOST_TOGGLE.defaultOn).toBe(false);
    expect(panelSource).toContain('checked={BOOST_TOGGLE.defaultOn}');
  });

  it('hides split marketplace assumptions until requested', () => {
    expect(SPLIT_ASSUMPTIONS_TOGGLE.defaultOn).toBe(false);
    expect(SPLIT_FIELDS.map((field) => field.label)).toEqual([
      'Booksy Boost clients / month',
      'Fresha Marketplace clients / month',
    ]);
    expect(panelSource).toContain('<div id="calc-split-fields" class="calc-split__fields" hidden>');
  });

  it('collapses VAT, Fresha add-ons and deposit processing into an advanced disclosure', () => {
    expect(ADVANCED_COSTS_LABEL).toBe('Advanced costs');
    const advanced = panelSource.slice(panelSource.indexOf('<details class="calc-advanced">'));
    expect(advanced).not.toMatch(/<details[^>]*\bopen\b/);
    for (const binding of [
      '{VAT_OPTIONS.legend}',
      '{FRESHA_ADD_ONS_LEGEND}',
      '{DEPOSIT_PROCESSING_TOGGLE.label}',
      '{DEPOSIT_BOOKINGS_FIELD.label}',
    ]) {
      expect(advanced).toContain(binding);
    }
    expect(VAT_OPTIONS.defaultValue).toBe('no');
  });

  it('offers an enabled booking deposit processing toggle, off by default, revealing the deposit count', () => {
    expect(DEPOSIT_PROCESSING_TOGGLE.label).toBe('Include booking deposit processing');
    expect(DEPOSIT_PROCESSING_TOGGLE.defaultOn).toBe(false);
    expect(DEFAULT_SCENARIO.includeDepositProcessing).toBe(false);
    const toggle = panelSource.slice(panelSource.indexOf('id={DEPOSIT_PROCESSING_TOGGLE.id}'));
    const toggleTag = toggle.slice(0, toggle.indexOf('/>'));
    expect(toggleTag).not.toMatch(/\bdisabled\b/);
    expect(toggleTag).toContain('aria-controls={DEPOSIT_PROCESSING_TOGGLE.fieldsId}');
    expect(toggleTag).toContain('data-calc-reveal');
    expect(panelSource).toContain(
      '<div id={DEPOSIT_PROCESSING_TOGGLE.fieldsId} class="calc-deposit__fields" hidden={!DEPOSIT_PROCESSING_TOGGLE.defaultOn}>',
    );
    expect(panelSource).not.toMatch(/calc-pending|calc-field--unavailable|calc-payments/);
  });

  it('configures the deposit count as a whole number bounded by monthly appointments, never seeded from them', () => {
    expect(DEPOSIT_BOOKINGS_FIELD).toMatchObject({
      name: 'depositBookingsPerMonth',
      label: 'Online bookings taking a deposit / month',
      defaultValue: 0,
      min: 0,
      max: APPOINTMENTS_FIELD.max,
      step: 1,
    });
    expect(DEPOSIT_BOOKINGS_FIELD.max).toBe(20000);
    expect(DEFAULT_SCENARIO.depositBookingsPerMonth).toBe(0);
    expect(DEPOSIT_BOOKINGS_FIELD.helper).toBe(
      'Uses a £5 online deposit benchmark across all three providers. This compares deposit processing only, not the remaining appointment balance or in-person card payments.',
    );
    expect(configSource).toContain('formatGbp(DEPOSIT_BENCHMARK_GBP)');
  });

  it('gives every number field an associated inline error slot', () => {
    for (const binding of [
      'BARBERS_FIELD',
      'APPOINTMENTS_FIELD',
      'APPOINTMENT_VALUE_FIELD',
      'MARKETPLACE_CLIENTS_FIELD',
      'DEPOSIT_BOOKINGS_FIELD',
    ]) {
      expect(panelSource).toContain(`id={errorId(${binding}.id)}`);
    }
    expect(panelSource).toContain('id={errorId(field.id)}');
    expect(panelSource.match(/data-calc-error/g)).toHaveLength(6);
  });

  it('sources Fresha add-on prices from verified facts, unticked by default', () => {
    const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');
    const clientLoyalty = requireVerifiedFreshaFact('clientLoyaltyAddOn');
    expect(FRESHA_ADD_ONS[0].priceLabel).toBe(`${formatGbp(smartWebsite.amountGbp!)}/month + VAT`);
    expect(FRESHA_ADD_ONS[1].priceLabel).toBe(`${formatGbp(clientLoyalty.amountGbp!)}/location/month + VAT`);
    expect(panelSource).not.toMatch(/name=\{addOn\.name\}[^>]*checked/);
  });

  it('does not hand-write prices or rates', () => {
    for (const source of [panelSource, resultsSource, configSource, shellSource]) {
      expect(source).not.toMatch(/£\s?\d/);
      expect(source).not.toMatch(/\d+(\.\d+)?\s?%/);
    }
  });
});

describe('calculator results structure', () => {
  it('offers all three periods, Monthly by default, with cash-cost labels', () => {
    expect(RESULTS_HEADING).toBe('Your cost comparison');
    expect(RESULTS_SUPPORTING).toBe('Based on the barbershop numbers above.');
    expect(PERIOD_OPTIONS.map((option) => [option.value, option.label, option.resultLabel])).toEqual([
      ['monthly', 'Monthly', 'Estimated monthly cash cost'],
      ['annual', '12 months', 'Estimated 12-month cash cost'],
      ['threeYear', '3 years', 'Estimated 3-year cash cost'],
    ]);
    expect(DEFAULT_PERIOD).toBe('monthly');
    const fieldset = resultsSource.slice(resultsSource.indexOf('data-calc-period'), resultsSource.indexOf('</fieldset>'));
    expect(fieldset).not.toMatch(/\bdisabled\b|is-unavailable/);
    expect(resultsSource).not.toMatch(/calc-period-note|coming/i);
  });

  it('states the projection assumptions in English', () => {
    expect(PROJECTION_ASSUMPTION).toBe(
      '12-month and 3-year projections assume the monthly scenario remains unchanged and use the currently stored provider prices.',
    );
    expect(THREE_YEAR_NOTE).toBe('Projection uses today’s published prices and does not predict future price changes.');
    expect(resultsSource).toContain('data-calc-three-year-note hidden={!view.showThreeYearNote}');
  });

  it('renders three peer cards in Booksy, Fresha, KERSIVO order without winner language', () => {
    expect(PROVIDER_RESULTS.map((provider) => provider.name)).toEqual(['Booksy', 'Fresha', 'KERSIVO']);
    expect(resultsSource.match(/PROVIDER_RESULTS\.map/g)).toHaveLength(1);
    expect(resultsSource).not.toMatch(/winner|cheapest|best value|recommended|saving/i);
  });

  it('uses unambiguous summary rows', () => {
    expect(SUMMARY_ROWS.map((row) => row.label)).toEqual(['Before VAT', 'VAT charged', 'Payment processing']);
  });

  it('maps every breakdown row to an engine line item id or VAT', () => {
    const rows = (id: string) =>
      PROVIDER_RESULTS.find((provider) => provider.id === id)!.breakdown.map((row) => [row.id, row.label]);
    expect(rows('booksy')).toEqual([
      ['booksy-base-subscription', 'Base subscription'],
      ['booksy-additional-users', 'Additional users'],
      ['booksy-boost', 'Boost'],
      ['vat', 'VAT'],
      ['booksy-deposit-processing', 'Booking deposit processing'],
    ]);
    expect(rows('fresha')).toEqual([
      ['fresha-subscription', 'Subscription'],
      ['fresha-marketplace-fees', 'Marketplace fees'],
      ['fresha-smart-website', 'Smart Website'],
      ['fresha-client-loyalty', 'Client Loyalty'],
      ['vat', 'VAT'],
      ['fresha-deposit-processing', 'Booking deposit processing'],
    ]);
    expect(rows('kersivo')).toEqual([
      ['kersivo-subscription', 'Subscription'],
      ['kersivo-additional-barbers', 'Additional barbers'],
      ['kersivo-commission', 'KERSIVO commission'],
      ['vat', 'VAT'],
      ['kersivo-deposit-processing', 'Stripe deposit processing'],
    ]);
    expect(resultsSource).toContain('data-line={row.id}');
  });

  it('renders the server view through the shared pipeline, Monthly by default', () => {
    expect(resultsSource).toContain('buildCalculatorView(DEFAULT_SCENARIO, DEFAULT_PERIOD)');
    expect(resultsSource).toContain('checked={option.value === view.period}');
    expect(resultsSource).not.toMatch(/\d+\.\d{2}/);
  });

  it('server-renders the cost-driver insight into a live slot', () => {
    expect(INSIGHT_EYEBROW).toBe('BIGGEST COST DRIVER');
    expect(resultsSource).toContain('data-slot="insight">{view.insight}</p>');
    expect(resultsSource).not.toMatch(/INSIGHT_PENDING|will appear here once projections/);
    expect(INSIGHT_INVALID).toBe('The cost driver will appear once the highlighted inputs are valid.');
  });

  it('explains Fresha custom pricing from the central team-size limit', () => {
    expect(CUSTOM_PRICING_NOTE).toBe(
      'Fresha lists custom Enterprise pricing above 20 bookable team members, so a complete total cannot be estimated.',
    );
  });
});

describe('validation copy', () => {
  it('covers every engine issue code', () => {
    expect(validationMessage('exceeds-monthly-appointments', MARKETPLACE_CLIENTS_FIELD)).toBe(EXCEEDS_APPOINTMENTS_MESSAGE);
    expect(EXCEEDS_APPOINTMENTS_MESSAGE).toBe('Marketplace clients cannot be greater than total monthly appointments.');
    expect(validationMessage('below-minimum', BARBERS_FIELD)).toBe('Enter 1 or more.');
    expect(validationMessage('not-integer', BARBERS_FIELD)).toBe('Enter a whole number.');
    expect(validationMessage('not-a-number', APPOINTMENTS_FIELD)).toBe('Enter a number.');
    expect(validationMessage('not-finite', APPOINTMENTS_FIELD)).toBe('Enter a realistic number.');
    expect(validationMessage('not-boolean', null)).toBe('Choose an option.');
    expect(validationMessage('deposit-bookings-exceed-monthly-appointments', DEPOSIT_BOOKINGS_FIELD)).toBe(
      DEPOSIT_EXCEEDS_APPOINTMENTS_MESSAGE,
    );
    expect(DEPOSIT_EXCEEDS_APPOINTMENTS_MESSAGE).toBe(
      'Bookings taking a deposit cannot be greater than total monthly appointments.',
    );
  });
});

describe('scope guard', () => {
  it('keeps the shell free of calculations', () => {
    expect(shellSource).not.toMatch(/\b(estimate|calculate|compute)\w*\s*\(/i);
    expect(shellSource).not.toMatch(/from\s+['"]@\/lib\/seo/);
  });

  it('types breakdown ids against the engine', () => {
    const ids: (LineItemId | 'vat')[] = PROVIDER_RESULTS.flatMap((provider) => provider.breakdown.map((row) => row.id));
    expect(ids.length).toBe(16);
    const scenario: CostScenarioInput = DEFAULT_SCENARIO;
    expect(scenario.bookableBarbers).toBe(BARBERS_FIELD.defaultValue);
  });

  it('emits no WebApplication schema yet', () => {
    const serialized = JSON.stringify(buildBarberCostCalculatorJsonLd());
    expect(serialized).not.toContain('WebApplication');
    expect(serialized).not.toContain('SoftwareApplication');
  });
});
