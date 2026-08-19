import { formatInTimeZone } from 'date-fns-tz';
import { isBlacklineAdminDemoPathname } from '@/lib/admin/demoConfig';
import {
  createCollisionResistantId,
  makeBlacklineDemoReference,
} from '@/lib/demo/blacklineSessionBookings';

export const BLACKLINE_SESSION_ORDERS_KEY = 'kersivo.blackline.session-orders.v1';
export const BLACKLINE_RETAIL_JOURNEY_KEY = 'kersivo.blackline.retail-journey.v1';
export const BLACKLINE_SESSION_ORDER_SOURCE = 'blackline-demo-session' as const;
export const BLACKLINE_SESSION_ORDER_TAG = 'YOUR DEMO ORDER';
export const BLACKLINE_SESSION_SALE_TAG = 'YOUR DEMO SALE';
export const BLACKLINE_SESSION_ORDER_TTL_MS = 24 * 60 * 60 * 1000;
export const BLACKLINE_SESSION_ORDER_CUSTOMER_NAME = 'Demo customer';
export const BLACKLINE_SESSION_ORDER_CUSTOMER_EMAIL = 'demo.customer@blackline.demo';
export const BLACKLINE_SESSION_ORDER_COLLECT_RE = /^\/api\/admin\/shop\/orders\/([^/]+)\/collect$/;

const REFERENCE_RE = /^[A-Z]{2}-\d{4}$/;
const BLACKLINE_TZ = 'Europe/London';

export type BlacklineSessionOrderStatus = 'PAID' | 'COLLECTED';

export type BlacklineSessionOrderItem = {
  id: string;
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
  lineTotalPence: number;
  imageUrl: string;
};

export type BlacklineSessionOrder = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  items: BlacklineSessionOrderItem[];
  subtotalPence: number;
  totalPence: number;
  currency: 'GBP';
  status: BlacklineSessionOrderStatus;
  collectionMethod: 'Collect in shop';
  createdAt: string;
  paidAt: string;
  collectedAt: string | null;
  source: typeof BLACKLINE_SESSION_ORDER_SOURCE;
};

export type BlacklineSessionOrderInput = {
  items: Array<{
    productId: string;
    name: string;
    unitPricePence: number;
    quantity: number;
    lineTotalPence: number;
    imageUrl?: string;
  }>;
  totalPence: number;
  createdAt?: string;
  customerName?: string;
  customerEmail?: string;
  referencePrefix?: string;
  now?: Date;
};

export type BlacklineAdminOrderListItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: BlacklineSessionOrderStatus;
  totalPence: number;
  currency: 'GBP';
  createdAt: string;
  paidAt: string;
  isTestOrder: false;
  _count: { items: number };
};

export type BlacklineAdminOrderDetail = BlacklineAdminOrderListItem & {
  collectedAt: string | null;
  items: Array<{
    id: string;
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
};

export type BlacklineAdminSalesResponse = {
  range: { from: string; to: string; tz: string };
  kpis: {
    revenuePence: number;
    ordersCount: number;
    avgOrderValuePence: number;
    bestProduct?: { productId: string; name: string; revenuePence: number; units: number };
  };
  previousKpis?: BlacklineAdminSalesResponse['kpis'] | null;
  series: {
    overall?: Array<{ date: string; revenuePence: number; units: number }>;
    products?: Array<{
      productId: string;
      name: string;
      points: Array<{ date: string; revenuePence: number; units: number }>;
    }>;
  };
  leaderboard: Array<{ productId: string; name: string; units: number; revenuePence: number }>;
};

export type BlacklineRetailJourneyStage = 'collect' | 'view_sale' | 'complete';

export type BlacklineRetailJourney = {
  orderId: string;
  stage: BlacklineRetailJourneyStage;
};

export type BlacklineConfirmationSnapshot = {
  orderId: string;
  reference: string;
  items: BlacklineSessionOrderItem[];
  totalPence: number;
  collectionMethod: 'Collect in shop';
  createdAt: string;
};

function getSessionStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return null;
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isSessionOrderItem(value: unknown): value is BlacklineSessionOrderItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    isNonEmptyString(row.id) &&
    isNonEmptyString(row.productId) &&
    isNonEmptyString(row.name) &&
    isNonNegativeInt(row.unitPricePence) &&
    isPositiveInt(row.quantity) &&
    isNonNegativeInt(row.lineTotalPence) &&
    typeof row.imageUrl === 'string'
  );
}

