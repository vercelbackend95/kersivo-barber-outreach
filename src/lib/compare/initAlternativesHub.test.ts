/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { HUB_CRITERIA } from '@/lib/compare/alternativesHubCriteria';
import { initAlternativesHub } from '@/lib/compare/initAlternativesHub';

type CardFixture = { id: string; name: string; firstParty?: boolean; order: number; statuses: Record<string, string> };

const CARDS: CardFixture[] = [
  { id: 'kersivo', name: 'KERSIVO', firstParty: true, order: 0, statuses: { zeroCommission: 'no', deposits: 'yes', retail: 'yes' } },
  { id: 'aaa', name: 'Zed', order: 1, statuses: { zeroCommission: 'limited', deposits: 'no', retail: 'no' } },
  { id: 'bbb', name: 'Bee', order: 2, statuses: { zeroCommission: 'yes', deposits: 'yes', retail: 'unverified' } },
  { id: 'ccc', name: 'Cee', order: 3, statuses: { zeroCommission: 'unverified', deposits: 'yes', retail: 'yes' } },
];

function card(c: CardFixture): string {
  const features = Object.keys(c.statuses)
    .map((id) => `<li data-criterion="${id}" data-selected="false"></li>`)
    .join('');
  return `<article data-hub-card data-platform-id="${c.id}" data-platform-name="${c.name}" data-order="${c.order}"
    data-first-party="${c.firstParty ? 'true' : 'false'}" data-collapsed="false" data-statuses='${JSON.stringify(c.statuses)}'>
    <div data-hub-ring data-empty="false"><svg><circle data-hub-ring-value stroke-dashoffset="0"></circle></svg>
    <span data-hub-score-label></span><span data-hub-score-description></span></div>
    <ul>${features}</ul></article>`;
}

function mount(pressed: string[] = ['zeroCommission', 'deposits']): void {
  const pills = HUB_CRITERIA.map(
    (c, i) =>
      `<button type="button" class="alt-hub-pill${i >= 6 ? ' alt-hub-pill--extra' : ''}" data-hub-filter="${c.id}" aria-pressed="${pressed.includes(c.id)}"></button>`,
  ).join('');
  document.body.innerHTML = `
    <section data-hub-root data-initial-visible="3" data-suggested="${pressed.join(',')}">
      <div class="alt-hub-panel" data-filters-expanded="false">
        <span data-hub-selected-count></span>
        <button type="button" data-hub-reset></button>
        <p data-hub-suggested-note></p>
        <div>${pills}</div>
        <button type="button" data-hub-more-filters aria-expanded="false"><span data-hub-more-label></span></button>
        <select data-hub-sort><option value="best">Best match</option><option value="name">Name</option></select>
      </div>
      <p data-hub-live></p>
      <div data-hub-grid data-expanded="false">${CARDS.map(card).join('')}</div>
      <button type="button" data-hub-show-all aria-expanded="false"><span data-hub-show-all-label></span></button>
    </section>`;
}

const order = () => Array.from(document.querySelectorAll<HTMLElement>('[data-hub-card]')).map((el) => el.dataset.platformId);
const label = (id: string) => document.querySelector(`[data-platform-id="${id}"] [data-hub-score-label]`)?.textContent;
const pill = (id: string) => document.querySelector<HTMLButtonElement>(`[data-hub-filter="${id}"]`)!;

describe('initAlternativesHub', () => {
  beforeEach(() => mount());

  it('scores and orders cards on init with the first-party card pinned first', () => {
    initAlternativesHub(document);
    expect(order()).toEqual(['kersivo', 'bbb', 'ccc', 'aaa']);
    expect(label('kersivo')).toBe('1/2');
    expect(label('bbb')).toBe('2/2');
    expect(label('ccc')).toBe('1/2');
    expect(document.querySelector('[data-hub-selected-count]')?.textContent).toBe('2');
  });

  it('toggles a filter, updates aria-pressed, scores, rings and feature emphasis', () => {
    initAlternativesHub(document);
    pill('retail').click();
    expect(pill('retail').getAttribute('aria-pressed')).toBe('true');
    expect(label('bbb')).toBe('2/3');
    expect(label('ccc')).toBe('2/3');
    expect(document.querySelector('[data-platform-id="ccc"] [data-criterion="retail"]')?.getAttribute('data-selected')).toBe('true');

    pill('zeroCommission').click();
    expect(pill('zeroCommission').getAttribute('aria-pressed')).toBe('false');
    expect(order()).toEqual(['kersivo', 'ccc', 'bbb', 'aaa']);
    const offset = document.querySelector('[data-platform-id="ccc"] [data-hub-ring-value]')?.getAttribute('stroke-dashoffset');
    expect(Number(offset)).toBe(0);
  });

  it('resets to a neutral state with no selections and registry order', () => {
    initAlternativesHub(document);
    document.querySelector<HTMLButtonElement>('[data-hub-reset]')!.click();
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(label('bbb')).toBe('–');
    expect(document.querySelector('[data-platform-id="bbb"] [data-hub-ring]')?.getAttribute('data-empty')).toBe('true');
    expect(order()).toEqual(['kersivo', 'aaa', 'bbb', 'ccc']);
    expect(document.querySelector('[data-hub-live]')?.textContent).toContain('Select priorities');
    expect(document.querySelector<HTMLElement>('[data-hub-suggested-note]')!.hidden).toBe(true);
  });

  it('sorts alphabetically while keeping the first-party card first', () => {
    initAlternativesHub(document);
    const select = document.querySelector<HTMLSelectElement>('[data-hub-sort]')!;
    select.value = 'name';
    select.dispatchEvent(new Event('change'));
    expect(order()).toEqual(['kersivo', 'bbb', 'ccc', 'aaa']);
    expect(document.querySelector('[data-hub-live]')?.textContent).toContain('sorted by name');
  });

  it('collapses cards beyond the initial count and toggles show-all', () => {
    initAlternativesHub(document);
    expect(document.querySelector('[data-platform-id="aaa"]')?.getAttribute('data-collapsed')).toBe('true');
    const button = document.querySelector<HTMLButtonElement>('[data-hub-show-all]')!;
    button.click();
    expect(document.querySelector('[data-hub-grid]')?.getAttribute('data-expanded')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-hub-show-all-label]')?.textContent).toBe('Show fewer systems');
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-hub-show-all-label]')?.textContent).toBe('Show all systems (4)');
  });

  it('toggles the mobile "More filters" control', () => {
    initAlternativesHub(document);
    const more = document.querySelector<HTMLButtonElement>('[data-hub-more-filters]')!;
    more.click();
    expect(document.querySelector('.alt-hub-panel')?.getAttribute('data-filters-expanded')).toBe('true');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    more.click();
    expect(document.querySelector('[data-hub-more-label]')?.textContent).toBe('More filters (6)');
  });

  it('binds only once when initialised repeatedly', () => {
    initAlternativesHub(document);
    initAlternativesHub(document);
    pill('retail').click();
    expect(pill('retail').getAttribute('aria-pressed')).toBe('true');
  });

  it('hides the suggested note after the selection changes and reports it when restored', () => {
    initAlternativesHub(document);
    const note = document.querySelector<HTMLElement>('[data-hub-suggested-note]')!;
    expect(note.hidden).toBe(false);
    pill('retail').click();
    expect(note.hidden).toBe(true);
    pill('retail').click();
    expect(note.hidden).toBe(false);
  });
});
