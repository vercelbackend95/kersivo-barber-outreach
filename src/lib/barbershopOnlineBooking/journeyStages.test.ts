// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { bindBookingJourney, nextStageIndex, steppedStageIndex } from './journeyStages';

const titles = ['Choose the service', 'Choose the barber', 'Choose an available time'];

function mount() {
  document.body.innerHTML = `
    <section data-boj>
      <div data-boj-group data-boj-anchor>
        ${titles
          .map((_, i) => `<button type="button" class="tab" aria-controls="panel-${i}" aria-pressed="${i === 0}" data-boj-select="${i}"></button>`)
          .join('')}
      </div>
      <ol data-boj-group>
        ${titles
          .map(
            (title, i) => `
          <li data-boj-stage class="${i === 0 ? 'is-active' : ''}">
            <h3>${title}</h3>
            <button type="button" class="rail" aria-controls="panel-${i}" aria-pressed="${i === 0}" data-boj-select="${i}"></button>
          </li>`,
          )
          .join('')}
      </ol>
      <p data-boj-status aria-live="polite"></p>
      ${titles.map((_, i) => `<div id="panel-${i}" class="${i === 0 ? 'is-active' : ''}" data-boj-panel></div>`).join('')}
      <button type="button" data-boj-step="-1" aria-disabled="true"></button>
      <span data-boj-count></span>
      <button type="button" data-boj-step="1" aria-disabled="false"></button>
    </section>`;
  bindBookingJourney(window);
  const [prev, next] = [...document.querySelectorAll<HTMLButtonElement>('[data-boj-step]')];
  return {
    tabs: [...document.querySelectorAll<HTMLButtonElement>('button.tab')],
    rail: [...document.querySelectorAll<HTMLButtonElement>('button.rail')],
    stages: [...document.querySelectorAll<HTMLElement>('[data-boj-stage]')],
    panels: [...document.querySelectorAll<HTMLElement>('[data-boj-panel]')],
    status: document.querySelector<HTMLElement>('[data-boj-status]')!,
    count: document.querySelector<HTMLElement>('[data-boj-count]')!,
    prev,
    next,
  };
}

const pressed = (buttons: HTMLButtonElement[]) => buttons.map((b) => b.getAttribute('aria-pressed'));

describe('booking journey stage selector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps arrow keys, jumps with Home and End, and stops Previous / Next at the ends', () => {
    expect(nextStageIndex('ArrowDown', 4, 5)).toBe(0);
    expect(nextStageIndex('ArrowLeft', 0, 5)).toBe(4);
    expect(nextStageIndex('ArrowRight', 1, 5)).toBe(2);
    expect(nextStageIndex('Home', 3, 5)).toBe(0);
    expect(nextStageIndex('End', 0, 5)).toBe(4);
    expect(nextStageIndex('Enter', 0, 5)).toBeNull();
    expect(steppedStageIndex(0, -1, 5)).toBeNull();
    expect(steppedStageIndex(0, 1, 5)).toBe(1);
    expect(steppedStageIndex(4, 1, 5)).toBeNull();
  });

  it('keeps inactive panels inert and silent on load', () => {
    const { panels, status, count, prev, next } = mount();
    expect(panels[0].hasAttribute('inert')).toBe(false);
    expect(panels.slice(1).every((panel) => panel.hasAttribute('inert') && panel.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(status.textContent).toBe('');
    expect(count.textContent).toBe('1 / 3');
    expect(prev.getAttribute('aria-disabled')).toBe('true');
    expect(next.getAttribute('aria-disabled')).toBe('false');
  });

  it('keeps the step selector, rail, stage text and panel on one shared stage', () => {
    const { tabs, rail, stages, panels, status } = mount();
    tabs[2].click();
    expect(pressed(tabs)).toEqual(['false', 'false', 'true']);
    expect(pressed(rail)).toEqual(['false', 'false', 'true']);
    expect(tabs.map((t) => t.classList.contains('is-done'))).toEqual([true, true, false]);
    expect(stages[2].classList.contains('is-active')).toBe(true);
    expect(stages[0].classList.contains('is-active')).toBe(false);
    expect(panels[2].classList.contains('is-active')).toBe(true);
    expect(panels[2].hasAttribute('inert')).toBe(false);
    expect(panels[0].hasAttribute('inert')).toBe(true);
    expect(status.textContent).toBe('Showing step 3 of 3: Choose an available time');

    rail[0].click();
    expect(pressed(tabs)).toEqual(['true', 'false', 'false']);
  });

  it('steps with Previous / Next and ignores them at either end', () => {
    const { tabs, prev, next, count, status } = mount();
    prev.click();
    expect(pressed(tabs)).toEqual(['true', 'false', 'false']);
    next.click();
    next.click();
    expect(pressed(tabs)).toEqual(['false', 'false', 'true']);
    expect(count.textContent).toBe('3 / 3');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(prev.getAttribute('aria-disabled')).toBe('false');
    next.click();
    expect(pressed(tabs)).toEqual(['false', 'false', 'true']);
    prev.click();
    expect(status.textContent).toBe('Showing step 2 of 3: Choose the barber');
  });

  it('moves focus and selection with the arrow keys inside one control group', () => {
    const { tabs, rail } = mount();
    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-pressed')).toBe('true');
    rail[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(rail[2]);
    expect(tabs[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('binds each journey once', () => {
    const { tabs, status } = mount();
    bindBookingJourney(window);
    tabs[1].click();
    expect(status.textContent).toBe('Showing step 2 of 3: Choose the barber');
  });
});
