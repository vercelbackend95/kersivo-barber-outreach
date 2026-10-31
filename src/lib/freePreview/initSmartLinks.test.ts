/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/consent/events', () => ({ trackConsentedEvent: vi.fn() }));

import { trackConsentedEvent } from '@/lib/consent/events';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { initSmartLinks, type SmartLinks } from './initSmartLinks';
import { SMART_LINK_COPY } from './workPlatforms';

let links: SmartLinks;
let root: HTMLElement;
const onNext = vi.fn();
const onChange = vi.fn();

const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
const input = () => q<HTMLInputElement>('[data-smart-paste]');
const chips = () => [...root.querySelectorAll<HTMLLIElement>('.fp-link-chip')];
const live = () => q('[data-link-live]').textContent;

function type(value: string) {
  input().value = value;
  input().dispatchEvent(new Event('input', { bubbles: true }));
}

function pressEnter() {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  input().dispatchEvent(event);
  return event;
}

function paste(text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  input().dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(trackConsentedEvent).mockClear();
  onNext.mockClear();
  onChange.mockClear();
  document.body.innerHTML = `
    <div data-free-preview>
      <ul data-link-chips hidden></ul>
      <div data-link-entry><input data-smart-paste type="text" /></div>
      <button type="button" data-link-add hidden></button>
      <p data-link-supported></p>
      <p data-link-hint hidden></p>
      <p data-link-max hidden></p>
      <p data-link-undo hidden><button type="button" data-link-undo-button>Undo</button></p>
      <span data-error-for="links"></span>
      <p data-link-live></p>
    </div>`;
  root = document.querySelector<HTMLElement>('[data-free-preview]')!;
  links = initSmartLinks(root, { onNext, onChange })!;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('adding links', () => {
  it('adds on Enter without submitting, then collapses behind the add-another button', () => {
    type('https://booksy.com/en-gb/1?utm_source=bio');
    const event = pressEnter();
    expect(event.defaultPrevented).toBe(true);
    expect(links.links().map((link) => link.url)).toEqual(['https://booksy.com/en-gb/1']);
    expect(chips()[0].textContent).toContain('Booksy');
    expect(chips()[0].textContent).toContain('booksy.com/en-gb/1');
    expect(q('[data-link-entry]').hidden).toBe(true);
    expect(q('[data-link-add]').hidden).toBe(false);
    expect(q('[data-link-supported]').hidden).toBe(true);
    expect(live()).toBe('Booksy link added');
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('adds on blur when valid', () => {
    type('@sharpcuts');
    input().dispatchEvent(new Event('blur'));
    expect(links.links()[0]).toMatchObject({ platform: 'instagram', url: 'https://www.instagram.com/sharpcuts' });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('adds every link from pasted text, ignoring words between them', () => {
    const event = paste('Our pages: booksy.com/shop, @sharpcuts\nhttps://maps.app.goo.gl/abc and sharpcuts.co.uk.');
    expect(event.defaultPrevented).toBe(true);
    expect(links.links().map((link) => link.platform)).toEqual(['booksy', 'instagram', 'google', 'website']);
    expect(input().value).toBe('');
    expect(live()).toBe('Booksy link added. Instagram link added. Google link added. Website link added');
  });

  it('dedupes against links already added', () => {
    paste('@sharpcuts');
    paste('https://www.instagram.com/sharpcuts/?igsh=1');
    expect(links.links()).toHaveLength(1);
    expect(q('[data-link-hint]').hidden).toBe(true);
  });

  it('stops at 5, says so and takes the input away', () => {
    paste('a1.co.uk a2.co.uk a3.co.uk a4.co.uk a5.co.uk a6.co.uk');
    expect(links.links()).toHaveLength(5);
    expect(q('[data-link-max]').hidden).toBe(false);
    expect(q('[data-link-entry]').hidden).toBe(true);
    expect(q('[data-link-add]').hidden).toBe(true);
  });

  it('re-opens the input from the add-another button', () => {
    paste('@sharpcuts');
    q('[data-link-add]').click();
    expect(q('[data-link-entry]').hidden).toBe(false);
    expect(q('[data-link-add]').hidden).toBe(true);
  });

  it('tracks the platform only, never the URL', () => {
    paste('https://booksy.com/en-gb/secret-shop');
    expect(trackConsentedEvent).toHaveBeenCalledWith(FUNNEL_EVENTS.fp_link_added, { platform: 'booksy' });
    expect(JSON.stringify(vi.mocked(trackConsentedEvent).mock.calls)).not.toContain('secret-shop');
  });
});

describe('invalid input', () => {
  it('shows the hint, keeps the text and does not move on', () => {
    type('not a link');
    pressEnter();
    expect(links.links()).toEqual([]);
    expect(input().value).toBe('not a link');
    expect(q('[data-link-hint]').textContent).toBe(SMART_LINK_COPY.invalid);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(onNext).not.toHaveBeenCalled();
    type('not a link any more');
    expect(q('[data-link-hint]').hidden).toBe(true);
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('moves on for Enter on an empty input', () => {
    pressEnter();
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('chips', () => {
  it('builds a safe Check link and a labelled remove button', () => {
    paste('https://booksy.com/en-gb/1');
    const check = chips()[0].querySelector('a')!;
    expect(check.href).toBe('https://booksy.com/en-gb/1');
    expect(check.target).toBe('_blank');
    expect(check.rel).toBe('noopener noreferrer');
    expect(chips()[0].querySelector('button')!.getAttribute('aria-label')).toBe('Remove Booksy link');
  });

  it('removes, announces and restores with Undo in the same place', () => {
    paste('@one booksy.com/two');
    chips()[0].querySelector('button')!.click();
    expect(links.links().map((link) => link.platform)).toEqual(['booksy']);
    expect(live()).toBe('Link removed');
    expect(q('[data-link-undo]').hidden).toBe(false);
    q('[data-link-undo-button]').click();
    expect(links.links().map((link) => link.platform)).toEqual(['instagram', 'booksy']);
    expect(chips().map((chip) => chip.textContent?.includes('Instagram'))).toEqual([true, false]);
    expect(q('[data-link-undo]').hidden).toBe(true);
  });

  it('drops Undo after a few seconds', () => {
    paste('@one');
    chips()[0].querySelector('button')!.click();
    vi.advanceTimersByTime(5000);
    expect(q('[data-link-undo]').hidden).toBe(true);
  });

  it('brings the input back when the last link goes', () => {
    paste('@one');
    chips()[0].querySelector('button')!.click();
    expect(q('[data-link-entry]').hidden).toBe(false);
    expect(q('[data-link-supported]').hidden).toBe(false);
    expect(q('[data-link-chips]').hidden).toBe(true);
    expect(document.activeElement).toBe(input());
  });
});
