import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { isDemoShopId } from './cardPaymentsGate';
import {
  normalizeFullBookingDestinationUrl,
  type FullBookingDestinationUrlError,
} from './fullBookingDestinationUrl';
import { loadKersivoAccess, type KersivoProductState } from './kersivoAccess';
import type { StoredFullBookingDestination } from './publicBookingDestination';

export const FULL_DESTINATION_VERIFICATION_METHOD = 'OPS_MANUAL_ATTESTATION';

/** Everything KERSIVO OPS must have personally confirmed before marking a destination live. */
export const FULL_DESTINATION_ATTESTATIONS = [
  'dnsPointsCorrectly',
  'httpsWorks',
  'liveSiteReachable',
  'correctShopLocation',
  'bookingFlowReachable',
] as const;

export type FullDestinationAttestation = (typeof FULL_DESTINATION_ATTESTATIONS)[number];

export function hasAllFullDestinationAttestations(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return FULL_DESTINATION_ATTESTATIONS.every((key) => record[key] === true);
}

type Actor = { userId: string | null; email: string | null };

type Db = typeof prisma;

const destinationSelect = {
  shopId: true,
  status: true,
  url: true,
  verifiedAt: true,
  verificationMethod: true,
  siteVersion: true,
  invalidatedAt: true,
} as const;

/**
 * Loads the stored destination only while the shop is on Full KERSIVO; Starter, SETUP and every
 * departed shop never consult it (the record stays for audit after Full ends).
 */
export async function loadFullBookingDestinationForState(
  shopId: string,
  state: KersivoProductState,
  db: Pick<Db, 'fullBookingDestination'> | Prisma.TransactionClient = prisma,
): Promise<StoredFullBookingDestination | null> {
  if (state !== 'FULL_KERSIVO') return null;
  return db.fullBookingDestination.findUnique({
    where: { shopId },
    select: { shopId: true, status: true, url: true },
  });
}

