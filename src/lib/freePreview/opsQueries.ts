import type { PreviewRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export const PREVIEW_REQUEST_STATUSES: readonly PreviewRequestStatus[] = [
  'REQUESTED',
  'IN_PROGRESS',
  'READY',
  'CHANGES_REQUESTED',
  'CONVERTED',
  'DECLINED',
  'EXPIRED',
  'REJECTED',
];

export const PREVIEW_STATUS_LABELS: Readonly<Record<PreviewRequestStatus, string>> = {
  REQUESTED: 'Requested',
  IN_PROGRESS: 'In progress',
  READY: 'Ready',
  CHANGES_REQUESTED: 'Changes requested',
  CONVERTED: 'Converted',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
};

export type PreviewRequestListSort = 'newest' | 'oldest';

export type PreviewRequestListQuery = {
  status: PreviewRequestStatus | null;
  sort: PreviewRequestListSort;
};

const LIST_LIMIT = 200;

/** Parses `?status=` and `?sort=` from the ops list URL; unknown values fall back to defaults. */
export function parsePreviewRequestListQuery(params: URLSearchParams): PreviewRequestListQuery {
  const rawStatus = (params.get('status') ?? '').trim().toUpperCase();
  const status = (PREVIEW_REQUEST_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as PreviewRequestStatus)
    : null;
  const sort: PreviewRequestListSort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  return { status, sort };
}

export async function listPreviewRequests(query: PreviewRequestListQuery) {
  return prisma.previewRequest.findMany({
    where: query.status ? { status: query.status } : undefined,
    orderBy: { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' },
    take: LIST_LIMIT,
    select: {
      id: true,
      shopName: true,
      townCity: true,
      bookingPageUrl: true,
      instagramUrl: true,
      googleListingUrl: true,
      websiteUrl: true,
      barberCount: true,
      currentBookingSystem: true,
      status: true,
      viewCount: true,
      firstViewedAt: true,
      createdAt: true,
    },
  });
}

/** Counts per status for requests created in the last 30 days. */
export async function countPreviewRequestsLast30Days(now: Date = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.previewRequest.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(PREVIEW_REQUEST_STATUSES.map((status) => [status, 0])) as Record<
    PreviewRequestStatus,
    number
  >;
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}

export type PreviewFunnelCounts = { requested: number; ready: number; viewed: number; converted: number };

/** Null when there is nothing to divide by, so ops sees "—" rather than a misleading 0%. */
export function previewFunnelRates(counts: PreviewFunnelCounts) {
  const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);
  return {
    requestedToReady: rate(counts.ready, counts.requested),
    readyToViewed: rate(counts.viewed, counts.ready),
    viewedToConverted: rate(counts.converted, counts.viewed),
  };
}

/** Funnel for requests created in the last 30 days. Anonymised records keep their dates, so they still count. */
export async function previewFunnelLast30Days(now: Date = new Date()): Promise<PreviewFunnelCounts> {
  const createdAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  const [requested, ready, viewed, converted] = await Promise.all([
    prisma.previewRequest.count({ where: { createdAt } }),
    prisma.previewRequest.count({ where: { createdAt, previewReadyAt: { not: null } } }),
    prisma.previewRequest.count({ where: { createdAt, previewReadyAt: { not: null }, firstViewedAt: { not: null } } }),
    prisma.previewRequest.count({ where: { createdAt, firstViewedAt: { not: null }, convertedAt: { not: null } } }),
  ]);
  return { requested, ready, viewed, converted };
}

export async function getPreviewRequestDetail(id: string) {
  return prisma.previewRequest.findUnique({
    where: { id },
    include: {
      draftShop: {
        select: { id: true, name: true, ownerUserId: true, sitePreviewUrl: true, sitePreviewVersion: true },
      },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
}

/** "3d", "5h", "12m" — compact age for the list. */
export function formatAge(from: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function previewRequestLinks(request: {
  bookingPageUrl: string | null;
  instagramUrl: string | null;
  googleListingUrl: string | null;
  websiteUrl: string | null;
}): Array<{ label: string; url: string }> {
  const entries: Array<[string, string | null]> = [
    ['Booking', request.bookingPageUrl],
    ['Instagram', request.instagramUrl],
    ['Google', request.googleListingUrl],
    ['Website', request.websiteUrl],
  ];
  return entries.flatMap(([label, url]) => (url ? [{ label, url }] : []));
}
