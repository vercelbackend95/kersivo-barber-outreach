import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../../components/seo/GoogleAnalytics.astro'), 'utf8');

/**
 * Structural regression: inline GA bootstrap must not grant Ads Consent Mode
 * from stored cookie Ads flags when googleAdsId is empty.
 */
describe('GoogleAnalytics.astro Ads-dormant bootstrap contract', () => {
  it('derives Ads Consent Mode from capability-aware effective grants', () => {
    expect(src).toContain('var adsCapabilityEnabled = Boolean(googleAdsId)');
    expect(src).toContain(
      'adsCapabilityEnabled && prefs.advertisingMeasurement',
    );
    expect(src).toContain(
      'adsCapabilityEnabled && prefs.personalisedAdvertising',
    );
    expect(src).toContain(
      'var adsGranted = effectiveAdsMeasurement || effectivePersonalisedAdvertising',
    );
    expect(src).toContain(
      'ad_personalization: effectivePersonalisedAdvertising ? \'granted\' : \'denied\'',
    );
  });

  it('does not grant Ads Consent Mode from raw stored Ads prefs alone', () => {
    expect(src).not.toMatch(
      /var adsGranted = prefs\.advertisingMeasurement \|\| prefs\.personalisedAdvertising/,
    );
    expect(src).not.toMatch(
      /ad_personalization:\s*prefs\.personalisedAdvertising\s*\?\s*'granted'/,
    );
  });
});
