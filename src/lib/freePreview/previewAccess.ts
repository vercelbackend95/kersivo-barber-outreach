import type { PreviewRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { previewHoursFromRows } from './previewBookingSlots';
import { isWellFormedPreviewToken, previewTokenLookupHash, previewTokensMatch } from './token';

/** Statuses in which the owner can view the preview, request changes and launch. */
export const OWNER_ACTIONABLE_STATUSES: readonly PreviewRequestStatus[] = ['READY', 'CHANGES_REQUESTED'];

const previewRequestSelect = {
  id: true,
  publicToken: true,
  status: true,
  firstName: true,
  email: true,
  shopName: true,
  townCity: true,
  instagramUrl: true,
  websiteUrl: true,
  hasOwnDomain: true,
  barberCount: true,
  currentBookingSystem: true,
  draftShopId: true,
  expiresAt: true,
  previewReadyAt: true,
  convertedAt: true,
  changesRequestedAt: true,
  createdAt: true,
  liveAt: true,
  includedChangeRounds: true,
  changeRoundsUsed: true,
  brandPrimaryColour: true,
  brandSecondaryColour: true,
  brandBackgroundTone: true,
  brandColoursSource: true,
  brandPaletteExtracted: true,
  brandColoursSentAt: true,
  styleNotes: true,
  aboutText: true,
} as const;

export type TokenPreviewRequest = NonNullable<Awaited<ReturnType<typeof findPreviewRequestRow>>>;

async function findPreviewRequestRow(lookupHash: string) {
  return prisma.previewRequest.findUnique({
    where: { publicTokenHash: lookupHash },
    select: previewRequestSelect,
  });
}

/**
 * Resolves a preview request from the token in its private URL. Looks it up by the token's SHA-256 and
 * then compares the plaintext in constant time. Every miss returns null, so callers answer with one
 * uniform 404 and nothing reveals whether a request exists.
 */
export async function resolvePreviewRequestByToken(token: string): Promise<TokenPreviewRequest | null> {
  const trimmed = token.trim();
  if (!isWellFormedPreviewToken(trimmed)) return null;
  const row = await findPreviewRequestRow(previewTokenLookupHash(trimmed));
  if (!row || !previewTokensMatch(trimmed, row.publicToken)) return null;
  return row;
}

/** Same row as the token lookup, for the signed `ks_hub` cookie (the id was authenticated by its HMAC). */
export async function resolvePreviewRequestById(id: string): Promise<TokenPreviewRequest | null> {
  if (!id) return null;
  return prisma.previewRequest.findUnique({ where: { id }, select: previewRequestSelect });
}

/** The request whose draft shop an owner adopted at checkout (draftShopId is unique). */
export async function resolvePreviewRequestByDraftShopId(shopId: string): Promise<TokenPreviewRequest | null> {
  if (!shopId) return null;
  return prisma.previewRequest.findUnique({ where: { draftShopId: shopId }, select: previewRequestSelect });
}

export function isPreviewExpired(request: { status: PreviewRequestStatus; expiresAt: Date | null }, now: Date): boolean {
  if (request.status === 'EXPIRED' || request.status === 'DECLINED') return true;
  return Boolean(request.expiresAt && request.expiresAt.getTime() <= now.getTime());
}

/** The owner may request changes or start checkout only while the preview is live and unexpired. */
export function ownerCanActOnPreview(
  request: { status: PreviewRequestStatus; expiresAt: Date | null; draftShopId: string | null },
  now: Date,
): boolean {
  return (
    OWNER_ACTIONABLE_STATUSES.includes(request.status) &&
    Boolean(request.draftShopId) &&
    !isPreviewExpired(request, now)
  );
}

export type PreviewPageState =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'preview'; request: TokenPreviewRequest; draftShopId: string; isOperator: boolean };

/**
 * What /preview/{token} shows. Requests that are not ready yet (or were rejected) look exactly like an
 * unknown token. Operators can open any linked preview to check it before sending.
 */
export function resolvePreviewPageState(input: {
  request: TokenPreviewRequest | null;
  isOperator: boolean;
  now: Date;
}): PreviewPageState {
  const { request, isOperator, now } = input;
  if (!request?.draftShopId) return { kind: 'not_found' };
  if (isOperator) return { kind: 'preview', request, draftShopId: request.draftShopId, isOperator: true };
  if (request.status === 'CONVERTED') {
    return { kind: 'preview', request, draftShopId: request.draftShopId, isOperator: false };
  }
  if (isPreviewExpired(request, now)) {
    // Only previews that were actually sent can expire; anything else stays indistinguishable from unknown.
    return request.previewReadyAt ? { kind: 'expired' } : { kind: 'not_found' };
  }
  if (OWNER_ACTIONABLE_STATUSES.includes(request.status)) {
    return { kind: 'preview', request, draftShopId: request.draftShopId, isOperator: false };
  }
  return { kind: 'not_found' };
}

/** Views are counted for the owner only: never for operators, and not after conversion. */
export function shouldRecordOwnerView(state: PreviewPageState): boolean {
  return state.kind === 'preview' && !state.isOperator && state.request.status !== 'CONVERTED';
}

/** Owner view tracking (spec §6). Never called for operator views. Returns true on the first view. */
export async function recordPreviewView(id: string, now: Date = new Date()): Promise<boolean> {
  const first = await prisma.previewRequest.updateMany({
    where: { id, firstViewedAt: null },
    data: { firstViewedAt: now },
  });
  await prisma.previewRequest.update({
    where: { id },
    data: { lastViewedAt: now, viewCount: { increment: 1 } },
  });
  return first.count > 0;
}

/** Draft shop data rendered on the preview: the website URL plus the catalogue for the test booking page. */
export async function loadPreviewDraftShop(shopId: string) {
  const [shop, services, barbers, hourRows] = await Promise.all([
    prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        timezone: true,
        sitePreviewUrl: true,
        sitePreviewVersion: true,
        cancellationWindowHours: true,
        rescheduleWindowHours: true,
      },
    }),
    prisma.service.findMany({
      where: { isActive: true, shopId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, durationMinutes: true, pricePence: true, category: true, description: true },
    }),
    prisma.barber.findMany({
      where: { active: true, shopId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, barberServices: { select: { serviceId: true } } },
    }),
    prisma.shopOpeningHours.findMany({
      where: { shopId },
      select: { dayOfWeek: true, active: true },
    }),
  ]);
  if (!shop) return null;
  return {
    shop,
    services,
    hours: previewHoursFromRows(hourRows),
    barbers: barbers.map((barber) => ({
      id: barber.id,
      name: barber.name,
      serviceIds: barber.barberServices.map((link) => link.serviceId),
    })),
  };
}
