import type { OrderStatus } from '@prisma/client';
import { toUtcFromLondon } from '../../src/lib/booking/time';

export const LONDON_TZ = 'Europe/London';
export const DEMO_SHOP_ID = 'demo-shop';

export const DEMO_CUSTOMER_EMAILS = [
  'oliver.reed@example.com',
  'amelia.clarke@example.com',
  'noah.bennett@example.com',
  'isla.morgan@example.com',
  'leo.carter@example.com',
  'maya.brooks@example.com',
  'theo.hughes@example.com',
  'grace.turner@example.com'
];

export type ProductRow = { id: string; name: string; pricePence: number };

export type OrderLineDraft = {
  productId: string;
  nameSnapshot: string;
  unitPricePenceSnapshot: number;
  quantity: number;
  lineTotalPence: number;
};

export type OrderDraft = {
  customerEmail: string;
  status: OrderStatus;
  paidAt: Date;
  items: OrderLineDraft[];
  totalPence: number;
};

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function listLondonDays(windowDays: number): string[] {
  const days: string[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    days.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: LONDON_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date)
    );
  }
  return days;
}

export function toLine(product: ProductRow, quantity: number): OrderLineDraft {
  return {
    productId: product.id,
    nameSnapshot: product.name,
    unitPricePenceSnapshot: product.pricePence,
    quantity,
    lineTotalPence: product.pricePence * quantity
  };
}

export function createSingleProductOrder(
  product: ProductRow,
  dayYmd: string,
  customerEmail: string,
  quantity = 1
): OrderDraft {
  const hour = randomInt(9, 18);
  const minute = randomInt(0, 5) * 10;
  const paidAt = toUtcFromLondon(dayYmd, hour * 60 + minute);
  const items = [toLine(product, quantity)];
  const totalPence = product.pricePence * quantity;
  const status: OrderStatus = Math.random() < 0.15 ? 'COLLECTED' : 'PAID';

  return {
    customerEmail,
    status,
    paidAt,
    items,
    totalPence
  };
}
