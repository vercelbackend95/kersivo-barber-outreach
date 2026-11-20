import { blacklineDayKey, coarseLondonNow } from '@/lib/admin/blacklineDemoFixtures/time';
import { HERITAGE_BARBERS } from '@/lib/demo/heritage/data';
import { HERITAGE_PEOPLE } from './catalog';
import { getHeritageBookingsForDayKey, getHeritageHistoryBookings, type HeritageBooking } from './schedule';
import { getHeritageRetailLedger } from './shop';

function visibleBookings(now: Date): HeritageBooking[] {
  const clock = coarseLondonNow(now);
  return [
    ...getHeritageHistoryBookings(30, clock),
    ...getHeritageBookingsForDayKey(blacklineDayKey(clock), { now: clock }),
  ];
}

export function getHeritageClientsResponse(now = new Date()) {
  const clock = coarseLondonNow(now);
  const bookings = visibleBookings(clock);
  const orders = getHeritageRetailLedger(clock);
  const emails = new Set<string>();
  for (const row of bookings) emails.add(row.email.toLowerCase());
  for (const row of orders) emails.add(row.customerEmail.toLowerCase());

  const clients = [...emails]
    .map((email) => {
      const person = HERITAGE_PEOPLE.find((row) => row.email.toLowerCase() === email);
      const personBookings = bookings.filter((row) => row.email.toLowerCase() === email);
      const completed = personBookings.filter((row) => row.status === 'COMPLETED');
      const noShows = personBookings.filter((row) => row.status === 'NO_SHOW');
      const lastVisit = [...completed].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];
      const totalSpentPence = completed.reduce((sum, row) => sum + row.totalPricePence, 0);
      return {
        id: person?.id ?? `hg-client-${email.replace(/[^a-z0-9]+/g, '-')}`,
        fullName: person?.fullName ?? email,
        email,
        phone: person?.phone ?? null,
        tags: completed.length >= 4 ? ['regular'] : [],
        updatedAt: lastVisit?.startAt ?? clock.toISOString(),
        reliabilityScore: Math.max(55, 96 - noShows.length * 12 - (personBookings.length - completed.length) * 4),
        lastVisitAt: lastVisit?.startAt ?? null,
        totalSpentPence,
        totalBookings: personBookings.length,
        completedCount: completed.length,
        noShowCount: noShows.length,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return { clients };
}

function favouriteService(email: string, now: Date): string | null {
  const counts = new Map<string, number>();
  for (const row of visibleBookings(now)) {
    if (row.email.toLowerCase() !== email.toLowerCase() || row.status !== 'COMPLETED') continue;
    counts.set(row.serviceNameAtBooking, (counts.get(row.serviceNameAtBooking) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function retailForEmail(email: string, now: Date) {
  const matching = getHeritageRetailLedger(now).filter((row) => row.customerEmail.toLowerCase() === email.toLowerCase());
  if (matching.length === 0) {
    return { retailStats: { productsBought: 0, avgSpendPence: 0 }, lastOrder: null };
  }
  const productsBought = matching.reduce((sum, row) => sum + row.items.reduce((n, item) => n + item.quantity, 0), 0);
  const totalSpentPence = matching.reduce((sum, row) => sum + row.totalPence, 0);
  const newest = [...matching].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0]!;
  return {
    retailStats: { productsBought, avgSpendPence: Math.round(totalSpentPence / matching.length) },
    lastOrder: {
      id: newest.id,
      status: newest.status,
      totalPence: newest.totalPence,
      paidAt: newest.paidAt,
      createdAt: newest.createdAt,
      items: newest.items.map((item) => ({ nameSnapshot: item.nameSnapshot, quantity: item.quantity })),
    },
  };
}

export function getHeritageClientDetailResponse(clientId: string, now = new Date()) {
  const listItem = getHeritageClientsResponse(now).clients.find((row) => row.id === clientId);
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

type HeritageClientNote = {
  id: string;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  images: unknown[];
  barber: { id: string; name: string; avatarUrl: string } | null;
};

/** Notes posted during a visit live in server memory only; nothing is stored. */
const notesByClient = new Map<string, HeritageClientNote[]>();

export function getHeritageClientNotesResponse(clientId: string) {
  return { notes: notesByClient.get(clientId) ?? [] };
}

export async function createHeritageClientNoteFromRequest(clientId: string, request: Request, now?: Date) {
  if (!getHeritageClientDetailResponse(clientId, now)) return null;
  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim() ?? '';
  if (!text) throw new Error('Note body is required.');
  const owner = HERITAGE_BARBERS[0]!;
  const note: HeritageClientNote = {
    id: `hg-note-${clientId}-${Date.now()}`,
    body: text.slice(0, 2000),
    createdAt: (now ?? new Date()).toISOString(),
    likeCount: 0,
    likedByMe: false,
    images: [],
    barber: { id: owner.id, name: owner.name, avatarUrl: owner.avatarSrc },
  };
  notesByClient.set(clientId, [note, ...(notesByClient.get(clientId) ?? [])]);
  return { note };
}

export function toggleHeritageClientNoteLike(clientId: string, noteId: string) {
  const note = notesByClient.get(clientId)?.find((row) => row.id === noteId);
  if (!note) return null;
  note.likedByMe = !note.likedByMe;
  note.likeCount = Math.max(0, note.likeCount + (note.likedByMe ? 1 : -1));
  return { note };
}
