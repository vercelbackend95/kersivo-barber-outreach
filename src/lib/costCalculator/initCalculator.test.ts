/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { calculateMonthlyCosts, type CostScenarioInput } from './barberSoftwareCostEngine';
import { decodeScenarioQuery, encodeScenarioQuery } from './calculatorUrlState';
import { projectCostCalculation } from './costProjection';
import {
  BOOST_TOGGLE,
  CUSTOM_PRICING_NOTE,
  DEFAULT_SCENARIO,
  FRESHA_ADD_ONS,
  NUMBER_FIELDS,
  DEPOSIT_BOOKINGS_FIELD,
  DEPOSIT_PROCESSING_TOGGLE,
  SPLIT_FIELDS,
  PERIOD_OPTIONS,
  PROVIDER_RESULTS,
  INSIGHT_INVALID,
  PROJECTION_ASSUMPTION,
  SPLIT_ASSUMPTIONS_TOGGLE,
  SUMMARY_ROWS,
  THREE_YEAR_NOTE,
} from './calculatorUi';
import { CALCULATOR_PREPAINT_SCRIPT } from './calculatorPrePaint';
import { initCalculator, readPeriod, readScenario } from './initCalculator';
import { formatMoneyGbp } from './money';
import { STRIPE_FEE_PAYER_CAVEAT } from '@/lib/seo/stripeFacts';

