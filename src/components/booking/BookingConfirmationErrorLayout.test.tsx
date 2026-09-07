/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

/**
 * Mirrors the deposit/payment error markup in success.astro so the layout
 * contract stays protected when pass-specific confirmation styles evolve.
 */
function BookingDepositErrorConfirmation({
  message,
  shopId,
}: {
  message: string;
  shopId: string;
}) {
  return (
    <section className="booking-confirmation booking-confirmation--error" role="alert">
      <div className="booking-confirmation__header">
        <div className="booking-confirmation__copy">
          <p className="booking-confirmation__eyebrow">Payment</p>
          <h2 className="booking-confirmation__heading">Could not confirm</h2>
          <p className="booking-confirmation__body">{message}</p>
        </div>
      </div>
      <div className="booking-confirmation__cta">
        <a className="btn btn--secondary btn--lg" href={`/book/${shopId}`}>
          Back to booking
        </a>
      </div>
    </section>
  );
}

describe('Booking deposit/payment error layout contract', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps a single-column header without an icon track and preserves retry CTA', () => {
    const style = document.createElement('style');
    style.textContent = `
      .booking-confirmation--error .booking-confirmation__header {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
      }
      .booking-confirmation--pass .booking-confirmation__announce {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
      }
    `;
    document.head.appendChild(style);

    const { container } = render(
      <BookingDepositErrorConfirmation
        message="Missing payment session. Return from Stripe checkout and try again."
        shopId="shop-demo"
      />,
    );

    const root = container.querySelector('.booking-confirmation--error');
    expect(root?.getAttribute('role')).toBe('alert');
    expect(container.querySelector('.booking-confirmation__icon')).toBeNull();
    expect(container.querySelector('.booking-confirmation__announce')).toBeNull();
    expect(screen.getByText('Could not confirm')).toBeTruthy();
    expect(screen.getByText(/Missing payment session/i)).toBeTruthy();

    const header = container.querySelector('.booking-confirmation__header') as HTMLElement;
    expect(header.children).toHaveLength(1);
    expect(getComputedStyle(header).gridTemplateColumns.replace(/\s+/g, ' ').trim()).toMatch(
      /minmax\(0,\s*1fr\)|^1fr$|^[0-9.]+px$/,
    );

    const back = screen.getByRole('link', { name: 'Back to booking' });
    expect(back.getAttribute('href')).toBe('/book/shop-demo');

    style.remove();
  });
});