export function isBlacklineSessionOrder(value: unknown): value is BlacklineSessionOrder {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (!isNonEmptyString(row.id)) return false;
  if (typeof row.reference !== 'string' || !REFERENCE_RE.test(row.reference)) return false;
  if (!isNonEmptyString(row.customerName) || !isNonEmptyString(row.customerEmail)) return false;
  if (!Array.isArray(row.items) || row.items.length === 0 || !row.items.every(isSessionOrderItem)) {
    return false;
  }
  if (!isNonNegativeInt(row.subtotalPence) || !isNonNegativeInt(row.totalPence)) return false;
  if (row.currency !== 'GBP') return false;
  if (row.status !== 'PAID' && row.status !== 'COLLECTED') return false;
  if (row.collectionMethod !== 'Collect in shop') return false;
  if (!isNonEmptyString(row.createdAt) || !isNonEmptyString(row.paidAt)) return false;
  if (row.collectedAt != null && typeof row.collectedAt !== 'string') return false;
  if (row.status === 'COLLECTED' && !isNonEmptyString(row.collectedAt)) return false;
  if (row.source !== BLACKLINE_SESSION_ORDER_SOURCE) return false;
  return true;
}

function isFresh(row: BlacklineSessionOrder, nowMs: number): boolean {
  const createdMs = Date.parse(row.createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs <= BLACKLINE_SESSION_ORDER_TTL_MS;
}

function readRawList(): unknown[] {
  const storage = getSessionStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(BLACKLINE_SESSION_ORDERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(rows: BlacklineSessionOrder[]): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(BLACKLINE_SESSION_ORDERS_KEY, JSON.stringify(rows));
  } catch {
    // Quota or private-mode — ignore; the in-memory caller still has the record.
  }
}

function persistValidated(now = new Date()): BlacklineSessionOrder[] {
  const nowMs = now.getTime();
  const incoming = readRawList();
  const valid = incoming.filter(isBlacklineSessionOrder).filter((row) => isFresh(row, nowMs));
  if (valid.length !== incoming.length) writeList(valid);
  return valid;
}

export function listBlacklineSessionOrders(now = new Date()): BlacklineSessionOrder[] {
  return persistValidated(now);
}

export function getBlacklineSessionOrder(id: string, now = new Date()): BlacklineSessionOrder | null {
  return persistValidated(now).find((row) => row.id === id) ?? null;
}

export function isBlacklineSessionOrderId(id: string, now = new Date()): boolean {
  return getBlacklineSessionOrder(id, now) != null;
}

export function buildBlacklineSessionOrder(input: BlacklineSessionOrderInput): BlacklineSessionOrder {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Invalid BLACKLINE session order items.');
  }
  if (!Number.isInteger(input.totalPence) || input.totalPence < 0) {
    throw new Error('Invalid BLACKLINE session order total.');
  }

  const now = input.now ?? new Date();
  const createdAt = input.createdAt ?? now.toISOString();
  const prefix = (input.referencePrefix ?? 'BL').replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase() || 'BL';
  const items = input.items.map((item, index) => ({
    id: `bl-session-item-${index + 1}`,
    productId: item.productId,
    name: item.name,
    unitPricePence: item.unitPricePence,
    quantity: item.quantity,
    lineTotalPence: item.lineTotalPence,
    imageUrl: item.imageUrl ?? '',
  }));
  const subtotalPence = items.reduce((sum, item) => sum + item.lineTotalPence, 0);

  return {
    id: createCollisionResistantId(),
    reference: makeBlacklineDemoReference(prefix),
    customerName: (input.customerName ?? BLACKLINE_SESSION_ORDER_CUSTOMER_NAME).trim() || BLACKLINE_SESSION_ORDER_CUSTOMER_NAME,
    customerEmail: (input.customerEmail ?? BLACKLINE_SESSION_ORDER_CUSTOMER_EMAIL).trim() || BLACKLINE_SESSION_ORDER_CUSTOMER_EMAIL,
    items,
    subtotalPence,
    totalPence: input.totalPence,
    currency: 'GBP',
    status: 'PAID',
    collectionMethod: 'Collect in shop',
    createdAt,
    paidAt: createdAt,
    collectedAt: null,
    source: BLACKLINE_SESSION_ORDER_SOURCE,
  };
}