/** Mirrors the data hooks rendered by CostCalcPanel.astro and CostResults.astro. */
function mount({ prePaint = false } = {}) {
  const numberField = (field: (typeof NUMBER_FIELDS)[number]) => `
    <input id="${field.id}" name="${field.name}" type="number" value="${field.defaultValue}"
      min="${field.min}" max="${field.max}" step="${field.step}" />
    <p id="${field.id}-error" data-calc-error hidden></p>`;

  const card = (provider: (typeof PROVIDER_RESULTS)[number]) => `
    <li class="calc-card" data-provider="${provider.id}" data-state="unavailable">
      <p data-calc-period-label>${PERIOD_OPTIONS[0].resultLabel}</p>
      <p><span data-slot="total" aria-hidden="true">£—</span><span data-slot="total-sr"></span></p>
      <p data-slot="custom-note" hidden></p>
      <p data-slot="net"></p>
      <dl>${SUMMARY_ROWS.map((row) => `<div><dt>${row.label}</dt><dd data-summary="${row.id}">—</dd></div>`).join('')}</dl>
      <details class="calc-card__breakdown"><summary>View breakdown</summary><dl>${provider.breakdown
        .map(
          (row) =>
            `<div data-line="${row.id}"><dt>${row.label}<span data-slot="detail"></span></dt><dd data-slot="value">—</dd></div>`,
        )
        .join('')}</dl></details>
      <details data-slot="notes" hidden>
        <summary>Assumptions &amp; notes<span data-slot="notes-flag" hidden></span></summary>
        <ul data-slot="warnings"></ul>
        <ul data-slot="assumptions"></ul>
      </details>
    </li>`;

  document.body.innerHTML = `
    <form data-calc-form>
      <div data-calc-stepper>
        <button type="button" data-step="-1">-</button>
        ${numberField(NUMBER_FIELDS[0])}
        <button type="button" data-step="1">+</button>
      </div>
      ${NUMBER_FIELDS.slice(1, 4).map(numberField).join('')}
      <input id="${BOOST_TOGGLE.id}" name="${BOOST_TOGGLE.name}" type="checkbox" role="switch" />
      <input id="${SPLIT_ASSUMPTIONS_TOGGLE.id}" name="${SPLIT_ASSUMPTIONS_TOGGLE.name}" type="checkbox"
        aria-controls="calc-split-fields" data-calc-reveal />
      <div id="calc-split-fields" hidden>${SPLIT_FIELDS.map(numberField).join('')}</div>
      <input type="radio" name="vatRegistered" value="no" checked />
      <input type="radio" name="vatRegistered" value="yes" />
      <details class="calc-advanced"><summary>Advanced costs</summary></details>
      ${FRESHA_ADD_ONS.map((addOn) => `<input id="${addOn.id}" name="${addOn.name}" type="checkbox" />`).join('')}
      <input id="${DEPOSIT_PROCESSING_TOGGLE.id}" name="${DEPOSIT_PROCESSING_TOGGLE.name}" type="checkbox" role="switch"
        aria-controls="${DEPOSIT_PROCESSING_TOGGLE.fieldsId}" data-calc-reveal />
      <div id="${DEPOSIT_PROCESSING_TOGGLE.fieldsId}" hidden>${numberField(DEPOSIT_BOOKINGS_FIELD)}</div>
    </form>
    <section data-calc-results>
      <fieldset data-calc-period>
        ${PERIOD_OPTIONS.map(
          (option) =>
            `<input type="radio" name="period" value="${option.value}" ${option.value === 'monthly' ? 'checked' : ''} />`,
        ).join('')}
      </fieldset>
      <button type="button" data-calc-share>Copy scenario link</button>
      <p data-calc-share-status role="status" aria-live="polite"></p>
      <p data-calc-three-year-note hidden>${THREE_YEAR_NOTE}</p>
      <p data-slot="results-status" hidden></p>
      <ol>${PROVIDER_RESULTS.map(card).join('')}</ol>
      <details data-slot="shared-notes" hidden><ul data-slot="shared-assumptions"></ul></details>
      <aside><p data-slot="insight"></p></aside>
    </section>`;
  if (prePaint) new Function(CALCULATOR_PREPAINT_SCRIPT)();
  initCalculator(document);
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const cardEl = (id: string) => $(`[data-provider="${id}"]`);
const total = (id: string) => cardEl(id).querySelector('[data-slot="total"]')!.textContent;
const summary = (id: string, row: string) => cardEl(id).querySelector(`[data-summary="${row}"]`)!.textContent;
const cell = (id: string, line: string) => cardEl(id).querySelector(`[data-line="${line}"] [data-slot="value"]`)!.textContent;
const detail = (id: string, line: string) =>
  cardEl(id).querySelector(`[data-line="${line}"] [data-slot="detail"]`)!.textContent;
const warnings = (id: string) => [...cardEl(id).querySelectorAll('[data-slot="warnings"] li')].map((li) => li.textContent);
const assumptions = (id: string) =>
  [...cardEl(id).querySelectorAll('[data-slot="assumptions"] li')].map((li) => li.textContent ?? '');

function setNumber(id: string, value: string) {
  const input = $<HTMLInputElement>(`#${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function toggle(id: string, checked: boolean) {
  const input = $<HTMLInputElement>(`#${id}`);
  input.checked = checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function chooseVat(value: 'yes' | 'no') {
  const radio = $<HTMLInputElement>(`input[name="vatRegistered"][value="${value}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

function engineCash(overrides: Partial<typeof DEFAULT_SCENARIO>, index: number) {
  const result = calculateMonthlyCosts({ ...DEFAULT_SCENARIO, ...overrides });
  if (!result.ok) throw new Error('invalid');
  const provider = result.providers[index];
  if (provider.status !== 'calculated') throw new Error('not calculated');
  return formatMoneyGbp(provider.amounts.cashTotalGbp);
}

const URL_SCENARIO: CostScenarioInput = {
  bookableBarbers: 6,
  monthlyAppointments: 900,
  averageAppointmentValueGbp: 27.5,
  marketplaceClients: 4,
  booksyBoostEnabled: true,
  splitMarketplaceAssumptions: true,
  booksyBoostClients: 8,
  freshaMarketplaceClients: 15,
  freshaSmartWebsite: true,
  freshaClientLoyalty: false,
  vatRegistered: true,
  includeDepositProcessing: true,
  depositBookingsPerMonth: 300,
};

beforeEach(() => mount());

describe('initial calculation', () => {
  it('calculates the default form immediately from the engine', () => {
    expect(readScenario($<HTMLFormElement>('[data-calc-form]'))).toEqual(DEFAULT_SCENARIO);
    expect(total('booksy')).toBe(engineCash({}, 0));
    expect(total('fresha')).toBe(engineCash({}, 1));
    expect(total('kersivo')).toBe(engineCash({}, 2));
    expect([total('booksy'), total('fresha'), total('kersivo')]).toEqual(['£60.00', '£35.82', '£39.00']);
    expect(document.body.innerHTML).not.toContain('£—');
  });

  it('keeps providers in Booksy, Fresha, KERSIVO order with no winner state', () => {
    expect([...document.querySelectorAll('[data-provider]')].map((el) => (el as HTMLElement).dataset.provider)).toEqual([
      'booksy',
      'fresha',
      'kersivo',
    ]);
    expect(document.body.innerHTML).not.toMatch(/winner|cheapest|saving/i);
  });

  it('binds once across repeated page-load initialisation', () => {
    initCalculator(document);
    $<HTMLButtonElement>('[data-step="1"]').click();
    expect($<HTMLInputElement>('#calc-barbers').value).toBe('4');
    expect(cell('booksy', 'booksy-additional-users')).toBe('£15.00');
  });
});

describe('Booksy', () => {
  it('reacts to barber count and shows additional-user quantity', () => {
    setNumber('calc-barbers', '5');
    expect(cell('booksy', 'booksy-additional-users')).toBe('£20.00');
    expect(detail('booksy', 'booksy-additional-users')).toBe('4 additional users · £5.00 each/month');
    expect(total('booksy')).toBe(engineCash({ bookableBarbers: 5 }, 0));
  });

  it('shows £0.00 Boost while Boost is off, whatever the client count', () => {
    setNumber('calc-marketplace-clients', '12');
    expect(cell('booksy', 'booksy-boost')).toBe('£0.00');
    expect(detail('booksy', 'booksy-boost')).toBe('Off');
    expect(total('booksy')).toBe('£60.00');
    expect(assumptions('booksy').some((text) => text.includes('Boost'))).toBe(false);
  });

  it('uses engine Boost fees when Boost is on (percentage and minimum)', () => {
    setNumber('calc-marketplace-clients', '3');
    toggle('calc-boost', true);
    expect(cell('booksy', 'booksy-boost')).toBe('£22.50');
    expect(detail('booksy', 'booksy-boost')).toBe('3 qualifying clients/month · £7.50 each');
    setNumber('calc-appointment-value', '10');
    expect(cell('booksy', 'booksy-boost')).toBe('£15.00');
    expect(total('booksy')).toBe(
      engineCash({ marketplaceClients: 3, booksyBoostEnabled: true, averageAppointmentValueGbp: 10 }, 0),
    );
    expect(assumptions('booksy').some((text) => text.includes('first-visit value'))).toBe(true);
  });
});

describe('Fresha', () => {
  it('switches Independent to Team with barber count', () => {
    setNumber('calc-barbers', '1');
    expect(detail('fresha', 'fresha-subscription')).toBe('Independent plan · £14.95/month');
    expect(cell('fresha', 'fresha-subscription')).toBe('£14.95');
    setNumber('calc-barbers', '5');
    expect(detail('fresha', 'fresha-subscription')).toBe('Team plan · 5 bookable team members · £9.95 each/month');
    expect(cell('fresha', 'fresha-subscription')).toBe('£49.75');
  });

  it('adds Marketplace fees and shows the unresolved cap warning', () => {
    expect(warnings('fresha')).toEqual([]);
    setNumber('calc-marketplace-clients', '2');
    expect(cell('fresha', 'fresha-marketplace-fees')).toBe('£10.00');
    expect(total('fresha')).toBe(engineCash({ marketplaceClients: 2 }, 1));
    expect(warnings('fresha')[0]).toContain('maximum Marketplace new-client fee cap');
    expect(cardEl('fresha').querySelector<HTMLElement>('[data-slot="notes-flag"]')!.hidden).toBe(false);
    expect(warnings('booksy')).toEqual([]);
  });

  it('adds selected add-ons', () => {
    toggle('calc-fresha-smart-website', true);
    toggle('calc-fresha-client-loyalty', true);
    expect(cell('fresha', 'fresha-smart-website')).toBe('£12.95');
    expect(cell('fresha', 'fresha-client-loyalty')).toBe('£49.95');
    expect(total('fresha')).toBe(engineCash({ freshaSmartWebsite: true, freshaClientLoyalty: true }, 1));
  });

  it('renders Custom pricing above 20 barbers without a fake total', () => {
    setNumber('calc-barbers', '21');
    setNumber('calc-marketplace-clients', '2');
    toggle('calc-fresha-smart-website', true);
    const card = cardEl('fresha');
    expect(card.dataset.state).toBe('custom-pricing');
    expect(total('fresha')).toBe('Custom pricing');
    expect(card.querySelector('[data-slot="custom-note"]')!.textContent).toBe(CUSTOM_PRICING_NOTE);
    expect(cell('fresha', 'fresha-subscription')).toBe('Custom pricing');
    expect(cell('fresha', 'fresha-marketplace-fees')).toBe('£10.00');
    expect(cell('fresha', 'fresha-smart-website')).toBe('£12.95');
    expect(summary('fresha', 'before-vat')).toBe('Not estimated');
    expect(card.textContent).not.toContain('£22.95');
    expect(card.querySelector('[data-slot="net"]')!.textContent).toBe('');
    expect(cardEl('booksy').dataset.state).toBe('calculated');
  });
});

describe('KERSIVO', () => {
  it('keeps one £39 subscription with zero additional barbers and commission', () => {
    for (const barbers of ['1', '3', '20']) {
      setNumber('calc-barbers', barbers);
      expect(total('kersivo')).toBe('£39.00');
      expect(cell('kersivo', 'kersivo-additional-barbers')).toBe('£0.00');
      expect(cell('kersivo', 'kersivo-commission')).toBe('£0.00');
      expect(summary('kersivo', 'vat')).toBe('£0.00');
    }
  });
});

describe('VAT', () => {
  it('keeps cash cost as the main total and adds the net line only when VAT registered', () => {
    const before = total('booksy');
    expect(cardEl('booksy').querySelector('[data-slot="net"]')!.textContent).toBe('');
    chooseVat('yes');
    expect(total('booksy')).toBe(before);
    expect(summary('booksy', 'vat')).toBe('£10.00');
    expect(cardEl('booksy').querySelector('[data-slot="net"]')!.textContent).toBe(
      'Estimated net if VAT is fully recoverable: £50.00',
    );
    expect(cardEl('kersivo').querySelector('[data-slot="net"]')!.textContent).toBe(
      'Estimated net if VAT is fully recoverable: £39.00',
    );
    chooseVat('no');
    expect(cardEl('booksy').querySelector('[data-slot="net"]')!.textContent).toBe('');
  });
});

describe('validation', () => {
  it('clears totals and marks the field when input is invalid, then restores', () => {
    setNumber('calc-barbers', '');
    for (const id of ['booksy', 'fresha', 'kersivo']) {
      expect(total(id)).toBe('£—');
      expect(cardEl(id).dataset.state).toBe('unavailable');
      expect(summary(id, 'before-vat')).toBe('—');
    }
    expect($('#calc-barbers').getAttribute('aria-invalid')).toBe('true');
    expect($('#calc-barbers-error').textContent).toBe('Enter a number.');
    expect($('[data-slot="results-status"]').hidden).toBe(false);

    setNumber('calc-barbers', '3');
    expect(total('booksy')).toBe('£60.00');
    expect($('#calc-barbers').hasAttribute('aria-invalid')).toBe(false);
    expect($('#calc-barbers-error').hidden).toBe(true);
    expect($('[data-slot="results-status"]').hidden).toBe(true);
  });

  it('shows the business-logic message on the active marketplace field only', () => {
    setNumber('calc-appointments', '5');
    setNumber('calc-marketplace-clients', '6');
    expect($('#calc-marketplace-clients').getAttribute('aria-invalid')).toBe('true');
    expect($('#calc-marketplace-clients-error').textContent).toBe(
      'Marketplace clients cannot be greater than total monthly appointments.',
    );
    expect($('#calc-appointments').hasAttribute('aria-invalid')).toBe(false);
    expect(total('kersivo')).toBe('£—');
    setNumber('calc-marketplace-clients', '5');
    expect(total('kersivo')).toBe('£39.00');
  });

  it('maps non-integer and minimum errors to their fields', () => {
    setNumber('calc-barbers', '2.5');
    setNumber('calc-appointment-value', '-1');
    expect($('#calc-barbers-error').textContent).toBe('Enter a whole number.');
    expect($('#calc-appointment-value-error').textContent).toBe('Enter 0 or more.');
  });
});

describe('split marketplace mode', () => {
  it('seeds both provider fields from the shared count on first enable', () => {
    setNumber('calc-marketplace-clients', '6');
    toggle('calc-split-assumptions', true);
    expect($<HTMLInputElement>('#calc-boost-clients').value).toBe('6');
    expect($<HTMLInputElement>('#calc-fresha-marketplace-clients').value).toBe('6');
    expect(cell('fresha', 'fresha-marketplace-fees')).toBe('£30.00');
  });

  it('applies provider-specific counts to the matching provider only', () => {
    setNumber('calc-marketplace-clients', '6');
    toggle('calc-boost', true);
    toggle('calc-split-assumptions', true);
    setNumber('calc-fresha-marketplace-clients', '1');
    expect(cell('fresha', 'fresha-marketplace-fees')).toBe('£5.00');
    expect(cell('booksy', 'booksy-boost')).toBe('£45.00');
    setNumber('calc-boost-clients', '2');
    expect(cell('booksy', 'booksy-boost')).toBe('£15.00');
    expect(cell('fresha', 'fresha-marketplace-fees')).toBe('£5.00');
  });

  it('keeps user-edited provider counts when split mode is toggled again', () => {
    toggle('calc-split-assumptions', true);
    setNumber('calc-fresha-marketplace-clients', '4');
    toggle('calc-split-assumptions', false);
    setNumber('calc-marketplace-clients', '9');
    toggle('calc-split-assumptions', true);
    expect($<HTMLInputElement>('#calc-fresha-marketplace-clients').value).toBe('4');
  });

  it('treats a stale Boost count as harmless while Boost is off', () => {
    setNumber('calc-appointments', '10');
    toggle('calc-split-assumptions', true);
    setNumber('calc-boost-clients', '50');
    expect($('#calc-boost-clients').hasAttribute('aria-invalid')).toBe(false);
    expect(total('booksy')).toBe('£60.00');
    toggle('calc-boost', true);
    expect($('#calc-boost-clients-error').textContent).toBe(
      'Marketplace clients cannot be greater than total monthly appointments.',
    );
  });
});

const DEPOSIT_LINE = {
  booksy: 'booksy-deposit-processing',
  fresha: 'fresha-deposit-processing',
  kersivo: 'kersivo-deposit-processing',
} as const;
const PROVIDER_IDS = ['booksy', 'fresha', 'kersivo'] as const;
const depositToggleId = DEPOSIT_PROCESSING_TOGGLE.id;
const depositFieldId = DEPOSIT_BOOKINGS_FIELD.id;

function enableDeposits(count: string) {
  toggle(depositToggleId, true);
  setNumber(depositFieldId, count);
}

describe('booking deposit processing', () => {
  it('hides the Stripe fee-payer assumption while deposit processing is off', () => {
    expect(assumptions('kersivo')).not.toContain(STRIPE_FEE_PAYER_CAVEAT);
    toggle(depositToggleId, true);
    expect(assumptions('kersivo')).toContain(STRIPE_FEE_PAYER_CAVEAT);
  });

  it('starts off, enabled, with the deposit count hidden and every provider Not included', () => {
    const control = $<HTMLInputElement>(`#${depositToggleId}`);
    expect(control.disabled).toBe(false);
    expect(control.checked).toBe(false);
    expect($(`#${DEPOSIT_PROCESSING_TOGGLE.fieldsId}`).hidden).toBe(true);
    for (const id of PROVIDER_IDS) {
      expect(summary(id, 'payments')).toBe('Not included');
      expect(cell(id, DEPOSIT_LINE[id])).toBe('Not included');
      expect(detail(id, DEPOSIT_LINE[id])).toBe('');
    }
  });

  it('reveals the deposit count when switched on and shows £0.00 for zero deposits', () => {
    toggle(depositToggleId, true);
    expect($(`#${DEPOSIT_PROCESSING_TOGGLE.fieldsId}`).hidden).toBe(false);
    expect($<HTMLInputElement>(`#${depositFieldId}`).value).toBe('0');
    for (const id of PROVIDER_IDS) {
      expect(summary(id, 'payments')).toBe('£0.00');
      expect(cell(id, DEPOSIT_LINE[id])).toBe('£0.00');
    }
  });

  it('updates all three cards with 100 deposits, keeping commission separate', () => {
    enableDeposits('100');
    expect(PROVIDER_IDS.map((id) => summary(id, 'payments'))).toEqual(['£26.00', '£32.00', '£28.00']);
    expect(PROVIDER_IDS.map((id) => cell(id, DEPOSIT_LINE[id]))).toEqual(['£26.00', '£32.00', '£28.00']);
    expect(detail('booksy', DEPOSIT_LINE.booksy)).toBe('100 deposits/month · estimated £0.26 each before VAT');
    expect(detail('fresha', DEPOSIT_LINE.fresha)).toBe('100 deposits/month · estimated £0.32 each before VAT');
    expect(detail('kersivo', DEPOSIT_LINE.kersivo)).toBe('100 deposits/month · estimated £0.28 each · standard UK card');
    expect(cell('kersivo', 'kersivo-commission')).toBe('£0.00');
    expect([total('booksy'), total('fresha'), total('kersivo')]).toEqual(['£91.20', '£74.22', '£67.00']);
    expect(total('booksy')).toBe(engineCash({ includeDepositProcessing: true, depositBookingsPerMonth: 100 }, 0));
  });

  it('projects line totals for 12 months and 3 years, keeping unit and quantity monthly', () => {
    enableDeposits('100');
    choosePeriod('annual');
    expect(PROVIDER_IDS.map((id) => summary(id, 'payments'))).toEqual(['£312.00', '£384.00', '£336.00']);
    expect(detail('booksy', DEPOSIT_LINE.booksy)).toBe('100 deposits/month · estimated £0.26 each before VAT');
    choosePeriod('threeYear');
    expect(PROVIDER_IDS.map((id) => cell(id, DEPOSIT_LINE[id]))).toEqual(['£936.00', '£1,152.00', '£1,008.00']);
    expect(detail('kersivo', DEPOSIT_LINE.kersivo)).toBe('100 deposits/month · estimated £0.28 each · standard UK card');
  });

  it('preserves the entered count across off and on, and ignores it while off', () => {
    enableDeposits('100');
    toggle(depositToggleId, false);
    expect($(`#${DEPOSIT_PROCESSING_TOGGLE.fieldsId}`).hidden).toBe(true);
    expect(summary('booksy', 'payments')).toBe('Not included');
    expect([total('booksy'), total('fresha'), total('kersivo')]).toEqual(['£60.00', '£35.82', '£39.00']);
    toggle(depositToggleId, true);
    expect($<HTMLInputElement>(`#${depositFieldId}`).value).toBe('100');
    expect(summary('booksy', 'payments')).toBe('£26.00');
  });

  it('maps deposit validation to the deposit input without clamping, and a stale value never blocks', () => {
    enableDeposits('401');
    expect($(`#${depositFieldId}`).getAttribute('aria-invalid')).toBe('true');
    expect($(`#${depositFieldId}-error`).textContent).toBe(
      'Bookings taking a deposit cannot be greater than total monthly appointments.',
    );
    expect($<HTMLInputElement>(`#${depositFieldId}`).value).toBe('401');
    expect(total('booksy')).toBe('£—');

    toggle(depositToggleId, false);
    expect($(`#${depositFieldId}`).getAttribute('aria-invalid')).not.toBe('true');
    expect(total('booksy')).toBe('£60.00');
  });

  it('keeps Fresha custom pricing overall while showing its known processing line', () => {
    enableDeposits('100');
    setNumber('calc-barbers', '21');
    expect(total('fresha')).toBe('Custom pricing');
    expect(summary('fresha', 'before-vat')).toBe('Not estimated');
    expect(cell('fresha', DEPOSIT_LINE.fresha)).toBe('£32.00');
    expect(summary('fresha', 'payments')).toBe('£32.00');
  });

  it('makes the deposit caveats discoverable and never mentions full appointment payments', () => {
    enableDeposits('100');
    const shared = [...document.querySelectorAll('[data-slot="shared-assumptions"] li')].map((li) => li.textContent);
    expect(shared).toEqual(
      expect.arrayContaining([
        'Payment processing compares online booking deposits only. It does not include the remaining appointment balance, in-person card payments or retail payments.',
        'The comparison uses a £5 deposit benchmark for all three providers.',
        'Refund-related processing costs are not modelled.',
      ]),
    );
    expect(assumptions('kersivo')).toEqual(
      expect.arrayContaining([
        'The KERSIVO estimate assumes a standard UK card. Premium UK and international cards can have higher Stripe processing fees.',
        'Stripe processing fees are modelled without VAT charged. Tax treatment can depend on business circumstances; this calculator is not tax advice.',
        STRIPE_FEE_PAYER_CAVEAT,
      ]),
    );
    expect(assumptions('booksy')).not.toContain(STRIPE_FEE_PAYER_CAVEAT);
    expect(assumptions('fresha')).not.toContain(STRIPE_FEE_PAYER_CAVEAT);
    expect(shared).not.toContain(STRIPE_FEE_PAYER_CAVEAT);
    expect(assumptions('booksy')).not.toContain(shared[0]);
    expect(document.body.textContent).not.toMatch(/full appointment|appointment payments|terminal|tap to pay/i);
    expect(insight()).toContain('Booking deposit processing is the largest modelled variable cost');
  });
});

describe('payments and period', () => {

  it('shows shared assumptions once', () => {
    const shared = [...document.querySelectorAll('[data-slot="shared-assumptions"] li')].map((li) => li.textContent);
    expect(shared).toEqual([
      'The same qualifying new marketplace client count is used for Booksy Boost and Fresha Marketplace.',
      'Costs are for a single barbershop location.',
    ]);
    for (const id of ['booksy', 'fresha', 'kersivo']) {
      expect(assumptions(id)).not.toContain('Costs are for a single barbershop location.');
    }
  });
});

function choosePeriod(value: 'monthly' | 'annual' | 'threeYear') {
  const radio = $<HTMLInputElement>(`input[name="period"][value="${value}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

const periodLabels = () =>
  [...document.querySelectorAll('[data-calc-period-label]')].map((node) => node.textContent);
const net = (id: string) => cardEl(id).querySelector('[data-slot="net"]')!.textContent;
const insight = () => $('[data-slot="insight"]').textContent;
const sharedNotes = () => [...document.querySelectorAll('[data-slot="shared-assumptions"] li')].map((li) => li.textContent);

describe('period selector', () => {
  it('enables every period and defaults to Monthly', () => {
    const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="period"]')];
    expect(radios.map((radio) => [radio.value, radio.disabled, radio.checked])).toEqual([
      ['monthly', false, true],
      ['annual', false, false],
      ['threeYear', false, false],
    ]);
    expect(readPeriod($('[data-calc-results]'))).toBe('monthly');
    expect(periodLabels()).toEqual(Array(3).fill('Estimated monthly cash cost'));
  });

  it('reprojects cards, summaries and breakdowns for 12 months', () => {
    choosePeriod('annual');
    expect([total('booksy'), total('fresha'), total('kersivo')]).toEqual(['£720.00', '£429.84', '£468.00']);
    expect(periodLabels()).toEqual(Array(3).fill('Estimated 12-month cash cost'));
    expect(summary('booksy', 'before-vat')).toBe('£600.00');
    expect(summary('booksy', 'vat')).toBe('£120.00');
    expect(cell('booksy', 'booksy-additional-users')).toBe('£120.00');
    expect(cell('booksy', 'vat')).toBe('£120.00');
    expect(detail('booksy', 'booksy-additional-users')).toBe('2 additional users · £5.00 each/month');
    expect(detail('fresha', 'fresha-subscription')).toBe('Team plan · 3 bookable team members · £9.95 each/month');
    expect($('[data-calc-three-year-note]').hidden).toBe(true);
    expect($('[data-calc-results]').dataset.period).toBe('annual');
  });

  it('shows 3-year totals and the price-change note, then restores Monthly', () => {
    choosePeriod('threeYear');
    expect([total('booksy'), total('fresha'), total('kersivo')]).toEqual(['£2,160.00', '£1,289.52', '£1,404.00']);
    expect(periodLabels()).toEqual(Array(3).fill('Estimated 3-year cash cost'));
    expect($('[data-calc-three-year-note]').hidden).toBe(false);
    expect($('[data-calc-three-year-note]').textContent).toBe(THREE_YEAR_NOTE);

    choosePeriod('monthly');
    expect([total('booksy'), total('fresha'), total('kersivo')]).toEqual(['£60.00', '£35.82', '£39.00']);
    expect($('[data-calc-three-year-note]').hidden).toBe(true);
    expect(periodLabels()).toEqual(Array(3).fill('Estimated monthly cash cost'));
  });

  it('lists the projection assumption only for projected periods', () => {
    expect(sharedNotes()).not.toContain(PROJECTION_ASSUMPTION);
    choosePeriod('annual');
    expect(sharedNotes()).toContain(PROJECTION_ASSUMPTION);
    choosePeriod('monthly');
    expect(sharedNotes()).not.toContain(PROJECTION_ASSUMPTION);
  });

  it('preserves form state and recalculates edits in the selected period', () => {
    setNumber('calc-barbers', '5');
    toggle('calc-fresha-smart-website', true);
    choosePeriod('annual');
    expect($<HTMLInputElement>('#calc-barbers').value).toBe('5');
    expect($<HTMLInputElement>('#calc-fresha-smart-website').checked).toBe(true);
    expect(cell('booksy', 'booksy-additional-users')).toBe('£240.00');
    setNumber('calc-barbers', '4');
    expect(cell('booksy', 'booksy-additional-users')).toBe('£180.00');
    expect(readPeriod($('[data-calc-results]'))).toBe('annual');
  });

  it('keeps open disclosures open across period changes', () => {
    const breakdown = cardEl('booksy').querySelector<HTMLDetailsElement>('.calc-card__breakdown')!;
    const shared = $<HTMLDetailsElement>('[data-slot="shared-notes"]');
    breakdown.open = true;
    shared.open = true;
    choosePeriod('threeYear');
    choosePeriod('annual');
    expect(breakdown.open).toBe(true);
    expect(shared.open).toBe(true);
  });

  it('projects the VAT net line and keeps cash as the main total', () => {
    chooseVat('yes');
    choosePeriod('annual');
    expect(total('booksy')).toBe('£720.00');
    expect(net('booksy')).toBe('Estimated net if VAT is fully recoverable: £600.00');
    expect(net('kersivo')).toBe('Estimated net if VAT is fully recoverable: £468.00');
    choosePeriod('threeYear');
    expect(net('fresha')).toBe('Estimated net if VAT is fully recoverable: £1,074.60');
  });

  it('keeps deposit processing Not included in every period while off', () => {
    for (const period of ['annual', 'threeYear'] as const) {
      choosePeriod(period);
      for (const id of PROVIDER_IDS) {
        expect(summary(id, 'payments')).toBe('Not included');
        expect(cell(id, DEPOSIT_LINE[id])).toBe('Not included');
      }
    }
  });

  it('keeps Fresha custom pricing in every period and projects only known lines', () => {
    setNumber('calc-barbers', '21');
    setNumber('calc-marketplace-clients', '2');
    choosePeriod('threeYear');
    expect(cardEl('fresha').dataset.state).toBe('custom-pricing');
    expect(total('fresha')).toBe('Custom pricing');
    expect(cell('fresha', 'fresha-subscription')).toBe('Custom pricing');
    expect(cell('fresha', 'fresha-marketplace-fees')).toBe('£360.00');
    expect(detail('fresha', 'fresha-marketplace-fees')).toBe('2 new clients/month · £5.00 each');
    expect(summary('fresha', 'before-vat')).toBe('Not estimated');
    expect(net('fresha')).toBe('');
  });

  it('never bypasses validation when the period changes', () => {
    setNumber('calc-barbers', '');
    choosePeriod('threeYear');
    for (const id of ['booksy', 'fresha', 'kersivo']) {
      expect(total(id)).toBe('£—');
      expect(summary(id, 'before-vat')).toBe('—');
    }
    expect(insight()).toBe(INSIGHT_INVALID);
    expect($('#calc-barbers').getAttribute('aria-invalid')).toBe('true');
    expect($('[data-slot="results-status"]').hidden).toBe(false);

    setNumber('calc-barbers', '3');
    expect(total('booksy')).toBe('£2,160.00');
  });

  it('switches without submitting the form or replacing the page', () => {
    const form = $<HTMLFormElement>('[data-calc-form]');
    let submitted = false;
    form.addEventListener('submit', () => {
      submitted = true;
    });
    const fieldset = $('[data-calc-period]');
    const card = cardEl('booksy');
    choosePeriod('annual');
    expect(form.contains(fieldset)).toBe(false);
    expect(submitted).toBe(false);
    expect(cardEl('booksy')).toBe(card);
  });

  it('flags long projected totals for the smaller type size', () => {
    setNumber('calc-barbers', '20');
    setNumber('calc-appointments', '5000');
    setNumber('calc-appointment-value', '500');
    setNumber('calc-marketplace-clients', '500');
    toggle('calc-boost', true);
    choosePeriod('threeYear');
    const slot = cardEl('booksy').querySelector<HTMLElement>('[data-slot="total"]')!;
    expect(slot.textContent!.length).toBeGreaterThanOrEqual(10);
    expect(slot.dataset.size).toBe('long');
    expect(cardEl('kersivo').querySelector<HTMLElement>('[data-slot="total"]')!.dataset.size).toBe('regular');
  });
});

describe('cost-driver insight', () => {
  it('describes the default scenario and keeps it monthly across periods', () => {
    const monthly = insight();
    expect(monthly).toContain('Team size is the largest modelled variable cost');
    expect(monthly).toContain('£10.00/month before VAT');
    choosePeriod('threeYear');
    expect(insight()).toBe(monthly);
  });

  it('follows the inputs', () => {
    setNumber('calc-marketplace-clients', '4');
    expect(insight()).toContain('Fresha Marketplace fees are estimated at £20.00/month before VAT');
    setNumber('calc-barbers', '21');
    expect(insight()).toContain('custom Enterprise pricing above 20 bookable team members');
  });
});

const BASE_PATH = '/barber-software-cost-calculator';

function mountAt(search: string, options?: { prePaint?: boolean }) {
  window.history.replaceState(null, '', `${BASE_PATH}${search}`);
  mount(options);
}

function mockClipboard(impl: (text: string) => Promise<void>) {
  const writes: string[] = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        writes.push(text);
        return impl(text);
      },
    },
  });
  return writes;
}

async function clickShare() {
  $<HTMLButtonElement>('[data-calc-share]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const shareStatus = () => $('[data-calc-share-status]').textContent;

describe('scenario URLs', () => {
  afterEach(() => window.history.replaceState(null, '', BASE_PATH));

  it('keeps the default state on the clean base URL', () => {
    mountAt('');
    expect(readScenario($<HTMLFormElement>('[data-calc-form]'))).toEqual(DEFAULT_SCENARIO);
    expect(readPeriod($('[data-calc-results]'))).toBe('monthly');
    expect(window.location.search).toBe('');
  });

  it('hydrates a valid scenario URL into the form, period and engine results', () => {
    const query = encodeScenarioQuery(URL_SCENARIO, 'threeYear');
    mountAt(`?${query}`);
    expect(readScenario($<HTMLFormElement>('[data-calc-form]'))).toEqual(URL_SCENARIO);
    expect(readPeriod($('[data-calc-results]'))).toBe('threeYear');
    const projected = projectCostCalculation(calculateMonthlyCosts(URL_SCENARIO), 'threeYear');
    if (!projected.ok) throw new Error('invalid');
    projected.providers.forEach((provider) => {
      if (provider.status !== 'calculated') throw new Error('not calculated');
      expect(total(provider.provider)).toBe(formatMoneyGbp(provider.amounts.cashTotalGbp));
    });
    expect($(`#${DEPOSIT_PROCESSING_TOGGLE.fieldsId}`).hidden).toBe(false);
    expect($('#calc-split-fields').hidden).toBe(false);
    expect($<HTMLDetailsElement>('details.calc-advanced').open).toBe(true);
    expect(window.location.search).toBe(`?${query}`);
  });

  it('does not rewrite the URL while the user edits', () => {
    mountAt('');
    setNumber('calc-barbers', '6');
    toggle('calc-boost', true);
    choosePeriod('annual');
    expect(window.location.search).toBe('');
  });

  it('keeps loaded split counts when split is toggled off and on again', () => {
    mountAt('?split=1&m=2&fc=7');
    toggle(SPLIT_ASSUMPTIONS_TOGGLE.id, false);
    toggle(SPLIT_ASSUMPTIONS_TOGGLE.id, true);
    expect($<HTMLInputElement>('#calc-fresha-marketplace-clients').value).toBe('7');
  });

  it('loads a safe calculator from corrupted parameters', () => {
    mountAt('?b=abc&a=50&dp=1&db=999&v=-4&period=weekly&m=Infinity');
    const scenario = readScenario($<HTMLFormElement>('[data-calc-form]'));
    expect(scenario).toMatchObject({
      bookableBarbers: DEFAULT_SCENARIO.bookableBarbers,
      monthlyAppointments: 50,
      averageAppointmentValueGbp: DEFAULT_SCENARIO.averageAppointmentValueGbp,
      marketplaceClients: DEFAULT_SCENARIO.marketplaceClients,
      includeDepositProcessing: true,
      depositBookingsPerMonth: DEFAULT_SCENARIO.depositBookingsPerMonth,
    });
    expect(readPeriod($('[data-calc-results]'))).toBe('monthly');
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
    expect(total('booksy')).not.toBe('£—');
  });

  describe('after the pre-paint script', () => {
    const snapshot = () => ({
      scenario: readScenario($<HTMLFormElement>('[data-calc-form]')),
      period: readPeriod($('[data-calc-results]')),
      totals: PROVIDER_RESULTS.map((provider) => total(provider.id)),
      advancedOpen: $<HTMLDetailsElement>('details.calc-advanced').open,
      splitHidden: $('#calc-split-fields').hidden,
      depositHidden: $(`#${DEPOSIT_PROCESSING_TOGGLE.fieldsId}`).hidden,
    });

    it.each([
      '',
      '?period=36',
      '?b=6&a=900&period=36',
      '?vat=1',
      '?sw=1',
      '?loyalty=1',
      '?dp=1&db=100',
      '?dp=1&db=999',
      '?vat=yes&dp=true&split=2',
      `?${encodeScenarioQuery(URL_SCENARIO, 'threeYear')}`,
    ])('hydrates %s to the same final state and totals as without it', (search) => {
      mountAt(search);
      const withoutPrePaint = snapshot();
      mountAt(search, { prePaint: true });
      expect(snapshot()).toEqual(withoutPrePaint);
    });

    it('still binds once and applies the URL exactly once', () => {
      mountAt('?dp=1&db=100&vat=1', { prePaint: true });
      setNumber(DEPOSIT_BOOKINGS_FIELD.id, '40');
      toggle(DEPOSIT_PROCESSING_TOGGLE.id, false);
      initCalculator(document);
      initCalculator(document);
      expect($<HTMLInputElement>(`#${DEPOSIT_BOOKINGS_FIELD.id}`).value).toBe('40');
      expect($<HTMLInputElement>(`#${DEPOSIT_PROCESSING_TOGGLE.id}`).checked).toBe(false);
      expect($(`#${DEPOSIT_PROCESSING_TOGGLE.fieldsId}`).hidden).toBe(true);
      const writes = mockClipboard(() => Promise.resolve());
      $<HTMLButtonElement>('[data-calc-share]').click();
      expect(writes).toHaveLength(1);
    });
  });

  it('binds listeners once and does not reapply the URL on repeated page-load calls', () => {
    mountAt('?b=5');
    setNumber('calc-barbers', '8');
    initCalculator(document);
    initCalculator(document);
    expect($<HTMLInputElement>('#calc-barbers').value).toBe('8');
    const writes = mockClipboard(() => Promise.resolve());
    $<HTMLButtonElement>('[data-calc-share]').click();
    expect(writes).toHaveLength(1);
  });
});

