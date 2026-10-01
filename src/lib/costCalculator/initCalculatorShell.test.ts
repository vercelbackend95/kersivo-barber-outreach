/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { initCalculatorShell } from './initCalculatorShell';

function mount() {
  document.body.innerHTML = `
    <form data-calc-form>
      <div data-calc-stepper>
        <button type="button" data-step="-1">-</button>
        <input id="barbers" type="number" value="1" min="1" max="3" step="1" />
        <button type="button" data-step="1">+</button>
      </div>
      <input id="clients" type="number" value="0" min="0" max="10" step="1" />
      <input id="split" type="checkbox" aria-controls="split-fields" data-calc-reveal />
      <div id="split-fields" hidden></div>
    </form>
  `;
  initCalculatorShell(document);
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

describe('initCalculatorShell', () => {
  beforeEach(mount);

  it('steps the barber count within bounds and flags the limits', () => {
    const [minus, plus] = document.querySelectorAll<HTMLButtonElement>('[data-step]');
    const input = $<HTMLInputElement>('#barbers');
    expect(minus.getAttribute('aria-disabled')).toBe('true');
    plus.click();
    plus.click();
    plus.click();
    expect(input.value).toBe('3');
    expect(plus.getAttribute('aria-disabled')).toBe('true');
    minus.click();
    expect(input.value).toBe('2');
    expect(minus.getAttribute('aria-disabled')).toBe('false');
  });

  it('clamps typed numbers and restores empty fields', () => {
    const input = $<HTMLInputElement>('#clients');
    input.value = '50';
    input.dispatchEvent(new Event('change'));
    expect(input.value).toBe('10');
    input.value = '';
    input.dispatchEvent(new Event('change'));
    expect(input.value).toBe('0');
  });

  it('reveals controlled content only while the toggle is on', () => {
    const toggle = $<HTMLInputElement>('#split');
    const target = $('#split-fields');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(target.hidden).toBe(false);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(target.hidden).toBe(true);
  });

  it('binds only once across repeated page-load calls', () => {
    initCalculatorShell(document);
    $<HTMLButtonElement>('[data-step="1"]').click();
    expect($<HTMLInputElement>('#barbers').value).toBe('2');
  });
});
