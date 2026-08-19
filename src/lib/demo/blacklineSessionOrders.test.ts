/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import {
  BLACKLINE_SESSION_ORDERS_KEY,
  BLACKLINE_RETAIL_JOURNEY_KEY,
  BLACKLINE_SESSION_ORDER_SOURCE,
  BLACKLINE_SESSION_ORDER_TAG,
  addBlacklineSessionOrder,
  buildBlacklineSessionOrder,
  collectBlacklineSessionOrder,
  completeBlacklineRetailJourney,
  getBlacklineRetailJourney,
  getBlacklineSessionOrder,
  isBlacklineSessionOrder,
  isPermittedBlacklineSessionOrderCollect,
  listBlacklineSessionOrders,
  mergeBlacklineSessionOrders,
  mergeBlacklineSessionSales,
  parseBlacklineSessionOrderCollectPath,
  saveBlacklineSessionOrder,
  startBlacklineRetailJourney,
  toAdminOrder,
  toAdminOrderDetail,
  toConfirmationSnapshot,
  toSalesContribution,
  type BlacklineAdminSalesResponse,
} from './blacklineSessionOrders';

const NOW = new Date('2026-08-18T12:00:00.000Z');

const IRONCLAD = {
  productId: 'bl-product-ironclad-pomade',
  name: 'Ironclad Pomade',
  unitPricePence: 1900,
  quantity: 1,
  lineTotalPence: 1900,
  imageUrl: '/demo/products/ironclad-pomade.webp',
};

function clearStore() {
  window.sessionStorage.removeItem(BLACKLINE_SESSION_ORDERS_KEY);
  window.sessionStorage.removeItem(BLACKLINE_RETAIL_JOURNEY_KEY);
}

function addIronclad(now = NOW) {
  return addBlacklineSessionOrder({
    items: [IRONCLAD],
    totalPence: 1900,
    now,
  });
}

const emptySales = (from = '2026-08-12', to = '2026-08-18'): BlacklineAdminSalesResponse => ({
  range: { from, to, tz: 'Europe/London' },
  kpis: {
    revenuePence: 5000,
    ordersCount: 2,
    avgOrderValuePence: 2500,
    bestProduct: {
      productId: 'bl-product-beard-balm',
      name: 'Beard Balm',
      revenuePence: 3200,
      units: 2,
    },
  },
  series: {
    overall: [
      { date: '2026-08-17', revenuePence: 2000, units: 1 },
      { date: '2026-08-18', revenuePence: 3000, units: 1 },
    ],
    products: [
      {
        productId: 'bl-product-ironclad-pomade',
        name: 'Ironclad Pomade',
        points: [
          { date: '2026-08-17', revenuePence: 0, units: 0 },
          { date: '2026-08-18', revenuePence: 1900, units: 1 },
        ],
      },
    ],
  },
  leaderboard: [
    { productId: 'bl-product-beard-balm', name: 'Beard Balm', units: 2, revenuePence: 3200 },
    { productId: 'bl-product-ironclad-pomade', name: 'Ironclad Pomade', units: 1, revenuePence: 1900 },
  ],
});

