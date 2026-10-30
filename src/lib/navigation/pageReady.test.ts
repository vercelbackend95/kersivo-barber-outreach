/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { onPageReady } from './pageReady';

describe('onPageReady', () => {
  it('runs once on load and once per swapped page, with cleanup before each swap', () => {
    const cleanup = vi.fn();
    const init = vi.fn(() => cleanup);
    onPageReady(init);
    expect(init).toHaveBeenCalledTimes(1);

    // The router also fires astro:page-load for the first page.
    document.dispatchEvent(new Event('astro:page-load'));
    expect(init).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('astro:before-swap'));
    expect(cleanup).toHaveBeenCalledTimes(1);
    document.documentElement.replaceChild(document.createElement('body'), document.body);
    document.dispatchEvent(new Event('astro:page-load'));
    expect(init).toHaveBeenCalledTimes(2);
  });
});
