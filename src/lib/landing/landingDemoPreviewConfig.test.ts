import { describe, expect, it } from 'vitest';
import { adminDemoHref } from '@/lib/admin/demoConfig';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { getLandingDemoPreviewConfig } from './landingDemoPreviewConfig';

describe('getLandingDemoPreviewConfig', () => {
  it('landing keeps dual CTAs, onboarding links, monetization rows, and live-demo id', () => {
    const config = getLandingDemoPreviewConfig('landing');

    expect(config.sectionId).toBe('live-demo');
    expect(config.headingId).toBe('landing-demo-preview-title');
    expect(config.showMonetization).toBe(true);
    expect(config.showMoreIncluded).toBe(true);
    expect(config.showAdsFooter).toBe(false);
    expect(config.rows).toHaveLength(3);

    for (const row of config.rows) {
      expect(row.ghostCtaLabel).toBeTruthy();
      expect(row.ghostCtaHref).toBeTruthy();
      expect(row.ctaTrack).toBe(FUNNEL_EVENTS.plan_my_setup_click);
    }

    expect(config.rows[0]?.ctaHref).toBe('/admin/onboarding');
    expect(config.rows[1]?.ctaHref).toBe('/admin/onboarding');
    expect(config.rows[2]?.ctaHref).toBe('/admin/retail-onboarding');
    expect(config.rows[0]?.ghostCtaHref).toBe(adminDemoHref('timeline'));
  });

  it('adsLp uses demo-only CTAs, ads ids, and hides onboarding/monetization', () => {
    const config = getLandingDemoPreviewConfig('adsLp');

    expect(config.sectionId).toBe('demo');
    expect(config.headingId).toBe('ads-lp-demo-heading');
    expect(config.ariaLabelledBy).toBe('ads-lp-demo-heading');
    expect(config.sectionClassExtra).toBe('landing-demo-preview--ads-lp');
    expect(config.showMonetization).toBe(false);
    expect(config.showMoreIncluded).toBe(false);
    expect(config.showAdsFooter).toBe(true);
    expect(config.rows).toHaveLength(3);

    const hrefs = config.rows.flatMap((row) => [
      row.ctaHref,
      row.ghostCtaHref,
    ].filter(Boolean));

    expect(hrefs).not.toContain('/admin/onboarding');
    expect(hrefs).not.toContain('/admin/retail-onboarding');

    for (const row of config.rows) {
      expect(row.ghostCtaLabel).toBeUndefined();
      expect(row.ghostCtaHref).toBeUndefined();
      expect(row.ctaSameTab).toBe(false);
    }

    expect(config.rows[0]).toMatchObject({
      ctaLabel: 'Open full admin demo',
      ctaHref: adminDemoHref('timeline'),
      ctaTrack: FUNNEL_EVENTS.ads_lp_admin_demo_click,
      media: 'widget',
    });
    expect(config.rows[1]).toMatchObject({
      ctaLabel: 'Try the booking flow',
      ctaHref: '/book',
      ctaTrack: FUNNEL_EVENTS.ads_lp_client_demo_click,
      media: 'booking',
    });
    expect(config.rows[2]).toMatchObject({
      ctaLabel: 'Explore the example shop',
      ctaHref: '/shop',
      ctaTrack: FUNNEL_EVENTS.ads_lp_retail_demo_click,
      media: 'carousel',
    });
  });

  it('defaults to landing when variant is omitted', () => {
    expect(getLandingDemoPreviewConfig().sectionId).toBe('live-demo');
  });
});
