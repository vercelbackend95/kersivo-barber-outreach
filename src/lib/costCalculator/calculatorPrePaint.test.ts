/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CALCULATOR_PREPAINT_SCRIPT } from './calculatorPrePaint';
import { DEFAULT_SCENARIO, DEPOSIT_PROCESSING_TOGGLE, SPLIT_ASSUMPTIONS_TOGGLE } from './calculatorUi';
import { ADVANCED_SCENARIO_KEYS, decodeScenarioQuery } from './calculatorUrlState';

const BASE_PATH = '/barber-software-cost-calculator';
const COMPLEX =
  '?b=6&a=900&v=27.5&m=0&boost=1&split=1&bc=8&fc=15&sw=1&loyalty=0&vat=1&dp=1&db=300&period=36';

/** Mirrors the presentation hooks rendered by CostCalcPanel.astro. */
function runAt(search: string) {
  window.history.replaceState(null, '', `${BASE_PATH}${search}`);
  document.body.innerHTML = `
    <form data-calc-form>
      <input id="${SPLIT_ASSUMPTIONS_TOGGLE.id}" type="checkbox" aria-controls="calc-split-fields" data-calc-reveal />
      <div id="calc-split-fields" hidden></div>
      <details class="calc-advanced"><summary>Advanced costs</summary>
        <input id="${DEPOSIT_PROCESSING_TOGGLE.id}" type="checkbox" role="switch"
          aria-controls="${DEPOSIT_PROCESSING_TOGGLE.fieldsId}" data-calc-reveal />
        <div id="${DEPOSIT_PROCESSING_TOGGLE.fieldsId}" hidden></div>
      </details>
    </form>`;
  new Function(CALCULATOR_PREPAINT_SCRIPT)();
  return {
    advancedOpen: document.querySelector<HTMLDetailsElement>('details.calc-advanced')!.open,
    splitChecked: document.querySelector<HTMLInputElement>(`#${SPLIT_ASSUMPTIONS_TOGGLE.id}`)!.checked,
    splitHidden: document.getElementById('calc-split-fields')!.hidden,
    depositChecked: document.querySelector<HTMLInputElement>(`#${DEPOSIT_PROCESSING_TOGGLE.id}`)!.checked,
    depositHidden: document.getElementById(DEPOSIT_PROCESSING_TOGGLE.fieldsId)!.hidden,
  };
}

afterEach(() => window.history.replaceState(null, '', BASE_PATH));

describe('calculator pre-paint presentation state', () => {
  it('keeps Advanced costs closed on the base URL', () => {
    expect(runAt('')).toEqual({
      advancedOpen: false,
      splitChecked: false,
      splitHidden: true,
      depositChecked: false,
      depositHidden: true,
    });
  });

  it('keeps Advanced costs closed for basic-only scenarios', () => {
    expect(runAt('?b=6&a=900&period=36').advancedOpen).toBe(false);
    expect(runAt('?period=36').advancedOpen).toBe(false);
    expect(runAt('?boost=1&bc=8&m=3').advancedOpen).toBe(false);
  });

  it.each(['?vat=1', '?sw=1', '?loyalty=1', '?dp=1', '?dp=1&db=100', COMPLEX])('opens Advanced costs for %s', (search) => {
    expect(runAt(search).advancedOpen).toBe(true);
  });

  it('reveals the deposit count and split fields before paint when the URL turns them on', () => {
    expect(runAt('?dp=1&db=100')).toMatchObject({ depositChecked: true, depositHidden: false, splitHidden: true });
    expect(runAt(COMPLEX)).toMatchObject({
      advancedOpen: true,
      splitChecked: true,
      splitHidden: false,
      depositChecked: true,
      depositHidden: false,
    });
  });

  it.each([
    '?vat=yes',
    '?sw=2',
    '?loyalty=',
    '?dp=true',
    '?vat=0&sw=0&loyalty=0&dp=0',
    '?VAT=1',
    '?advanced=1',
    '?vat=1x',
  ])('does not force Advanced costs open for %s', (search) => {
    const state = runAt(search);
    expect(state.advancedOpen).toBe(false);
    expect(state.depositHidden).toBe(true);
  });

  it('matches the controller decode for every supported and malformed advanced value', () => {
    const values = ['1', '0', ' 1 ', 'yes', '', 'true', '2'];
    for (const vat of values) {
      for (const dp of values) {
        const search = `?vat=${encodeURIComponent(vat)}&dp=${encodeURIComponent(dp)}&db=999&split=${encodeURIComponent(vat)}`;
        const { scenario } = decodeScenarioQuery(search);
        const state = runAt(search);
        expect(state.advancedOpen).toBe(ADVANCED_SCENARIO_KEYS.some((key) => scenario[key] !== DEFAULT_SCENARIO[key]));
        expect(state.depositHidden).toBe(!scenario.includeDepositProcessing);
        expect(state.splitHidden).toBe(!scenario.splitMarketplaceAssumptions);
      }
    }
  });

  it('does nothing once the calculator controller has hydrated', () => {
    window.history.replaceState(null, '', `${BASE_PATH}?vat=1`);
    document.body.innerHTML = `<form data-calc-form data-calc-ready="true"><details class="calc-advanced"></details></form>`;
    new Function(CALCULATOR_PREPAINT_SCRIPT)();
    expect(document.querySelector<HTMLDetailsElement>('details.calc-advanced')!.open).toBe(false);
  });

  it('only reads presentation booleans, never numbers, prices or totals', () => {
    for (const forbidden of ['db', 'bookableBarbers', 'calculate', 'total', 'innerHTML', 'textContent']) {
      expect(CALCULATOR_PREPAINT_SCRIPT).not.toContain(`"${forbidden}"`);
      expect(CALCULATOR_PREPAINT_SCRIPT).not.toContain(`.${forbidden}`);
    }
  });

  it('is rendered inline right after Advanced costs, inside the form', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const panel = readFileSync(join(here, '../../components/costCalculator/CostCalcPanel.astro'), 'utf8');
    expect(panel).toMatch(
      /<\/details>\s*<script is:inline set:html=\{CALCULATOR_PREPAINT_SCRIPT\} \/>\s*<\/form>/,
    );
  });
});
