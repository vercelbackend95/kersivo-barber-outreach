/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindComparisonAccordions } from './comparisonAccordion';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, '../..', path), 'utf8');

const item = (id: string, open: boolean) => `
  <article data-comparison-item data-open="${open}">
    <button id="t-${id}" aria-expanded="${open}" data-comparison-trigger>${id}</button>
    <div data-comparison-reveal aria-hidden="${!open}">
      <div data-comparison-reveal-inner ${open ? '' : 'inert'}>panel ${id}</div>
    </div>
  </article>`;

const state = (id: string) => {
  const el = document.querySelector<HTMLElement>(`#t-${id}`)!.closest<HTMLElement>('[data-comparison-item]')!;
  return {
    open: el.dataset.open,
    expanded: el.querySelector('[data-comparison-trigger]')!.getAttribute('aria-expanded'),
    hidden: el.querySelector('[data-comparison-reveal]')!.getAttribute('aria-hidden'),
    inert: el.querySelector('[data-comparison-reveal-inner]')!.hasAttribute('inert'),
  };
};

const click = (id: string) => document.querySelector<HTMLButtonElement>(`#t-${id}`)!.click();

describe('comparison accordion', () => {
  beforeEach(() => {
    document.body.innerHTML = `<section data-test-comparison>${item('a', true)}${item('b', false)}${item('c', false)}</section>`;
  });

  it('keeps the server-rendered first category open and never observes scroll', () => {
    const observe = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe, disconnect: vi.fn() })));
    bindComparisonAccordions('[data-test-comparison]');
    expect(IntersectionObserver).not.toHaveBeenCalled();
    expect(state('a')).toEqual({ open: 'true', expanded: 'true', hidden: 'false', inert: false });
    expect(state('b')).toEqual({ open: 'false', expanded: 'false', hidden: 'true', inert: true });
    vi.unstubAllGlobals();
  });

  it('opens one category at a time on click and closes it on a second click', () => {
    bindComparisonAccordions('[data-test-comparison]');
    click('b');
    expect(state('a').open).toBe('false');
    expect(state('b')).toEqual({ open: 'true', expanded: 'true', hidden: 'false', inert: false });
    click('b');
    expect(state('b')).toEqual({ open: 'false', expanded: 'false', hidden: 'true', inert: true });
    expect(state('a').open).toBe('false');
  });

  it('binds each root only once', () => {
    bindComparisonAccordions('[data-test-comparison]');
    bindComparisonAccordions('[data-test-comparison]');
    click('b');
    expect(state('b').open).toBe('true');
  });

  it('is shared by the Booksy and Fresha comparisons, which render the first category open', () => {
    for (const [path, attr] of [
      ['components/booksyAlternative/BooksyCompare.astro', 'data-booksy-comparison'],
      ['components/freshaAlternative/FreshaCompare.astro', 'data-fresha-comparison'],
    ]) {
      const source = read(path);
      expect(source).toContain("import { bindComparisonAccordions } from '@/lib/landing/comparisonAccordion';");
      expect(source).toContain(`bindComparisonAccordions('[${attr}]')`);
      expect(source).toContain("data-open={index === 0 ? 'true' : 'false'}");
      expect(source).toContain("aria-expanded={index === 0 ? 'true' : 'false'}");
      expect(source).toContain("aria-hidden={index === 0 ? 'false' : 'true'}");
      expect(source).toContain('inert={index !== 0}');
      expect(source).not.toMatch(/IntersectionObserver|autoOpened/);
    }
    expect(read('lib/landing/comparisonAccordion.ts')).not.toContain('IntersectionObserver');
  });
});
