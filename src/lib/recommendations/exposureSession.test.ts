import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearRecommendationExposureId,
  readRecommendationExposureId,
  storeRecommendationExposureId,
} from './exposureSession';

describe('recommendation exposure session', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
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

  it('stores and reads exposure id from sessionStorage', () => {
    clearRecommendationExposureId();
    storeRecommendationExposureId('exp-123');
    expect(readRecommendationExposureId()).toBe('exp-123');
    clearRecommendationExposureId();
    expect(readRecommendationExposureId()).toBeNull();
  });
});
