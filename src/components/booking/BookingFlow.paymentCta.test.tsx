import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { depositSubmitLabel } from './BookingFlow';

describe('BookingFlow deposit CTA matches the amount actually charged', () => {
  it('R: £30 DEPOSIT service → "Pay £5 deposit & book"', () => {
    expect(depositSubmitLabel(3000)).toBe('Pay £5 deposit & book');
  });

  it('S: £3 DEPOSIT service → "Pay £3 & book" (full price, not a deposit)', () => {
    expect(depositSubmitLabel(300)).toBe('Pay £3 & book');
    expect(depositSubmitLabel(250)).toBe('Pay £2.50 & book');
    expect(depositSubmitLabel(500)).toBe('Pay £5 & book');
  });

  it('T: £0 service → no payment label (falls back to "Confirm booking")', () => {
    expect(depositSubmitLabel(0)).toBeNull();
  });

  it('final CTA uses the selected service price instead of a hard-coded £5', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'BookingFlow.tsx'), 'utf8');
    expect(source).toContain('depositSubmitLabel(selectedService.pricePence)');
    expect(source).not.toContain("return 'Pay £5 deposit & book'");
  });
});

describe('book/[shopId].astro deposit intent (static)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(join(here, '../../pages/book/[shopId].astro'), 'utf8');

  it('U: DEPOSIT intent follows bookingPaymentMode, not current Stripe readiness', () => {
    expect(page).toContain("const depositRequired = shop.bookingPaymentMode === 'DEPOSIT';");
    expect(page).not.toContain('shopRequiresOnlineDeposit');
    expect(page).not.toContain('stripeConnectChargesEnabled');
  });
});