describe('blacklineSessionOrders', () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  it('serializes a paid session order with a stable id and visible reference', () => {
    const created = addIronclad();
    expect(created.source).toBe(BLACKLINE_SESSION_ORDER_SOURCE);
    expect(created.status).toBe('PAID');
    expect(created.collectedAt).toBeNull();
    expect(created.reference).toMatch(/^BL-\d{4}$/);
    expect(created.id).toMatch(/[0-9a-f-]{8,}/i);
    expect(created.totalPence).toBe(1900);
    expect(created.subtotalPence).toBe(1900);
    expect(created.currency).toBe('GBP');
    expect(created.items[0]?.name).toBe('Ironclad Pomade');
    expect(created.customerEmail).toContain('@blackline.demo');

    const stored = listBlacklineSessionOrders(NOW);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(created.id);
    expect(JSON.parse(window.sessionStorage.getItem(BLACKLINE_SESSION_ORDERS_KEY) ?? '[]')[0].id).toBe(
      created.id,
    );
  });

  it('recovers from malformed or expired storage without throwing', () => {
    window.sessionStorage.setItem(BLACKLINE_SESSION_ORDERS_KEY, '{not-json');
    expect(listBlacklineSessionOrders()).toEqual([]);

    window.sessionStorage.setItem(
      BLACKLINE_SESSION_ORDERS_KEY,
      JSON.stringify([{ id: 1, source: 'other' }, null, 'x']),
    );
    expect(listBlacklineSessionOrders()).toEqual([]);
    expect(isBlacklineSessionOrder({ id: 'x' })).toBe(false);
  });

  it('prunes stale demo orders and keeps an array of current ones', () => {
    const stale = buildBlacklineSessionOrder({
      items: [IRONCLAD],
      totalPence: 1900,
      now: new Date('2026-08-16T12:00:00.000Z'),
    });
    const fresh = buildBlacklineSessionOrder({
      items: [IRONCLAD],
      totalPence: 1900,
      now: NOW,
    });
    saveBlacklineSessionOrder(stale, new Date('2026-08-16T12:00:00.000Z'));
    saveBlacklineSessionOrder(fresh, NOW);

    const listed = listBlacklineSessionOrders(NOW);
    expect(listed.map((row) => row.id)).toEqual([fresh.id]);
  });

  it('keeps paid and fulfilment states separate', () => {
    const created = addIronclad();
    expect(created.status).toBe('PAID');
    expect(created.paidAt).toBe(created.createdAt);
    expect(created.collectedAt).toBeNull();

    const collected = collectBlacklineSessionOrder(created.id, new Date('2026-08-18T13:00:00.000Z'));
    expect(collected?.status).toBe('COLLECTED');
    expect(collected?.paidAt).toBe(created.paidAt);
    expect(collected?.collectedAt).toBe('2026-08-18T13:00:00.000Z');
    expect(collected?.totalPence).toBe(1900);
  });

  it('permits collection only for the session order and is idempotent', () => {
    const created = addIronclad();
    const first = collectBlacklineSessionOrder(created.id, new Date('2026-08-18T13:00:00.000Z'));
    const second = collectBlacklineSessionOrder(created.id, new Date('2026-08-18T14:00:00.000Z'));
    expect(second?.collectedAt).toBe(first?.collectedAt);
    expect(listBlacklineSessionOrders(NOW).filter((row) => row.id === created.id)).toHaveLength(1);

    expect(collectBlacklineSessionOrder('seeded-BL-id', NOW)).toBeNull();
  });

  it('derives the Sales contribution from the same record', () => {
    const created = addIronclad();
    const sale = toSalesContribution(created);
    expect(sale.orderId).toBe(created.id);
    expect(sale.reference).toBe(created.reference);
    expect(sale.totalPence).toBe(1900);
    expect(sale.items[0]?.productId).toBe('bl-product-ironclad-pomade');
    expect(toAdminOrder(created).orderNumber).toBe(created.reference);
    expect(toAdminOrderDetail(created).items[0]?.nameSnapshot).toBe('Ironclad Pomade');
    expect(toConfirmationSnapshot(created).orderId).toBe(created.id);
  });

  it('merges session orders into seeded Orders without duplicating by id', () => {
    const created = addIronclad();
    const seeded = [{ id: 'BL-seed-1' }];
    const first = mergeBlacklineSessionOrders(seeded, NOW);
    expect(first[0]?.id).toBe(created.id);
    const second = mergeBlacklineSessionOrders(first, NOW);
    expect(second.filter((row) => row.id === created.id)).toHaveLength(1);
    expect(toAdminOrder(created).customerName).toBeTruthy();
  });

  it('merges paid session revenue into Sales once, including after collection', () => {
    const created = addIronclad();
    const paidDay = formatInTimeZone(new Date(created.paidAt), 'Europe/London', 'yyyy-MM-dd');
    const seeded = emptySales('2026-08-12', paidDay);
    const mergedPaid = mergeBlacklineSessionSales(seeded, NOW);
    expect(mergedPaid.kpis.ordersCount).toBe(3);
    expect(mergedPaid.kpis.revenuePence).toBe(6900);
    expect(mergedPaid.kpis.avgOrderValuePence).toBe(2300);

    const ironclad = mergedPaid.leaderboard.find((row) => row.productId === 'bl-product-ironclad-pomade');
    expect(ironclad?.units).toBe(2);
    expect(ironclad?.revenuePence).toBe(3800);

    collectBlacklineSessionOrder(created.id, new Date('2026-08-18T13:00:00.000Z'));
    const mergedCollected = mergeBlacklineSessionSales(seeded, NOW);
    expect(mergedCollected.kpis.revenuePence).toBe(mergedPaid.kpis.revenuePence);
    expect(mergedCollected.kpis.ordersCount).toBe(mergedPaid.kpis.ordersCount);
  });

  it('same-tab refresh still reads the stored order', () => {
    const created = addIronclad();
    expect(getBlacklineSessionOrder(created.id, NOW)?.reference).toBe(created.reference);
    expect(listBlacklineSessionOrders(NOW)).toHaveLength(1);
  });

  it('starts a collect-stage retail journey with the created order', () => {
    const created = addIronclad();
    expect(getBlacklineRetailJourney(NOW)).toEqual({ orderId: created.id, stage: 'collect' });
    collectBlacklineSessionOrder(created.id, NOW);
    expect(getBlacklineRetailJourney(NOW)?.stage).toBe('view_sale');
    completeBlacklineRetailJourney(created.id);
    expect(getBlacklineRetailJourney(NOW)?.stage).toBe('complete');
    startBlacklineRetailJourney(created.id);
    expect(getBlacklineRetailJourney(NOW)?.stage).toBe('collect');
  });

  it('scopes the collect exception to BLACKLINE session orders only', () => {
    const created = addIronclad();
    const collectPath = `/api/admin/shop/orders/${created.id}/collect`;
    expect(parseBlacklineSessionOrderCollectPath(collectPath, 'POST')).toBe(created.id);
    expect(isPermittedBlacklineSessionOrderCollect(collectPath, 'POST', '/demo/admin', NOW)).toBe(true);
    expect(isPermittedBlacklineSessionOrderCollect(collectPath, 'POST', '/admin-demo', NOW)).toBe(false);
    expect(
      isPermittedBlacklineSessionOrderCollect(
        '/api/admin/shop/orders/BL-seed/collect',
        'POST',
        '/demo/admin',
        NOW,
      ),
    ).toBe(false);
    expect(
      isPermittedBlacklineSessionOrderCollect(
        `/api/admin/shop/orders/${created.id}`,
        'PATCH',
        '/demo/admin',
        NOW,
      ),
    ).toBe(false);
    expect(BLACKLINE_SESSION_ORDER_TAG).toBe('YOUR DEMO ORDER');
  });
});
