import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveClientPlatform, type PlatformNavigatorLike } from './platform';

function nav(partial: PlatformNavigatorLike): PlatformNavigatorLike {
  return partial;
}

describe('resolveClientPlatform', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns DESKTOP during SSR when navigator is unavailable', () => {
    const originalWindow = globalThis.window;
    // Simulate SSR: no window, no navigator override
    // @ts-expect-error test SSR path
    delete globalThis.window;
    expect(resolveClientPlatform()).toBe('DESKTOP');
    globalThis.window = originalWindow;
  });

  it('recognises modern iPhone', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          platform: 'iPhone',
        }),
      ),
    ).toBe('IOS');
  });

  it('recognises iPad', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          platform: 'iPad',
        }),
      ),
    ).toBe('IOS');
  });

  it('recognises iPadOS reporting MacIntel with touch points', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          platform: 'MacIntel',
          maxTouchPoints: 5,
        }),
      ),
    ).toBe('IOS');
  });

  it('recognises Android phone', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          platform: 'Linux armv8l',
          userAgentData: { mobile: true, platform: 'Android' },
        }),
      ),
    ).toBe('ANDROID');
  });

  it('recognises Android tablet', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          platform: 'Linux armv8l',
        }),
      ),
    ).toBe('ANDROID');
  });

  it('recognises ordinary macOS desktop', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          platform: 'MacIntel',
          maxTouchPoints: 0,
          userAgentData: { mobile: false, platform: 'macOS' },
        }),
      ),
    ).toBe('DESKTOP');
  });

  it('recognises Windows desktop', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          platform: 'Win32',
        }),
      ),
    ).toBe('DESKTOP');
  });

  it('recognises Linux desktop', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent:
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          platform: 'Linux x86_64',
        }),
      ),
    ).toBe('DESKTOP');
  });

  it('handles missing navigator fields as DESKTOP', () => {
    expect(resolveClientPlatform(nav({}))).toBe('DESKTOP');
  });

  it('maps unknown mobile platform to OTHER_MOBILE', () => {
    expect(
      resolveClientPlatform(
        nav({
          userAgent: 'Mozilla/5.0 (Mobile; rv:122.0) Gecko/122.0 Firefox/122.0',
          platform: '',
          userAgentData: { mobile: true, platform: 'Unknown' },
        }),
      ),
    ).toBe('OTHER_MOBILE');
  });

  it('does not execute navigator reads during SSR without override', () => {
    const spy = vi.fn();
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      get: spy,
    });
    const originalWindow = globalThis.window;
    // @ts-expect-error SSR
    delete globalThis.window;
    expect(resolveClientPlatform()).toBe('DESKTOP');
    expect(spy).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    globalThis.window = originalWindow;
  });
});