export function saveBlacklineSessionOrder(
  order: BlacklineSessionOrder,
  now = new Date(),
): BlacklineSessionOrder {
  if (!isBlacklineSessionOrder(order)) {
    throw new Error('Refusing to persist a malformed BLACKLINE session order.');
  }
  const existing = persistValidated(now).filter((row) => row.id !== order.id);
  writeList([...existing, order]);
  return order;
}

export function addBlacklineSessionOrder(input: BlacklineSessionOrderInput): BlacklineSessionOrder {
  const created = saveBlacklineSessionOrder(buildBlacklineSessionOrder(input), input.now);
  startBlacklineRetailJourney(created.id);
  return created;
}

export function collectBlacklineSessionOrder(
  id: string,
  now = new Date(),
): BlacklineSessionOrder | null {
  const existing = getBlacklineSessionOrder(id, now);
  if (!existing) return null;
  if (existing.status === 'COLLECTED' && existing.collectedAt) {
    setBlacklineRetailJourneyStage(existing.id, 'view_sale');
    return existing;
  }
  const collected: BlacklineSessionOrder = {
    ...existing,
    status: 'COLLECTED',
    collectedAt: now.toISOString(),
  };
  saveBlacklineSessionOrder(collected, now);
  setBlacklineRetailJourneyStage(collected.id, 'view_sale');
  return collected;
}

export function toAdminOrder(row: BlacklineSessionOrder): BlacklineAdminOrderListItem {
  return {
    id: row.id,
    orderNumber: row.reference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    status: row.status,
    totalPence: row.totalPence,
    currency: row.currency,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    isTestOrder: false,
    _count: { items: row.items.length },
  };
}

export function toAdminOrderDetail(row: BlacklineSessionOrder): BlacklineAdminOrderDetail {
  return {
    ...toAdminOrder(row),
    collectedAt: row.collectedAt,
    items: row.items.map((item) => ({
      id: item.id,
      nameSnapshot: item.name,
      unitPricePenceSnapshot: item.unitPricePence,
      quantity: item.quantity,
      lineTotalPence: item.lineTotalPence,
    })),
  };
}

export function toConfirmationSnapshot(row: BlacklineSessionOrder): BlacklineConfirmationSnapshot {
  return {
    orderId: row.id,
    reference: row.reference,
    items: row.items,
    totalPence: row.totalPence,
    collectionMethod: row.collectionMethod,
    createdAt: row.createdAt,
  };
}

export function toSalesContribution(row: BlacklineSessionOrder): {
  orderId: string;
  reference: string;
  paidAt: string;
  totalPence: number;
  items: Array<{ productId: string; name: string; units: number; revenuePence: number }>;
} {
  return {
    orderId: row.id,
    reference: row.reference,
    paidAt: row.paidAt,
    totalPence: row.totalPence,
    items: row.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      units: item.quantity,
      revenuePence: item.lineTotalPence,
    })),
  };
}

function londonDayKey(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return formatInTimeZone(new Date(ms), BLACKLINE_TZ, 'yyyy-MM-dd');
}

function ymdInRange(ymd: string, fromYmd: string, toYmd: string): boolean {
  return ymd >= fromYmd && ymd <= toYmd;
}

export function mergeBlacklineSessionOrders<T extends { id?: string }>(
  seeded: readonly T[],
  now = new Date(),
): Array<T | BlacklineAdminOrderListItem> {
  const extras = persistValidated(now)
    .filter((row) => !seeded.some((entry) => entry.id === row.id))
    .map(toAdminOrder)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (extras.length === 0) return [...seeded];
  return [...extras, ...seeded];
}

