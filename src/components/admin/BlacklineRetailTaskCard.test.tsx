/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BlacklineRetailTaskCard from './BlacklineRetailTaskCard';

describe('BlacklineRetailTaskCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('guides collect, then transitions to View in Sales', () => {
    const { rerender } = render(<BlacklineRetailTaskCard stage="collect" orderId="order-1" />);
    expect(screen.getByText('YOUR DEMO ORDER')).toBeTruthy();
    expect(screen.getByText('A customer has paid online')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View in Sales' })).toBeNull();

    rerender(<BlacklineRetailTaskCard stage="view_sale" orderId="order-1" />);
    expect(screen.getByText('ORDER COLLECTED')).toBeTruthy();
    expect(screen.getByText('Now see the sale')).toBeTruthy();
    const cta = screen.getByRole('link', { name: 'View in Sales' });
    expect(cta.getAttribute('href')).toBe(
      '/demo/admin?section=shop_sales&order=order-1&demoJourney=retail',
    );
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});
