/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/consent/events', () => ({ trackConsentedEvent: vi.fn() }));

import { trackConsentedEvent } from '@/lib/consent/events';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { collectWorkLinks, initPlatformPicker } from './initPlatformPicker';
import { WORK_PICKER_COPY } from './workPlatforms';

function mountPicker() {
  document.body.innerHTML = `
    <div data-free-preview>
      <form data-free-preview-form>
        <fieldset data-platform-picker>
          <input data-smart-paste type="text" />
          <p data-smart-status></p>
          <button type="button" class="fp-platform" data-platform="instagram" aria-pressed="false" aria-label="Instagram">
            <span class="fp-platform__mark" data-has-mark="false"></span>
          </button>
          <button type="button" class="fp-platform" data-platform="booksy" aria-pressed="false" aria-label="Booksy">
            <span class="fp-platform__mark" data-has-mark="false"></span>
          </button>
          <p data-platform-count class="is-empty"></p>
          <div data-platform-inputs></div>
          <p data-platform-undo hidden>
            <span data-undo-message></span>
            <button type="button" data-undo>Undo</button>
          </p>
          <p data-platform-live></p>
        </fieldset>
      </form>
    </div>
  `;
  const root = document.querySelector<HTMLElement>('[data-free-preview]')!;
  initPlatformPicker(root);
  return root;
}

describe('initPlatformPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(trackConsentedEvent).mockReset();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('toggles a row, collects typed values, and does not submit empty rows', () => {
    const root = mountPicker();
    const instagram = root.querySelector<HTMLButtonElement>('[data-platform="instagram"]')!;
    instagram.click();
    expect(instagram.getAttribute('aria-pressed')).toBe('true');
    const input = root.querySelector<HTMLInputElement>('#fp-work-instagram')!;
    expect(input).toBeTruthy();
    expect(collectWorkLinks(root)).toEqual([]);
    input.value = '@sharpcuts';
    input.dispatchEvent(new Event('input'));
    expect(collectWorkLinks(root)).toEqual([{ platform: 'instagram', value: '@sharpcuts' }]);
    expect(root.querySelector('#fp-preview-instagram')?.textContent).toBe('instagram.com/sharpcuts');
    expect(trackConsentedEvent).toHaveBeenCalledWith(FUNNEL_EVENTS.preview_work_platform_selected, {
      platform: 'instagram',
    });
  });

  it('auto-detects a pasted Booksy URL and announces it', () => {
    const root = mountPicker();
    const smart = root.querySelector<HTMLInputElement>('[data-smart-paste]')!;
    smart.value = 'https://booksy.com/en-gb/1';
    smart.dispatchEvent(new Event('blur'));
    expect(root.querySelector<HTMLButtonElement>('[data-platform="booksy"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(root.querySelector<HTMLInputElement>('#fp-work-booksy')?.value).toBe('https://booksy.com/en-gb/1');
    expect(smart.value).toBe('');
    expect(root.querySelector('[data-smart-status]')?.textContent).toBe(WORK_PICKER_COPY.addedTo('Booksy'));
    expect(trackConsentedEvent).toHaveBeenCalledWith(FUNNEL_EVENTS.preview_work_platform_autodetected, {
      platform: 'booksy',
    });
  });

  it('shows a soft hint for text that is not a link', () => {
    const root = mountPicker();
    const smart = root.querySelector<HTMLInputElement>('[data-smart-paste]')!;
    smart.value = 'hello';
    smart.dispatchEvent(new Event('blur'));
    expect(root.querySelector('[data-smart-status]')?.textContent).toBe(WORK_PICKER_COPY.smartUnknown);
    expect(root.querySelector('#fp-work-website')).toBeNull();
  });

  it('offers a 5-second undo when a filled row is removed', () => {
    const root = mountPicker();
    root.querySelector<HTMLButtonElement>('[data-platform="instagram"]')!.click();
    const input = root.querySelector<HTMLInputElement>('#fp-work-instagram')!;
    input.value = '@shop';
    input.dispatchEvent(new Event('input'));
    root.querySelector<HTMLButtonElement>('[data-platform="instagram"]')!.click();
    expect(root.querySelector('#fp-work-instagram')).toBeNull();
    const undo = root.querySelector<HTMLElement>('[data-platform-undo]')!;
    expect(undo.hidden).toBe(false);
    expect(root.querySelector('[data-undo-message]')?.textContent).toBe(WORK_PICKER_COPY.removedUndo('Instagram'));
    root.querySelector<HTMLButtonElement>('[data-undo]')!.click();
    expect(root.querySelector<HTMLInputElement>('#fp-work-instagram')?.value).toBe('@shop');
    expect(undo.hidden).toBe(true);
  });
});
