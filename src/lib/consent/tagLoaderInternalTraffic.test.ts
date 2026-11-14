/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://kersivo.co.uk/"}
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreferences } from './storage';
import { syncTagsForConsent } from './tagLoader';

const IDS = { gaMeasurementId: 'G-TEST', googleAdsId: '' };
const ANALYTICS = createPreferences({
  analytics: true,
  advertisingMeasurement: false,
  personalisedAdvertising: false,
});

/** Consent accepted on the banner: the tag loader configures GA4, not the inline bootstrap. */
describe('syncTagsForConsent internal traffic', () => {
  beforeEach(() => {
    window.__kersivoGtagScriptLoaded = true;
    window.__kersivoGa4Configured = undefined;
    window.gtag = vi.fn();
  });

  afterEach(() => {
    document.cookie = 'kersivo_internal=; Max-Age=0; Path=/';
  });

  it('tags a marked device before the first page view', async () => {
    document.cookie = 'kersivo_internal=1; Path=/';
    await syncTagsForConsent(ANALYTICS, IDS);
    const calls = vi.mocked(window.gtag!).mock.calls;
    const setIndex = calls.findIndex((c) => c[0] === 'set');
    const configIndex = calls.findIndex((c) => c[0] === 'config');
    expect(calls[setIndex]).toEqual(['set', { traffic_type: 'internal' }]);
    expect(setIndex).toBeLessThan(configIndex);
    expect(calls[configIndex]).toEqual(['config', 'G-TEST', { anonymize_ip: true, traffic_type: 'internal' }]);
  });

  it('leaves real visitors untagged', async () => {
    await syncTagsForConsent(ANALYTICS, IDS);
    const calls = vi.mocked(window.gtag!).mock.calls;
    expect(calls.some((c) => c[0] === 'set')).toBe(false);
    expect(calls.find((c) => c[0] === 'config')).toEqual(['config', 'G-TEST', { anonymize_ip: true }]);
  });
});