describe('copy scenario link', () => {
  afterEach(() => window.history.replaceState(null, '', BASE_PATH));

  it('copies the current inputs and period, then reflects later edits', async () => {
    mountAt('?utm_source=newsletter');
    const writes = mockClipboard(() => Promise.resolve());
    setNumber('calc-barbers', '5');
    setNumber('calc-appointment-value', '27.5');
    toggle(DEPOSIT_PROCESSING_TOGGLE.id, true);
    setNumber(DEPOSIT_BOOKINGS_FIELD.id, '120');
    choosePeriod('annual');
    await clickShare();

    const first = new URL(writes[0]);
    expect(first.pathname).toBe(BASE_PATH);
    expect(first.hash).toBe('');
    expect(Object.fromEntries(first.searchParams)).toMatchObject({ b: '5', v: '27.5', dp: '1', db: '120', period: '12' });
    expect(first.searchParams.has('utm_source')).toBe(false);
    expect(decodeScenarioQuery(first.search).scenario).toEqual(readScenario($<HTMLFormElement>('[data-calc-form]')));
    expect(shareStatus()).toBe('Scenario link copied');

    setNumber('calc-barbers', '7');
    choosePeriod('threeYear');
    await clickShare();
    const second = new URL(writes[1]);
    expect(second.searchParams.get('b')).toBe('7');
    expect(second.searchParams.get('period')).toBe('36');
  });

  it('never puts derived totals or prices in the URL', async () => {
    mountAt('');
    const writes = mockClipboard(() => Promise.resolve());
    await clickShare();
    const url = writes[0];
    expect(url).not.toMatch(/£|%C2%A3|total|price|60\.00|35\.82|39\.00/i);
    expect([...new URL(url).searchParams.keys()]).toEqual([
      'b', 'a', 'v', 'm', 'boost', 'split', 'bc', 'fc', 'sw', 'loyalty', 'vat', 'dp', 'db', 'period',
    ]);
  });

  it('reports a failure when the clipboard is unavailable', async () => {
    mountAt('');
    mockClipboard(() => Promise.reject(new Error('denied')));
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    await clickShare();
    expect(shareStatus()).toBe('Could not copy link');
  });

  it('refuses to copy an invalid scenario', async () => {
    mountAt('');
    const writes = mockClipboard(() => Promise.resolve());
    setNumber('calc-barbers', '');
    await clickShare();
    expect(writes).toHaveLength(0);
    expect(shareStatus()).toBe('Fix the highlighted inputs to copy a link');
  });
});

