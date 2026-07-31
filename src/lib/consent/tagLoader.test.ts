import { describe, expect, it } from 'vitest';
import { createPreferences } from './storage';
import { resolveTagTargets, type TagLoaderIds } from './tagLoader';

const IDS: TagLoaderIds = { gaMeasurementId: 'G-TEST', googleAdsId: 'AW-TEST' };

const NONE = {
  analytics: false,
  advertisingMeasurement: false,
  personalisedAdvertising: false,
} as const;

describe('resolveTagTargets', () => {
  it('loads nothing without a consent decision', () => {
    expect(resolveTagTargets(null, IDS)).toEqual({ wantAnalytics: false, wantAds: false });
  });

  it('loads nothing when every optional purpose is rejected', () => {
    expect(resolveTagTargets(createPreferences(NONE), IDS)).toEqual({
      wantAnalytics: false,
      wantAds: false,
    });
  });

  it('loads the Ads tag for personalised advertising alone', () => {
    const prefs = createPreferences({ ...NONE, personalisedAdvertising: true });
    expect(resolveTagTargets(prefs, IDS)).toEqual({ wantAnalytics: false, wantAds: true });
  });

  it('loads the Ads tag for advertising measurement alone', () => {
    const prefs = createPreferences({ ...NONE, advertisingMeasurement: true });
    expect(resolveTagTargets(prefs, IDS)).toEqual({ wantAnalytics: false, wantAds: true });
  });

  it('never loads a tag whose public id is unset', () => {
    const prefs = createPreferences({
      analytics: true,
      advertisingMeasurement: true,
      personalisedAdvertising: true,
    });
    expect(resolveTagTargets(prefs, { gaMeasurementId: '', googleAdsId: '' })).toEqual({
      wantAnalytics: false,
      wantAds: false,
    });
  });
});
