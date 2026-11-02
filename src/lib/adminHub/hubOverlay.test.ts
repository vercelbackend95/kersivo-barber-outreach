/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockAdminHubScroll } from './hubOverlay';

afterEach(() => {
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.overscrollBehavior = '';
});

describe('lockAdminHubScroll', () => {
  it('locks html and body overflow and restores the previous scroll position', () => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(140);

    const unlock = lockAdminHubScroll();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    const nested = lockAdminHubScroll();
    unlock();
    expect(document.body.style.overflow).toBe('hidden');

    nested();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.scrollTop).toBe(140);
  });
});
