import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatGbp, requireVerifiedFreshaFact } from '@/lib/seo/freshaFacts';
import { buildBarberCostCalculatorJsonLd } from '@/lib/seo/barberCostCalculatorJsonLd';
import {
  ADVANCED_COSTS_LABEL,
  APPOINTMENTS_FIELD,
  APPOINTMENT_VALUE_FIELD,
  BARBERS_FIELD,
  BOOST_TOGGLE,
  CALC_PANEL_LABEL,
  DEFAULT_PERIOD,
  FRESHA_ADD_ONS,
  INSIGHT_EYEBROW,
  INSIGHT_PENDING,
  MARKETPLACE_CLIENTS_FIELD,
  MARKETPLACE_HEADING,
  PAYMENTS_TOGGLE,
  PERIOD_OPTIONS,
  PLACEHOLDER_TOTAL,
  PLACEHOLDER_VALUE,
  PROVIDER_RESULTS,
  RESULTS_HEADING,
  RESULTS_SUPPORTING,
  SPLIT_ASSUMPTIONS_TOGGLE,
  SPLIT_FIELDS,
  SUMMARY_ROWS,
  THREE_YEAR_NOTE,
  VAT_OPTIONS,
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

  it('renders the barber stepper with labelled buttons and a £ prefix on appointment value', () => {
    expect(panelSource).toContain('data-calc-stepper');
    expect(panelSource).toContain('aria-label="Remove one bookable barber"');
    expect(panelSource).toContain('aria-label="Add one bookable barber"');
    expect(panelSource).toMatch(/calc-input__prefix" aria-hidden="true">£</);
    expect(BARBERS_FIELD.min).toBe(1);
  });

  it('defaults marketplace clients to zero', () => {
    expect(MARKETPLACE_HEADING).toBe('MARKETPLACE ACTIVITY');
    expect(MARKETPLACE_CLIENTS_FIELD.label).toBe('Qualifying new marketplace clients / month');
    expect(MARKETPLACE_CLIENTS_FIELD.defaultValue).toBe(0);
    expect(MARKETPLACE_CLIENTS_FIELD.helper).toBe(
      'Use this to model acquisition fees only. It does not assume each platform would generate the same number of clients.',
    );
    for (const field of SPLIT_FIELDS) expect(field.defaultValue).toBe(0);
  });

  it('keeps Booksy Boost off by default as a switch', () => {
    expect(BOOST_TOGGLE.label).toBe('Booksy Boost');
    expect(BOOST_TOGGLE.defaultOn).toBe(false);
    expect(panelSource).toContain('checked={BOOST_TOGGLE.defaultOn}');
    expect(panelSource.match(/role="switch"/g)).toHaveLength(2);
  });

  it('hides split marketplace assumptions until requested', () => {
    expect(SPLIT_ASSUMPTIONS_TOGGLE.label).toBe('Use different assumptions for Booksy and Fresha');
    expect(SPLIT_ASSUMPTIONS_TOGGLE.defaultOn).toBe(false);
    expect(SPLIT_FIELDS.map((field) => field.label)).toEqual([
      'Booksy Boost clients / month',
      'Fresha Marketplace clients / month',
    ]);
    expect(panelSource).toContain('<div id="calc-split-fields" class="calc-split__fields" hidden>');
  });

  it('collapses VAT, Fresha add-ons and payments into an advanced disclosure', () => {
    expect(ADVANCED_COSTS_LABEL).toBe('Advanced costs');
    const advanced = panelSource.slice(panelSource.indexOf('<details class="calc-advanced">'));
    expect(advanced).not.toMatch(/<details[^>]*\bopen\b/);
    for (const binding of ['{VAT_OPTIONS.legend}', '{FRESHA_ADD_ONS_LEGEND}', '{PAYMENTS_TOGGLE.label}']) {
      expect(advanced).toContain(binding);
    }
    expect(VAT_OPTIONS.legend).toBe('VAT registered?');
    expect(VAT_OPTIONS.options.map((option) => option.label)).toEqual(['No', 'Yes']);
    expect(VAT_OPTIONS.defaultValue).toBe('no');
    expect(PAYMENTS_TOGGLE.defaultOn).toBe(false);
    expect(panelSource).toContain('<p id="calc-payments-note" class="calc-pending" hidden>');
  });

  it('sources Fresha add-on prices from verified facts, unticked by default', () => {
    const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');
    const clientLoyalty = requireVerifiedFreshaFact('clientLoyaltyAddOn');
    expect(FRESHA_ADD_ONS.map((addOn) => addOn.label)).toEqual(['Smart Website', 'Client Loyalty']);
    expect(FRESHA_ADD_ONS[0].priceLabel).toBe(`${formatGbp(smartWebsite.amountGbp!)}/month + VAT`);
    expect(FRESHA_ADD_ONS[1].priceLabel).toBe(`${formatGbp(clientLoyalty.amountGbp!)}/location/month + VAT`);
    expect(panelSource).toContain('{addOn.priceLabel}');
    expect(panelSource).not.toMatch(/name=\{addOn\.name\}[^>]*checked/);
  });

  it('does not hand-write prices or unverified rates', () => {
    for (const source of [panelSource, resultsSource, configSource, shellSource]) {
      expect(source).not.toMatch(/£\s?\d/);
      expect(source).not.toMatch(/\d+(\.\d+)?\s?%/);
    }
    expect(PAYMENTS_TOGGLE.pendingNote).not.toMatch(/stripe|booksy/i);
  });
});

