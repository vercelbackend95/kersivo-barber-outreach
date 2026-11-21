/**
 * Retail (shop) payment mode: does the client pay online before the order is confirmed,
 * or reserve online and pay in the shop when collecting?
 *
 * - FULL_UPFRONT (default): Stripe Checkout on the shop's Connect account → PENDING_PAYMENT → PAID.
 * - PAY_AT_COLLECTION: no Stripe; the order is created as RESERVED_UNPAID with the client's
 *   contact details, and the shop marks it paid and collected at the counter.
 *
 * Sales only count an order once it is paid (paidAt set, status in RETAIL_PAID_ORDER_STATUSES).
 */

export const RETAIL_PAYMENT_MODES = ['FULL_UPFRONT', 'PAY_AT_COLLECTION'] as const;
export type RetailPaymentModeValue = (typeof RETAIL_PAYMENT_MODES)[number];

export const DEFAULT_RETAIL_PAYMENT_MODE: RetailPaymentModeValue = 'FULL_UPFRONT';

export type RetailOrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'READY_FOR_PICKUP'
  | 'COLLECTED'
  | 'RESERVED_UNPAID';

/** Orders whose money has been received (online or at the counter). Sales and spend use these. */
export const RETAIL_PAID_ORDER_STATUSES = ['PAID', 'READY_FOR_PICKUP', 'COLLECTED'] as const;

export function parseRetailPaymentMode(value: unknown): RetailPaymentModeValue | null {
  return typeof value === 'string' && (RETAIL_PAYMENT_MODES as readonly string[]).includes(value)
    ? (value as RetailPaymentModeValue)
    : null;
}

export function resolveRetailPaymentMode(value: unknown): RetailPaymentModeValue {
  return parseRetailPaymentMode(value) ?? DEFAULT_RETAIL_PAYMENT_MODE;
}

export function isUnpaidReservation(status: string): boolean {
  return status === 'RESERVED_UNPAID';
}

/** Statuses the shop can hand over at the counter (unpaid ones need payment taken first). */
export function isCollectableOrderStatus(status: string): boolean {
  return status === 'PAID' || status === 'READY_FOR_PICKUP' || status === 'RESERVED_UNPAID';
}

export const RESERVED_UNPAID_STATUS_LABEL = 'To collect · Pay in shop';

export const RETAIL_PAYMENT_MODE_OPTIONS: ReadonlyArray<{
  mode: RetailPaymentModeValue;
  label: string;
  description: string;
}> = [
  {
    mode: 'FULL_UPFRONT',
    label: 'Full payment upfront',
    description: 'Clients pay by card when they order. Stripe fees apply.',
  },
  {
    mode: 'PAY_AT_COLLECTION',
    label: 'Pay when collecting',
    description:
      'Clients reserve online and pay in the shop when they collect. Orders show as unpaid until you take payment.',
  },
];

export const RESERVATION_NAME_MAX = 120;
export const RESERVATION_EMAIL_MAX = 254;
export const RESERVATION_PHONE_MAX = 32;

export type ReservationContactInput = {
  customerName?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
};

export type ReservationContact = {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
};

export type ReservationContactResult =
  | { ok: true; contact: ReservationContact }
  | { ok: false; field: 'customerName' | 'customerEmail' | 'customerPhone'; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,}$/;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/** Validates the contact details a pay-at-collection reservation needs. Phone is optional. */
export function normalizeReservationContact(input: ReservationContactInput | null | undefined): ReservationContactResult {
  const customerName = text(input?.customerName);
  if (!customerName) {
    return { ok: false, field: 'customerName', error: 'Enter your name so the shop knows who is collecting.' };
  }
  if (customerName.length > RESERVATION_NAME_MAX) {
    return { ok: false, field: 'customerName', error: 'Name is too long.' };
  }

  const customerEmail = text(input?.customerEmail).toLowerCase();
  if (!customerEmail || customerEmail.length > RESERVATION_EMAIL_MAX || !EMAIL_PATTERN.test(customerEmail)) {
    return { ok: false, field: 'customerEmail', error: 'Enter a valid email address for your confirmation.' };
  }
  if (customerEmail.endsWith('@checkout.kersivo.local') || customerEmail.endsWith('@example.invalid')) {
    return { ok: false, field: 'customerEmail', error: 'Enter a valid email address for your confirmation.' };
  }

  const phone = text(input?.customerPhone);
  if (phone && (phone.length > RESERVATION_PHONE_MAX || !PHONE_PATTERN.test(phone))) {
    return { ok: false, field: 'customerPhone', error: 'Enter a valid phone number, or leave it blank.' };
  }

  return { ok: true, contact: { customerName, customerEmail, customerPhone: phone || null } };
}