describe('architecture guards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (file: string) => readFileSync(join(here, file), 'utf8');
  const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const controller = read('initCalculator.ts');
  const clientFiles = ['initCalculator.ts', 'renderResults.ts', 'resultView.ts', 'initCalculatorShell.ts'].map((file) =>
    strip(read(file)),
  );
  const components = ['CostCalcPanel.astro', 'CostResults.astro'].map((file) =>
    read(`../../components/costCalculator/${file}`),
  );

  it('routes every calculation through the engine, projection and view pipeline', () => {
    const view = strip(read('resultView.ts'));
    expect(controller).toContain('buildCalculatorView(scenario, readPeriod(results))');
    expect(view).toContain('const monthly = calculateMonthlyCosts(scenario);');
    expect(view).toContain('projectCostCalculation(monthly, period)');
    expect(view).toContain('determineCostInsight(monthly)');
  });

  it('duplicates no provider prices, rates or period multipliers in client code', () => {
    for (const source of [...clientFiles, ...components]) {
      expect(source).not.toMatch(/BOOKSY_[A-Z_]+|SAAS_MONTHLY|FRESHA_UK_COMMERCIAL_FACTS|requireVerifiedFreshaFact|UK_STANDARD_VAT/);
      expect(source).not.toMatch(/connected barbershop account|Stripe Connect/);
      expect(source).not.toMatch(/STRIPE_[A-Z_]+|stripeFacts|DEPOSIT_BENCHMARK|KERSIVO_BOOKING_DEPOSIT|transactionFeePence|percentOfPence/);
      expect(source).not.toMatch(/\bunitExVatGbp\s*\*|\*\s*\w*\.?quantity\b/);
      expect(source).not.toMatch(/\*\s*(12|36)\b|\b(12|36)\s*\*/);
      expect(source).not.toMatch(/£\s?\d|\d+\.\d{2}/);
    }
  });

  it('renders into every data slot the server template provides', () => {
    const renderer = read('renderResults.ts');
    const slots = [...renderer.matchAll(/data-slot="([a-z-]+)"/g)].map((match) => match[1]);
    expect(slots.length).toBeGreaterThan(8);
    for (const slot of slots) expect(components[1]).toContain(`data-slot="${slot}"`);
    expect(components[1]).toContain('data-summary={row.id}');
    expect(components[1]).toContain('data-line={row.id}');
  });

  it('keeps the engine DOM-free', () => {
    const engine = strip(read('barberSoftwareCostEngine.ts'));
    expect(engine).not.toMatch(/\b(document|window|HTMLElement)\b/);
  });
});
