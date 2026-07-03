import { formatInTimeZone } from 'date-fns-tz';
import { DEMO_ORDER_IDS, DEMO_PRODUCT_IDS } from './ids';

const now = new Date().toISOString();
const TZ = 'Europe/London';

export const demoShopProductsResponse = {
  products: [
    {
      id: DEMO_PRODUCT_IDS.pomade,
      name: 'Matte Pomade',
      description: 'Medium hold, natural finish.',
      pricePence: 1800,
      imageUrl: null,
      active: true,
      featured: true,
      category: 'POMADES_AND_CLAYS',
      sortOrder: 0,
      updatedAt: now,
    },
    {
      id: DEMO_PRODUCT_IDS.beardOil,
      name: 'Beard Oil',
      description: 'Cedarwood & sandalwood blend.',
      pricePence: 2200,
      imageUrl: null,
      active: true,
      featured: false,
      category: 'BEARD_CARE',
      sortOrder: 1,
      updatedAt: now,
    },
    {
      id: DEMO_PRODUCT_IDS.clay,
      name: 'Styling Clay',
      description: 'Strong hold, matte texture.',
      pricePence: 1600,
      imageUrl: null,
      active: true,
      featured: false,
      category: 'STYLING',
      sortOrder: 2,
      updatedAt: now,
    },
  ],
};

export function getDemoShopProductDetail(productId: string) {
  const product = demoShopProductsResponse.products.find((p) => p.id === productId);
  if (!product) return null;
  return { product };
}

export const demoShopOrdersResponse = {
  orders: [
    {
      id: DEMO_ORDER_IDS.order1,
      customerEmail: 'oliver.reed@example.com',
      status: 'PAID',
      totalPence: 4000,
      currency: 'GBP',
      createdAt: now,
      paidAt: now,
      _count: { items: 2 },
    },
    {
      id: DEMO_ORDER_IDS.order2,
      customerEmail: 'amelia.clarke@example.com',
      status: 'COLLECTED',
      totalPence: 1600,
      currency: 'GBP',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      _count: { items: 1 },
    },
  ],
  hasMore: false,
};

export function getDemoShopOrderDetail(orderId: string) {
  const listItem = demoShopOrdersResponse.orders.find((o) => o.id === orderId);
  if (!listItem) return null;

  const items = orderId === DEMO_ORDER_IDS.order1
    ? [
        { id: 'demo-item-01', nameSnapshot: 'Matte Pomade', unitPricePenceSnapshot: 1800, quantity: 1, lineTotalPence: 1800 },
        { id: 'demo-item-02', nameSnapshot: 'Beard Oil', unitPricePenceSnapshot: 2200, quantity: 1, lineTotalPence: 2200 },
      ]
    : [
        { id: 'demo-item-03', nameSnapshot: 'Styling Clay', unitPricePenceSnapshot: 1600, quantity: 1, lineTotalPence: 1600 },
      ];

  return {
    order: {
      ...listItem,
      collectedAt: listItem.status === 'COLLECTED' ? listItem.paidAt : null,
      items,
    },
  };
}

function ymdDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatInTimeZone(d, TZ, 'yyyy-MM-dd');
}

export function getDemoShopSalesResponse(searchParams: URLSearchParams) {
  const todayYmd = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const fromYmd = searchParams.get('from') ?? ymdDaysAgo(29);
  const toYmd = searchParams.get('to') ?? todayYmd;

  const dayCount = 7;
  const overall = Array.from({ length: dayCount }, (_, i) => ({
    date: ymdDaysAgo(dayCount - 1 - i),
    revenuePence: 2800 + i * 420,
    units: 2 + (i % 3),
  }));

  return {
    range: { from: fromYmd, to: toYmd, tz: TZ },
    kpis: {
      revenuePence: 28400,
      ordersCount: 18,
      avgOrderValuePence: 1578,
      bestProduct: {
        productId: DEMO_PRODUCT_IDS.pomade,
        name: 'Matte Pomade',
        revenuePence: 21600,
        units: 12,
      },
    },
    series: {
      overall,
      products: [
        {
          productId: DEMO_PRODUCT_IDS.pomade,
          name: 'Matte Pomade',
          points: overall.map((p) => ({ ...p, revenuePence: Math.round(p.revenuePence * 0.45), units: Math.max(1, p.units - 1) })),
        },
        {
          productId: DEMO_PRODUCT_IDS.beardOil,
          name: 'Beard Oil',
          points: overall.map((p) => ({ ...p, revenuePence: Math.round(p.revenuePence * 0.35), units: 1 })),
        },
      ],
    },
    leaderboard: [
      { productId: DEMO_PRODUCT_IDS.pomade, name: 'Matte Pomade', units: 12, revenuePence: 21600 },
      { productId: DEMO_PRODUCT_IDS.beardOil, name: 'Beard Oil', units: 8, revenuePence: 17600 },
      { productId: DEMO_PRODUCT_IDS.clay, name: 'Styling Clay', units: 6, revenuePence: 9600 },
    ],
  };
}
