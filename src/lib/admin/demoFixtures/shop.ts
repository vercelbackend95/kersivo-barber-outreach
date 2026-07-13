import { formatInTimeZone } from 'date-fns-tz';
import { getDemoCatalogProducts } from '../../shop/demoCatalog';
import { DEMO_ORDER_IDS, DEMO_PRODUCT_IDS } from './ids';

const now = new Date().toISOString();
const TZ = 'Europe/London';

export const demoShopProductsResponse = {
  products: getDemoCatalogProducts({ activeOnly: false }).map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    pricePence: product.pricePence,
    imageUrl: product.imageUrl,
    active: product.active,
    featured: product.featured,
    category: product.category,
    sortOrder: product.sortOrder,
    updatedAt: product.updatedAt || now,
  })),
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
      totalPence: 1200,
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
        { id: 'demo-item-03', nameSnapshot: 'Forge Styling Powder', unitPricePenceSnapshot: 1200, quantity: 1, lineTotalPence: 1200 },
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
        productId: DEMO_PRODUCT_IDS.mattePomade,
        name: 'Matte Pomade',
        revenuePence: 21600,
        units: 12,
      },
    },
    series: {
      overall,
      products: [
        {
          productId: DEMO_PRODUCT_IDS.mattePomade,
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
      { productId: DEMO_PRODUCT_IDS.mattePomade, name: 'Matte Pomade', units: 12, revenuePence: 21600 },
      { productId: DEMO_PRODUCT_IDS.beardOil, name: 'Beard Oil', units: 8, revenuePence: 17600 },
      { productId: DEMO_PRODUCT_IDS.forgeStylingPowder, name: 'Forge Styling Powder', units: 6, revenuePence: 7200 },
    ],
  };
}
