import { DEMO_CLIENT_IDS } from './ids';
import { demoShopOrdersResponse, getDemoShopOrderDetail } from './shop';

const now = new Date().toISOString();
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

export const demoClientsResponse = {
  clients: [
    {
      id: DEMO_CLIENT_IDS.oliver,
      fullName: 'Oliver Reed',
      email: 'oliver.reed@example.com',
      phone: '+44 7700 900001',
      tags: ['regular'],
      updatedAt: now,
      reliabilityScore: 82,
      lastVisitAt: lastWeek,
      totalSpentPence: 33600,
      totalBookings: 12,
      completedCount: 11,
      noShowCount: 0,
    },
    {
      id: DEMO_CLIENT_IDS.amelia,
      fullName: 'Amelia Clarke',
      email: 'amelia.clarke@example.com',
      phone: '+44 7700 900002',
      tags: ['vip'],
      updatedAt: now,
      reliabilityScore: 91,
      lastVisitAt: lastWeek,
      totalSpentPence: 22400,
      totalBookings: 8,
      completedCount: 8,
      noShowCount: 0,
    },
    {
      id: DEMO_CLIENT_IDS.noah,
      fullName: 'Noah Bennett',
      email: 'noah.bennett@example.com',
      phone: null,
      tags: [],
      updatedAt: now,
      reliabilityScore: 68,
      lastVisitAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      totalSpentPence: 8400,
      totalBookings: 3,
      completedCount: 2,
      noShowCount: 1,
    },
  ],
};

function getDemoRetailForEmail(email: string) {
  const matchingOrders = demoShopOrdersResponse.orders.filter(
    (order) => order.customerEmail.toLowerCase() === email.toLowerCase(),
  );

  if (matchingOrders.length === 0) {
    return {
      retailStats: { productsBought: 0, avgSpendPence: 0 },
      lastOrder: null,
    };
  }

  const details = matchingOrders
    .map((order) => getDemoShopOrderDetail(order.id)?.order)
    .filter((order): order is NonNullable<typeof order> => Boolean(order));

  const productsBought = details.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const totalSpentPence = details.reduce((sum, order) => sum + order.totalPence, 0);
  const avgSpendPence = details.length > 0 ? Math.round(totalSpentPence / details.length) : 0;

  const newest = [...details].sort((a, b) => {
    const aTime = new Date(a.paidAt ?? a.createdAt).getTime();
    const bTime = new Date(b.paidAt ?? b.createdAt).getTime();
    return bTime - aTime;
  })[0];

  return {
    retailStats: { productsBought, avgSpendPence },
    lastOrder: newest
      ? {
          id: newest.id,
          status: newest.status,
          totalPence: newest.totalPence,
          paidAt: newest.paidAt,
          createdAt: newest.createdAt,
          items: newest.items.map((item) => ({
            nameSnapshot: item.nameSnapshot,
            quantity: item.quantity,
          })),
        }
      : null,
  };
}

export function getDemoClientDetailResponse(clientId: string) {
  const listItem = demoClientsResponse.clients.find((c) => c.id === clientId);
  if (!listItem) return null;

  const { retailStats, lastOrder } = getDemoRetailForEmail(listItem.email);

  return {
    client: {
      id: listItem.id,
      fullName: listItem.fullName,
      email: listItem.email,
      phone: listItem.phone,
      tags: listItem.tags,
      createdAt: now,
      updatedAt: listItem.updatedAt,
    },
    stats: {
      totalBookings: listItem.totalBookings,
      completedCount: listItem.completedCount,
      noShowCount: listItem.noShowCount,
      lastVisitAt: listItem.lastVisitAt,
      totalSpentPence: listItem.totalSpentPence,
      avgSpendPence: listItem.completedCount > 0 ? Math.round(listItem.totalSpentPence / listItem.completedCount) : 0,
      favouriteService: 'Skin Fade',
    },
    reliabilityScore: listItem.reliabilityScore,
    retailStats,
    lastOrder,
  };
}
