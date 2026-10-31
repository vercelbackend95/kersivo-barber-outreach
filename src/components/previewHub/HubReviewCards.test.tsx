/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HUB_CHECK_DETAILS_TITLE,
  HUB_DETAILS_SERVICES_TITLE,
  HUB_REVIEW_LOOKS_RIGHT,
  HUB_REVIEW_NOT_CHECKED,
  HUB_REVIEW_UPDATED,
} from '@/lib/freePreview/hubCopy';
import { HubReviewCards } from './HubReviewCards';

afterEach(() => cleanup());

const shop = {
  shopId: 'shop_1',
  services: [{ id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2500 }],
  barbers: [{ id: 'b1', name: 'Alex', photoAssetId: null }],
  hours: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    open: dayOfWeek !== 7,
    start: '09:00',
    end: '18:00',
  })),
};

describe('HubReviewCards', () => {
  it('renders the Overview strip states', () => {
    render(
      <HubReviewCards
        token={'A'.repeat(43)}
        detailsHref="/preview/x/details"
        canReview
        mode="strip"
        shop={shop}
        reviews={{
          SERVICES: {
            id: 'r1',
            section: 'SERVICES',
            state: 'APPLIED',
            cardState: 'updated',
            proposal: null,
            opsNote: null,
            createdAt: '2026-10-31T12:00:00.000Z',
            appliedAt: '2026-10-31T13:00:00.000Z',
          },
          TEAM: null,
          HOURS: null,
        }}
      />,
    );
    expect(screen.getByText(HUB_CHECK_DETAILS_TITLE)).toBeTruthy();
    expect(screen.getByText(HUB_REVIEW_UPDATED)).toBeTruthy();
    expect(screen.getAllByText(HUB_REVIEW_NOT_CHECKED).length).toBeGreaterThan(0);
  });

  it('renders full cards with Looks right', () => {
    render(
      <HubReviewCards
        token={'A'.repeat(43)}
        canReview
        mode="full"
        shop={shop}
        reviews={{ SERVICES: null, TEAM: null, HOURS: null }}
      />,
    );
    expect(screen.getByRole('heading', { name: HUB_DETAILS_SERVICES_TITLE })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: new RegExp(HUB_REVIEW_LOOKS_RIGHT) }).length).toBe(3);
  });
});