export function mergeBlacklineSessionSales(
  seeded: BlacklineAdminSalesResponse,
  now = new Date(),
): BlacklineAdminSalesResponse {
  const fromYmd = seeded.range.from;
  const toYmd = seeded.range.to;
  const extras = persistValidated(now).filter((row) => {
    if (row.status !== 'PAID' && row.status !== 'COLLECTED') return false;
    const ymd = londonDayKey(row.paidAt);
    return ymd != null && ymdInRange(ymd, fromYmd, toYmd);
  });

  if (extras.length === 0) return seeded;

  const extraRevenue = extras.reduce((sum, row) => sum + row.totalPence, 0);
  const ordersCount = seeded.kpis.ordersCount + extras.length;
  const revenuePence = seeded.kpis.revenuePence + extraRevenue;
  const avgOrderValuePence = ordersCount > 0 ? Math.round(revenuePence / ordersCount) : 0;

  const leaderboard = seeded.leaderboard.map((row) => ({ ...row }));
  for (const order of extras) {
    for (const item of order.items) {
      const existing = leaderboard.find((row) => row.productId === item.productId || row.name === item.name);
      if (existing) {
        existing.units += item.quantity;
        existing.revenuePence += item.lineTotalPence;
      } else {
        leaderboard.push({
          productId: item.productId,
          name: item.name,
          units: item.quantity,
          revenuePence: item.lineTotalPence,
        });
      }
    }
  }
  leaderboard.sort((a, b) => b.revenuePence - a.revenuePence || b.units - a.units);

  const overall = (seeded.series.overall ?? []).map((point) => ({ ...point }));
  const products = (seeded.series.products ?? []).map((series) => ({
    ...series,
    points: series.points.map((point) => ({ ...point })),
  }));

  for (const order of extras) {
    const ymd = londonDayKey(order.paidAt);
    if (!ymd) continue;
    const dayUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const overallPoint = overall.find((point) => point.date === ymd);
    if (overallPoint) {
      overallPoint.revenuePence += order.totalPence;
      overallPoint.units += dayUnits;
    } else {
      overall.push({ date: ymd, revenuePence: order.totalPence, units: dayUnits });
    }
    for (const item of order.items) {
      const series = products.find((row) => row.productId === item.productId || row.name === item.name);
      if (!series) continue;
      const point = series.points.find((entry) => entry.date === ymd);
      if (point) {
        point.revenuePence += item.lineTotalPence;
        point.units += item.quantity;
      }
    }
  }

  const best = leaderboard[0] ?? null;

  return {
    ...seeded,
    kpis: {
      revenuePence,
      ordersCount,
      avgOrderValuePence,
      bestProduct: best
        ? {
            productId: best.productId,
            name: best.name,
            revenuePence: best.revenuePence,
            units: best.units,
          }
        : seeded.kpis.bestProduct,
    },
    series: {
      overall,
      products,
    },
    leaderboard,
  };
}

function isRetailJourney(value: unknown): value is BlacklineRetailJourney {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    isNonEmptyString(row.orderId) &&
    (row.stage === 'collect' || row.stage === 'view_sale' || row.stage === 'complete')
  );
}

export function getBlacklineRetailJourney(now = new Date()): BlacklineRetailJourney | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(BLACKLINE_RETAIL_JOURNEY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRetailJourney(parsed)) return null;
    if (!isBlacklineSessionOrderId(parsed.orderId, now)) {
      storage.removeItem(BLACKLINE_RETAIL_JOURNEY_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRetailJourney(journey: BlacklineRetailJourney): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(BLACKLINE_RETAIL_JOURNEY_KEY, JSON.stringify(journey));
  } catch {
    // ignore
  }
}

export function startBlacklineRetailJourney(orderId: string): BlacklineRetailJourney {
  const journey: BlacklineRetailJourney = { orderId, stage: 'collect' };
  writeRetailJourney(journey);
  return journey;
}

export function setBlacklineRetailJourneyStage(
  orderId: string,
  stage: BlacklineRetailJourneyStage,
): BlacklineRetailJourney | null {
  const current = getBlacklineRetailJourney();
  if (current && current.orderId !== orderId) return current;
  const journey: BlacklineRetailJourney = { orderId, stage };
  writeRetailJourney(journey);
  return journey;
}

export function completeBlacklineRetailJourney(orderId?: string): void {
  const current = getBlacklineRetailJourney();
  if (!current) return;
  if (orderId && current.orderId !== orderId) return;
  writeRetailJourney({ ...current, stage: 'complete' });
}

export function parseBlacklineSessionOrderCollectPath(
  pathname: string | null,
  method: string,
): string | null {
  if (method.toUpperCase() !== 'POST' || !pathname) return null;
  const match = pathname.match(BLACKLINE_SESSION_ORDER_COLLECT_RE);
  return match?.[1] ?? null;
}

export function isPermittedBlacklineSessionOrderCollect(
  pathname: string | null,
  method: string,
  locationPathname?: string,
  now = new Date(),
): boolean {
  const pagePath =
    locationPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  if (!isBlacklineAdminDemoPathname(pagePath)) return false;
  const orderId = parseBlacklineSessionOrderCollectPath(pathname, method);
  if (!orderId) return false;
  return isBlacklineSessionOrderId(orderId, now);
}
