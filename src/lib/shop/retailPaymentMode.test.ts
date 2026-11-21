import { describe, expect, it } from 'vitest';
import {
  RETAIL_PAID_ORDER_STATUSES,
  isCollectableOrderStatus,
  isUnpaidReservation,
  normalizeReservationContact,
  parseRetailPaymentMode,
  resolveRetailPaymentMode,
} from './retailPaymentMode';

describe('retail payment mode', () => {
  it('parses only the two known modes and defaults to full payment upfront', () => {
    expect(parseRetailPaymentMode('PAY_AT_COLLECTION')).toBe('PAY_AT_COLLECTION');
    expect(parseRetailPaymentMode('FULL_UPFRONT')).toBe('FULL_UPFRONT');
    expect(parseRetailPaymentMode('pay_at_collection')).toBeNull();
    expect(parseRetailPaymentMode(undefined)).toBeNull();
    expect(resolveRetailPaymentMode(null)).toBe('FULL_UPFRONT');
  });

  it('never counts an unpaid reservation as paid revenue', () => {
    expect(RETAIL_PAID_ORDER_STATUSES).not.toContain('RESERVED_UNPAID');
    expect(RETAIL_PAID_ORDER_STATUSES).not.toContain('PENDING_PAYMENT');
    expect(isUnpaidReservation('RESERVED_UNPAID')).toBe(true);
    expect(isUnpaidReservation('PAID')).toBe(false);
  });

  it('lets the counter collect paid and reserved orders, never abandoned checkouts', () => {
    expect(isCollectableOrderStatus('PAID')).toBe(true);
    expect(isCollectableOrderStatus('READY_FOR_PICKUP')).toBe(true);
    expect(isCollectableOrderStatus('RESERVED_UNPAID')).toBe(true);
    expect(isCollectableOrderStatus('PENDING_PAYMENT')).toBe(false);
    expect(isCollectableOrderStatus('COLLECTED')).toBe(false);
  });
});

describe('normalizeReservationContact', () => {
  it('trims, collapses spaces and lower-cases the email', () => {
    expect(
      normalizeReservationContact({
        customerName: '  Sam   Client ',
        customerEmail: ' Sam@Example.COM ',
        customerPhone: ' +44 7700 900123 ',
      }),
    ).toEqual({
      ok: true,
      contact: {
        customerName: 'Sam Client',
        customerEmail: 'sam@example.com',
        customerPhone: '+44 7700 900123',
      },
    });
  });

  it('treats phone as optional', () => {
    const result = normalizeReservationContact({ customerName: 'Sam', customerEmail: 'sam@example.com' });
    expect(result).toEqual({
      ok: true,
      contact: { customerName: 'Sam', customerEmail: 'sam@example.com', customerPhone: null },
    });
  });

  it.each([
    [{}, 'customerName'],
    [{ customerName: 'Sam' }, 'customerEmail'],
    [{ customerName: 'Sam', customerEmail: 'sam@' }, 'customerEmail'],
    [{ customerName: 'Sam', customerEmail: 'pending@checkout.kersivo.local' }, 'customerEmail'],
    [{ customerName: 'Sam', customerEmail: 'sam@example.com', customerPhone: 'call me' }, 'customerPhone'],
    [{ customerName: 'x'.repeat(121), customerEmail: 'sam@example.com' }, 'customerName'],
  ])('rejects %j on %s', (input, field) => {
    const result = normalizeReservationContact(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe(field);
  });
});