describe('calculator results shell', () => {
  it('offers monthly, 12-month and 3-year periods with monthly selected', () => {
    expect(RESULTS_HEADING).toBe('Your cost comparison');
    expect(RESULTS_SUPPORTING).toBe('Based on the barbershop numbers above.');
    expect(PERIOD_OPTIONS.map((option) => option.label)).toEqual(['Monthly', '12 months', '3 years']);
    expect(DEFAULT_PERIOD).toBe('monthly');
    expect(PERIOD_OPTIONS[0].resultLabel).toBe('Estimated monthly cost');
    expect(THREE_YEAR_NOTE).toBe(
      'Projection uses today’s published prices and does not predict future price changes.',
    );
    expect(resultsSource).toContain('<p class="calc-results__note" data-calc-three-year-note hidden>');
  });

  it('renders exactly three peer cards in Booksy, Fresha, KERSIVO order', () => {
    expect(PROVIDER_RESULTS.map((provider) => provider.name)).toEqual(['Booksy', 'Fresha', 'KERSIVO']);
    expect(resultsSource.match(/PROVIDER_RESULTS\.map/g)).toHaveLength(1);
    expect(resultsSource.match(/class="calc-card"/g)).toHaveLength(1);
    expect(resultsSource).not.toMatch(/winner|cheapest|best value|recommended|save/i);
  });

  it('lists the agreed summary and breakdown rows', () => {
    expect(SUMMARY_ROWS).toEqual(['Platform & acquisition', 'Payment processing', 'VAT charged']);
    const [booksy, fresha, kersivo] = PROVIDER_RESULTS;
    expect(booksy.breakdown).toEqual(['Base subscription', 'Additional users', 'Boost', 'VAT', 'Payment processing']);
    expect(fresha.breakdown).toEqual([
      'Subscription',
      'Marketplace fees',
      'Smart Website',
      'Client Loyalty',
      'VAT',
      'Payment processing',
    ]);
    expect(kersivo.breakdown).toEqual([
      'Subscription',
      'Additional barbers',
      'KERSIVO commission',
      'VAT',
      'Stripe processing',
    ]);
    expect(resultsSource).toContain('View breakdown');
  });

  it('shows placeholder values only, never fake totals', () => {
    expect(PLACEHOLDER_TOTAL).toBe('£—');
    expect(PLACEHOLDER_VALUE).toBe('—');
    expect(resultsSource).toContain('{PLACEHOLDER_TOTAL}');
    expect(resultsSource).toContain('{PLACEHOLDER_VALUE}');
    expect(resultsSource).not.toMatch(/£\s?\d|\d+\.\d{2}/);
    expect(INSIGHT_EYEBROW).toBe('BIGGEST COST DRIVER');
    expect(INSIGHT_PENDING).toBe('Your cost insight will appear here once the calculation is connected.');
  });
});

describe('phase 2 scope guard', () => {
  it('contains no pricing calculation functions', () => {
    for (const source of [configSource, shellSource]) {
      expect(source).not.toMatch(/\b(estimate|calculate|compute)\w*\s*\(/i);
      expect(source).not.toMatch(/\b(estimateFresha|SAAS_MONTHLY_GBP|BOOKSY_[A-Z_]+_GBP|vatRate|VAT_RATE)\b/);
    }
    expect(shellSource).not.toMatch(/from\s+['"]@\/lib\/seo/);
    expect(shellSource).not.toMatch(/\*\s*(12|36)\b/);
    expect(shellSource).not.toMatch(/URLSearchParams|history\.(push|replace)State/);
  });

  it('emits no WebApplication schema yet', () => {
    const serialized = JSON.stringify(buildBarberCostCalculatorJsonLd());
    expect(serialized).not.toContain('WebApplication');
    expect(serialized).not.toContain('SoftwareApplication');
  });
});
