/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DemoConfirmation from '@/components/demo/DemoConfirmation';
import { BLACKLINE_CONFIRMATION_STORAGE_KEY } from '@/lib/demo/products';
import {
  BLACKLINE_SESSION_ORDERS_KEY,
  addBlacklineSessionOrder,
  toConfirmationSnapshot,
} from '@/lib/demo/blacklineSessionOrders';

describe('BLACKLINE demo confirmation', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it('shows the purchased summary and a primary owner-dashboard CTA', () => {
    const created = addBlacklineSessionOrder({
      items: [
        {
          productId: 'bl-product-ironclad-pomade',
          name: 'Ironclad Pomade',
          unitPricePence: 1900,
          quantity: 1,
          lineTotalPence: 1900,
          imageUrl: '/demo/products/ironclad-pomade.webp',
        },
      ],
      totalPence: 1900,
      now: new Date('2026-08-18T12:00:00.000Z'),
    });
    window.sessionStorage.setItem(
      BLACKLINE_CONFIRMATION_STORAGE_KEY,
      JSON.stringify(toConfirmationSnapshot(created)),
    );

    render(<DemoConfirmation />);

    expect(screen.getByText('Ironclad Pomade')).toBeTruthy();
    expect(screen.getByText(created.reference)).toBeTruthy();
    const cta = screen.getByRole('link', { name: 'See your order in the dashboard' });
    expect(cta.getAttribute('href')).toBe(
      `/demo/admin?section=shop_orders&order=${created.id}&demoJourney=retail`,
    );
    expect(cta.getAttribute('href')?.startsWith('/admin')).toBe(false);
    expect(screen.getByRole('link', { name: 'Back to shop' }).getAttribute('href')).toBe('/demo/shop');
    expect(screen.getByText(/no real payment, order or email/i)).toBeTruthy();
  });

  it('recovers when confirmation storage is missing', () => {
    window.sessionStorage.removeItem(BLACKLINE_CONFIRMATION_STORAGE_KEY);
    window.sessionStorage.removeItem(BLACKLINE_SESSION_ORDERS_KEY);
    render(<DemoConfirmation />);
    expect(screen.getByRole('link', { name: 'Back to shop' })).toBeTruthy();
  });
});
