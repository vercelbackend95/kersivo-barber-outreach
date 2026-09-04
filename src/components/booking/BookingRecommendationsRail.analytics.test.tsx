/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import BookingRecommendationsRail from './BookingRecommendationsRail';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { clearRecommendationExposureId, storeRecommendationExposureId } from '@/lib/recommendations/exposureSession';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(() => true),
}));

import { trackConsentedEvent } from '@/lib/consent/events';

const trackSpy = vi.mocked(trackConsentedEvent);

const demoProducts = [
  {
    id: 'prod-fibre',
    name: 'Hair Fibre',
    category: 'Styling',
    pricePence: 1800,
    imageUrl: null,
    available: true,
    requiresOptions: false,
  },
  {
    id: 'prod-clay',
    name: 'Matte Clay',
    category: 'Styling',
    pricePence: 1900,
    imageUrl: null,
    available: true,
    requiresOptions: false,
  },
];

describe('BookingRecommendationsRail click analytics', () => {
  beforeEach(() => {
    trackSpy.mockClear();
    clearRecommendationExposureId();
    storeRecommendationExposureId('exp-click-1');
  });

  afterEach(() => {
    cleanup();
    clearRecommendationExposureId();
  });

  it('fires one product_open event with allowlisted PII-free params', () => {
    render(
      <BookingRecommendationsRail
        shopId="shop-1"
        serviceId="svc-1"
        productHrefBase="/shop/shop-1"
        demoProducts={demoProducts}
      />,
    );

    const hit = document.querySelector('.sf-card-hit') as HTMLAnchorElement;
    expect(hit).toBeTruthy();
    fireEvent.click(hit);

    const clickCalls = trackSpy.mock.calls.filter(
      ([eventName]) => eventName === FUNNEL_EVENTS.recommendation_product_click,
    );
    expect(clickCalls).toHaveLength(1);
    const params = clickCalls[0]?.[1] as Record<string, unknown>;
    expect(params).toEqual({
      exposure_id: 'exp-click-1',
      shop_id: 'shop-1',
      service_id: 'svc-1',
      product_id: 'prod-fibre',
      product_position: 1,
      interaction_type: 'product_open',
    });
    expect(Object.keys(params).sort()).toEqual([
      'exposure_id',
      'interaction_type',
      'product_id',
      'product_position',
      'service_id',
      'shop_id',
    ]);
    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain('Hair Fibre');
    expect(serialized).not.toContain('1800');
    expect(serialized).not.toMatch(/@|phone|email|booking/i);
  });

  it('fires one quick_add event and does not also count as product_open', () => {
    render(
      <BookingRecommendationsRail
        shopId="shop-1"
        serviceId="svc-1"
        productHrefBase="/shop/shop-1"
        demoProducts={demoProducts}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Add/i })[0]!);

    const clickCalls = trackSpy.mock.calls.filter(
      ([eventName]) => eventName === FUNNEL_EVENTS.recommendation_product_click,
    );
    expect(clickCalls).toHaveLength(1);
    expect(clickCalls[0]?.[1]).toEqual(
      expect.objectContaining({
        product_id: 'prod-fibre',
        product_position: 1,
        interaction_type: 'quick_add',
      }),
    );
    expect(clickCalls[0]?.[2]).toBe('analytics');
  });

  it('goes through the analytics consent category helper', () => {
    trackSpy.mockReturnValueOnce(false);
    render(
      <BookingRecommendationsRail
        shopId="shop-1"
        serviceId="svc-1"
        productHrefBase="/shop/shop-1"
        demoProducts={demoProducts}
      />,
    );

    fireEvent.click(document.querySelector('.sf-card-hit')!);
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.recommendation_product_click,
      expect.any(Object),
      'analytics',
    );
  });
});
