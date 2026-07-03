import { DEMO_CLIENT_IDS } from './ids';

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

export function getDemoClientDetailResponse(clientId: string) {
  const listItem = demoClientsResponse.clients.find((c) => c.id === clientId);
  if (!listItem) return null;

  return {
    client: {
      id: listItem.id,
      fullName: listItem.fullName,
      email: listItem.email,
      phone: listItem.phone,
      notes: clientId === DEMO_CLIENT_IDS.oliver ? 'Prefers skin fade, #2 on sides.' : clientId === DEMO_CLIENT_IDS.noah ? 'Allergic to certain products — check before use.' : null,
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
  };
}
