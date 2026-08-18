import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { BLACKLINE_PEOPLE } from './catalog';
import { getBlacklineHistoryBookings, getBlacklineBookingsForDayKey } from './schedule';
import { getBlacklineRetailLedger, getBlacklineShopOrderDetail } from './shop';
import { blacklineDayKey, coarseLondonNow } from './time';

export function getBlacklineClientsResponse(now = new Date()) {
  const clock = coarseLondonNow(now);
  const todayKey = blacklineDayKey(clock);
  const bookings = [
    ...getBlacklineHistoryBookings(30, clock),
    ...getBlacklineBookingsForDayKey(todayKey, { now: clock }),
  ];
  const orders = getBlacklineRetailLedger(clock);
  const emails = new Set<string>();
  for (const row of bookings) emails.add(row.email.toLowerCase());
  for (const order of orders) emails.add(order.customerEmail.toLowerCase());

  const clients = [...emails].map((email) => {
    const person = BLACKLINE_PEOPLE.find((row) => row.email.toLowerCase() === email);
    const personBookings = bookings.filter((row) => row.email.toLowerCase() === email);
    const completed = personBookings.filter((row) => row.status === 'COMPLETED');
    const noShows = personBookings.filter((row) => row.status === 'NO_SHOW');
    const lastVisit = [...completed].sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    )[0];
    const totalSpentPence = completed.reduce((sum, row) => sum + row.totalPricePence, 0);
    return {
      id: person?.id ?? `bl-client-${email.replace(/[^a-z0-9]+/g, '-')}`,
      fullName: person?.fullName ?? email,
      email,
      phone: null as string | null,
      tags: completed.length >= 4 ? ['regular'] : [],
      updatedAt: lastVisit?.startAt ?? clock.toISOString(),
      reliabilityScore: Math.max(55, 96 - noShows.length * 12 - (personBookings.length - completed.length) * 4),
      lastVisitAt: lastVisit?.startAt ?? null,
      totalSpentPence,
      totalBookings: personBookings.length,
      completedCount: completed.length,
      noShowCount: noShows.length,
    };
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));

  return { clients };
}

function favouriteService(email: string, now: Date): string | null {
  const clock = coarseLondonNow(now);
  const todayKey = blacklineDayKey(clock);
  const bookings = [
    ...getBlacklineHistoryBookings(30, clock),
    ...getBlacklineBookingsForDayKey(todayKey, { now: clock }),
  ].filter((row) => row.email.toLowerCase() === email.toLowerCase() && row.status === 'COMPLETED');
  const counts = new Map<string, number>();
  for (const row of bookings) {
    counts.set(row.serviceNameAtBooking, (counts.get(row.serviceNameAtBooking) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function retailForEmail(email: string, now: Date) {
  const matching = getBlacklineRetailLedger(now).filter(
    (order) => order.customerEmail.toLowerCase() === email.toLowerCase(),
  );
  if (matching.length === 0) {
    return { retailStats: { productsBought: 0, avgSpendPence: 0 }, lastOrder: null };
  }
  const details = matching
    .map((order) => getBlacklineShopOrderDetail(order.id, now)?.order)
    .filter((order): order is NonNullable<typeof order> => Boolean(order));
  const productsBought = details.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const totalSpentPence = details.reduce((sum, order) => sum + order.totalPence, 0);
  const newest = [...details].sort(
    (a, b) => new Date(b.paidAt ?? b.createdAt).getTime() - new Date(a.paidAt ?? a.createdAt).getTime(),
  )[0];
  return {
    retailStats: {
      productsBought,
      avgSpendPence: details.length > 0 ? Math.round(totalSpentPence / details.length) : 0,
    },
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

export function getBlacklineClientDetailResponse(clientId: string, now = new Date()) {
  const listItem = getBlacklineClientsResponse(now).clients.find((row) => row.id === clientId);
  if (!listItem) return null;
  const { retailStats, lastOrder } = retailForEmail(listItem.email, now);
  return {
    client: {
      id: listItem.id,
      fullName: listItem.fullName,
      email: listItem.email,
      phone: listItem.phone,
      tags: listItem.tags,
      createdAt: listItem.updatedAt,
      updatedAt: listItem.updatedAt,
    },
    stats: {
      totalBookings: listItem.totalBookings,
      completedCount: listItem.completedCount,
      noShowCount: listItem.noShowCount,
      lastVisitAt: listItem.lastVisitAt,
      totalSpentPence: listItem.totalSpentPence,
      avgSpendPence: listItem.completedCount > 0 ? Math.round(listItem.totalSpentPence / listItem.completedCount) : 0,
      favouriteService: favouriteService(listItem.email, now),
    },
    reliabilityScore: listItem.reliabilityScore,
    retailStats,
    lastOrder,
  };
}

const notesByClient = new Map<string, Array<{
  id: string;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  images: unknown[];
  barber: { id: string; name: string; avatarUrl: string } | null;
}>>();

export function getBlacklineClientNotesResponse(clientId: string) {
  return { notes: notesByClient.get(clientId) ?? [] };
}

export async function createBlacklineClientNoteFromRequest(clientId: string, request: Request) {
  const detail = getBlacklineClientDetailResponse(clientId);
  if (!detail) return null;
  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim() ?? '';
  if (!text) throw new Error('Note body is required.');
  const owner = DEMO_BARBERS[0]!;
  const note = {
    id: `bl-note-${clientId}-${Date.now()}`,
    body: text.slice(0, 2000),
    createdAt: new Date().toISOString(),
    likeCount: 0,
    likedByMe: false,
    images: [],
    barber: { id: owner.id, name: owner.name, avatarUrl: owner.image.src },
  };
  const existing = notesByClient.get(clientId) ?? [];
  notesByClient.set(clientId, [note, ...existing]);
  return { note };
}

export function toggleBlacklineClientNoteLike(clientId: string, noteId: string) {
  const notes = notesByClient.get(clientId);
  const note = notes?.find((row) => row.id === noteId);
  if (!note) return null;
  note.likedByMe = !note.likedByMe;
  note.likeCount = Math.max(0, note.likeCount + (note.likedByMe ? 1 : -1));
  return { note };
}
