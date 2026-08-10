import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PREVIEW_SUBSCRIBE_BANNER_SECTION_HIDES,
  PREVIEW_SUBSCRIBE_BANNER_STORAGE_KEY,
  dismissPreviewSubscribeBanner,
  isPreviewSubscribeBannerVisible,
  notePreviewSubscribeBannerSectionChange,
} from './previewSubscribeBanner';

describe('previewSubscribeBanner', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  it('is visible by default', () => {
    expect(isPreviewSubscribeBannerVisible()).toBe(true);
  });

  it('hides after dismiss and returns after N section changes', () => {
    dismissPreviewSubscribeBanner();
    expect(isPreviewSubscribeBannerVisible()).toBe(false);
    expect(store.get(PREVIEW_SUBSCRIBE_BANNER_STORAGE_KEY)).toContain(
      String(PREVIEW_SUBSCRIBE_BANNER_SECTION_HIDES),
    );

    for (let i = 0; i < PREVIEW_SUBSCRIBE_BANNER_SECTION_HIDES - 1; i += 1) {
      expect(notePreviewSubscribeBannerSectionChange()).toBe(false);
    }
    expect(notePreviewSubscribeBannerSectionChange()).toBe(true);
    expect(isPreviewSubscribeBannerVisible()).toBe(true);
    expect(store.has(PREVIEW_SUBSCRIBE_BANNER_STORAGE_KEY)).toBe(false);
  });

  it('stays visible across section changes when not dismissed', () => {
    expect(notePreviewSubscribeBannerSectionChange()).toBe(true);
    expect(notePreviewSubscribeBannerSectionChange()).toBe(true);
  });
});