function lockShop(tx: Prisma.TransactionClient, shopId: string) {
  return tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${shopId} FOR UPDATE`);
}

function normalizeActor(actor: Actor): Actor {
  return { userId: actor.userId ?? null, email: actor.email?.trim().toLowerCase() || null };
}

export type VerifyFullDestinationResult =
  | {
      ok: true;
      outcome: 'verified' | 'already_verified' | 'url_changed' | 'reverified';
      destination: Prisma.FullBookingDestinationGetPayload<{ select: typeof destinationSelect }>;
    }
  | { ok: false; reason: 'NOT_FOUND' | 'PROTECTED_SHOP' | 'NOT_FULL' | 'URL_CHANGE_NOT_CONFIRMED' }
  | { ok: false; reason: 'INVALID_URL'; code: FullBookingDestinationUrlError };

/**
 * OPS attestation that `url` is the shop's live Full booking destination. Full KERSIVO shops only.
 * Same URL → idempotent no-op. A different URL replaces the verified one only with
 * `replaceExisting` and is audited as URL_CHANGED.
 */
export async function verifyFullBookingDestination(input: {
  shopId: string;
  url: unknown;
  siteVersion?: string | null;
  replaceExisting?: boolean;
  actor: Actor;
  now?: Date;
  db?: Db;
}): Promise<VerifyFullDestinationResult> {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const shopId = input.shopId.trim();
  if (!shopId) return { ok: false, reason: 'NOT_FOUND' };
  if (isDemoShopId(shopId)) return { ok: false, reason: 'PROTECTED_SHOP' };

  const normalized = normalizeFullBookingDestinationUrl(input.url);
  if (!normalized.ok) return { ok: false, reason: 'INVALID_URL', code: normalized.code };
  const url = normalized.url;
  const siteVersion = input.siteVersion?.trim().slice(0, 80) || null;
  const actor = normalizeActor(input.actor);

  return db.$transaction(async (tx) => {
    const shop = await tx.shopSettings.findUnique({ where: { id: shopId }, select: { id: true } });
    if (!shop) return { ok: false, reason: 'NOT_FOUND' } as const;
    await lockShop(tx, shopId);

    const access = await loadKersivoAccess(shopId, now, tx);
    if (access.state !== 'FULL_KERSIVO') return { ok: false, reason: 'NOT_FULL' } as const;

    const existing = await tx.fullBookingDestination.findUnique({
      where: { shopId },
      select: { ...destinationSelect, id: true },
    });

    const verifiedFields = {
      status: 'VERIFIED_LIVE' as const,
      url,
      verifiedAt: now,
      verificationMethod: FULL_DESTINATION_VERIFICATION_METHOD,
      verifiedByUserId: actor.userId,
      verifiedByEmail: actor.email,
      siteVersion,
      invalidatedAt: null,
      invalidationReason: null,
    };

    if (existing && existing.status === 'VERIFIED_LIVE') {
      if (existing.url === url) {
        const { id: _id, ...destination } = existing;
        return { ok: true, outcome: 'already_verified', destination } as const;
      }
      if (input.replaceExisting !== true) {
        return { ok: false, reason: 'URL_CHANGE_NOT_CONFIRMED' } as const;
      }
    }

    const destination = existing
      ? await tx.fullBookingDestination.update({
          where: { shopId },
          data: verifiedFields,
          select: destinationSelect,
        })
      : await tx.fullBookingDestination.create({
          data: { shopId, ...verifiedFields },
          select: destinationSelect,
        });

    const outcome = !existing
      ? 'verified'
      : existing.status === 'VERIFIED_LIVE'
        ? 'url_changed'
        : 'reverified';
    await tx.fullBookingDestinationEvent.create({
      data: {
        shopId,
        action: outcome === 'url_changed' ? 'URL_CHANGED' : 'VERIFIED',
        url,
        previousUrl: existing?.url ?? null,
        siteVersion,
        actorUserId: actor.userId,
        actorEmail: actor.email,
        note: `method=${FULL_DESTINATION_VERIFICATION_METHOD}`,
      },
    });
    return { ok: true, outcome, destination } as const;
  });
}

export type InvalidateFullDestinationResult =
  | { ok: true; outcome: 'invalidated' | 'already_invalidated' }
  | { ok: false; reason: 'NOT_FOUND' | 'REASON_REQUIRED' };

/**
 * OPS: the verified destination is no longer authoritative. Full immediately falls back to the
 * KERSIVO-hosted booking route; the record and its audit history are kept.
 */
export async function invalidateFullBookingDestination(input: {
  shopId: string;
  reason: unknown;
  actor: Actor;
  now?: Date;
  db?: Db;
}): Promise<InvalidateFullDestinationResult> {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const shopId = input.shopId.trim();
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 2000) : '';
  if (!reason) return { ok: false, reason: 'REASON_REQUIRED' };
  const actor = normalizeActor(input.actor);

  return db.$transaction(async (tx) => {
    await lockShop(tx, shopId);
    const existing = await tx.fullBookingDestination.findUnique({
      where: { shopId },
      select: { status: true, url: true, siteVersion: true },
    });
    if (!existing) return { ok: false, reason: 'NOT_FOUND' } as const;
    if (existing.status === 'INVALIDATED') return { ok: true, outcome: 'already_invalidated' } as const;

    await tx.fullBookingDestination.update({
      where: { shopId },
      data: { status: 'INVALIDATED', invalidatedAt: now, invalidationReason: reason },
    });
    await tx.fullBookingDestinationEvent.create({
      data: {
        shopId,
        action: 'INVALIDATED',
        url: existing.url,
        siteVersion: existing.siteVersion,
        actorUserId: actor.userId,
        actorEmail: actor.email,
        note: reason,
      },
    });
    return { ok: true, outcome: 'invalidated' } as const;
  });
}

/** OPS read model: current record + recent audit trail for one shop. */
export async function loadFullBookingDestinationOpsView(shopId: string, db: Db = prisma) {
  const [destination, events] = await Promise.all([
    db.fullBookingDestination.findUnique({ where: { shopId }, select: destinationSelect }),
    db.fullBookingDestinationEvent.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        action: true,
        url: true,
        previousUrl: true,
        siteVersion: true,
        actorEmail: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);
  return { destination, events };
}
