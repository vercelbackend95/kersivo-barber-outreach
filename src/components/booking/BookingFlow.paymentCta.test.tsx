import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bookingPaymentSubmitLabel, depositSubmitLabel } from './BookingFlow';

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

  it('final CTA uses the shop payment mode and selected service price instead of a hard-coded £5', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'BookingFlow.tsx'), 'utf8');
    expect(source).toContain('bookingPaymentSubmitLabel(effectiveBookingPaymentMode, selectedService.pricePence)');
    expect(source).not.toContain("return 'Pay £5 deposit & book'");
  });
});

describe('BookingFlow CTA per booking payment mode (Phase 4C)', () => {
  it('NONE → no payment label ("Confirm booking")', () => {
    expect(bookingPaymentSubmitLabel('NONE', 3000)).toBeNull();
  });

  it('DEPOSIT £30 → "Pay £5 deposit & book"; DEPOSIT £3 → "Pay £3 & book"', () => {
    expect(bookingPaymentSubmitLabel('DEPOSIT', 3000)).toBe('Pay £5 deposit & book');
    expect(bookingPaymentSubmitLabel('DEPOSIT', 300)).toBe('Pay £3 & book');
  });

  it('4C-O: FULL £30 → "Pay £30 & book"; FULL £3 → "Pay £3 & book"', () => {
    expect(bookingPaymentSubmitLabel('FULL', 3000)).toBe('Pay £30 & book');
    expect(bookingPaymentSubmitLabel('FULL', 300)).toBe('Pay £3 & book');
    expect(bookingPaymentSubmitLabel('FULL', 1250)).toBe('Pay £12.50 & book');
  });

  it('£0 service → no payment label in every mode', () => {
    for (const mode of ['NONE', 'DEPOSIT', 'FULL'] as const) {
      expect(bookingPaymentSubmitLabel(mode, 0)).toBeNull();
    }
  });
});

describe('book/[shopId].astro payment intent (static)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(join(here, '../../pages/book/[shopId].astro'), 'utf8');

  it('v1.19: Starter public booking UI derives the fixed policy from product entitlement', () => {
    expect(page).toContain('loadKersivoAccess(shopId)');
    expect(page).toContain("productAccess.state === 'FREE_BOOKING'");
    expect(page).toContain('starterPaymentPolicy={starterPaymentPolicy}');
    expect(page).toContain("const bookingPaymentMode = shop.bookingPaymentMode ?? 'NONE';");
  });
});

describe('BarbershopSettingsPanel booking payment choices (static)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const panel = readFileSync(join(here, '../admin/BarbershopSettingsPanel.tsx'), 'utf8');

  it('v1.19: Full keeps editable choices while Starter shows a fixed read-only payment policy', () => {
    expect(panel).toContain("{ mode: 'NONE', label: 'Pay at shop' }");
    expect(panel).toContain("{ mode: 'DEPOSIT', label: 'Require £5 deposit' }");
    expect(panel).toContain("{ mode: 'FULL', label: 'Require full payment upfront' }");
    expect(panel).toContain('paymentControlsEditable ?');
    expect(panel).toContain('Starter payment setup');
    expect(panel).toContain('£5 online payment required');
    expect(panel).toContain('Public Pay at shop unavailable');
    expect(panel).toContain('Unlock payment controls — £39/month');
  });
});


describe('BookingFlow v1.19 Starter payment choice (static)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, 'BookingFlow.tsx'), 'utf8');

  it('renders one £5 full-payment option for an exactly £5 service', () => {
    expect(source).toContain("selectedService.pricePence === 500");
    expect(source).toContain('Pay £5 now');
    expect(source).toContain('This pays the service in full.');
  });

  it('offers £5 deposit or Pay in full above £5 and sends the choice to the API', () => {
    expect(source).toContain('Pay £5 deposit');
    expect(source).toContain('Pay in full');
    expect(source).toContain('paymentChoice: effectiveStarterPaymentChoice');
    expect(source).toContain('0% KERSIVO commission. Stripe processing fees apply.');
  });
});
