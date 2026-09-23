import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { captureOpsMessage } from '@/lib/ops/sentry';
import { deletePrivateOnboardingFile } from '@/lib/storage/privateOnboardingBlob';
import {
  buildForeignPublicBlobCanonicalSet,
  evaluateShopPurgePublicBlobCandidate,
  normalizePublicBlobHttpsUrl,
} from '@/lib/storage/publicBlobSafety';
import { isPrivateNoteBlobPathname } from '@/lib/storage/storeNoteImage';
import {
  deletePublicBlobObject,
  listPublicBlobsByPrefix,
} from '@/lib/storage/vercelBlob';

type Tx = Prisma.TransactionClient;

export type PublicBlobCleanupStats = {
  attempted: number;
  deleted: number;
  failed: number;
  skippedCrossShop: number;
  skippedInvalid: number;
};

/**
 * Deletes a shop and related data that does not cascade cleanly
 * (bookings, orders with Restrict product FKs, email/SMS outbox rows).
 *
 * Does not delete LegalAcceptance, SaasSubscription, SetupDeposit, or AccountLifecycleEvent.
 */
export async function purgeShopData(tx: Tx, shopId: string): Promise<void> {
  await tx.emailOutbound.deleteMany({ where: { shopId } });
  await tx.smsOutbound.deleteMany({ where: { shopId } });
  await tx.booking.deleteMany({
    where: {
      OR: [{ barber: { shopId } }, { service: { shopId } }],
    },
  });
  await tx.order.deleteMany({ where: { shopId } });
  await tx.shopSettings.delete({ where: { id: shopId } });
}

/**
 * Idempotent purge gate. Serializes against media writers via ShopSettings FOR UPDATE.
 * Retries with an already-set purgeStartedAt are allowed (alreadyStarted: true).
 * Does not clear the gate — writers stay blocked for retry safety.
 */
export async function beginShopPurgeGate(
  shopId: string,
  now: Date = new Date(),
): Promise<{ alreadyStarted: boolean }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; purgeStartedAt: Date | null }>>(
      Prisma.sql`
        SELECT id, "purgeStartedAt"
        FROM "ShopSettings"
        WHERE id = ${shopId}
        FOR UPDATE
      `,
    );
    if (locked.length === 0) {
      throw new Error('Shop not found for purge gate.');
    }
    if (locked[0]!.purgeStartedAt != null) {
      return { alreadyStarted: true };
    }
    await tx.shopSettings.update({
      where: { id: shopId },
      data: { purgeStartedAt: now },
    });
    return { alreadyStarted: false };
  });
}

/** Collect private Blob pathnames that must be deleted after the shop DB graph is purged. */
export async function listPrivateBlobPathsForShopPurge(
  shopId: string,
  db: Pick<typeof prisma, 'clientOnboardingAsset' | 'clientNoteImage'> = prisma,
): Promise<string[]> {
  const [onboardingAssets, noteImages] = await Promise.all([
    db.clientOnboardingAsset.findMany({
      where: { shopId },
      select: { storagePath: true },
    }),
    db.clientNoteImage.findMany({
      where: { note: { client: { shopId } } },
      select: { url: true },
    }),
  ]);

  const paths = new Set<string>();
  for (const asset of onboardingAssets) {
    const path = asset.storagePath.trim();
    if (path) paths.add(path);
  }
  for (const image of noteImages) {
    if (isPrivateNoteBlobPathname(image.url)) {
      paths.add(image.url.trim());
    }
  }
  return [...paths];
}

/** Best-effort private Blob deletes after a successful shop purge commit. */
export async function deletePrivateBlobPathsBestEffort(paths: string[]): Promise<void> {
  for (const pathname of paths) {
    const path = pathname.trim();
    if (!path) continue;
    try {
      await deletePrivateOnboardingFile(path);
    } catch (error) {
      console.error('[purge] private blob delete failed', {
        phase: 'private_cleanup',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

/**
 * Collect validated public Blob URLs from shop-owned DB fields AFTER purge gate is active
 * and BEFORE shopSettings.delete cascade. Does not delete.
 */
export async function listPublicBlobUrlsForShopPurge(
  shopId: string,
  db: Pick<typeof prisma, 'shopSettings' | 'product' | 'service' | 'barber' | 'client'> = prisma,
): Promise<string[]> {
  const [shop, products, services, barbers, clients] = await Promise.all([
    db.shopSettings.findUnique({ where: { id: shopId }, select: { logoUrl: true } }),
    db.product.findMany({ where: { shopId }, select: { imageUrl: true } }),
    db.service.findMany({ where: { shopId }, select: { imageUrl: true } }),
    db.barber.findMany({ where: { shopId }, select: { avatarUrl: true } }),
    db.client.findMany({ where: { shopId }, select: { avatarUrl: true } }),
  ]);

  const candidates = [
    shop?.logoUrl,
    ...products.map((p) => p.imageUrl),
    ...services.map((s) => s.imageUrl),
    ...barbers.map((b) => b.avatarUrl),
    ...clients.map((c) => c.avatarUrl),
  ];

  const foreign = await buildForeignPublicBlobCanonicalSet(shopId, db);
  const accepted = new Set<string>();
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const decision = evaluateShopPurgePublicBlobCandidate(raw, shopId);
    if (!decision.ok) continue;
    if (foreign.has(decision.canonicalUrl)) continue;
    accepted.add(decision.canonicalUrl);
  }
  return [...accepted];
}

async function deleteCanonicalPublicBlobIfSafe(
  canonicalUrl: string,
  purgedShopId: string,
  stats: PublicBlobCleanupStats,
  phase: string,
): Promise<void> {
  stats.attempted += 1;
  try {
    const referenced = await buildForeignPublicBlobCanonicalSet(null);
    if (referenced.has(canonicalUrl)) {
      stats.skippedCrossShop += 1;
      return;
    }
    await deletePublicBlobObject(canonicalUrl);
    stats.deleted += 1;
  } catch (error) {
    stats.failed += 1;
    console.error('[purge] public blob delete failed', {
      shopId: purgedShopId,
      phase,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/** Best-effort delete of pre-collected public Blob URLs after DB purge commit. */
export async function deletePublicBlobUrlsBestEffort(
  canonicalUrls: string[],
  shopId: string,
): Promise<PublicBlobCleanupStats> {
  const stats: PublicBlobCleanupStats = {
    attempted: 0,
    deleted: 0,
    failed: 0,
    skippedCrossShop: 0,
    skippedInvalid: 0,
  };
  for (const url of canonicalUrls) {
    const normalized = normalizePublicBlobHttpsUrl(url);
    if (!normalized) {
      stats.skippedInvalid += 1;
      continue;
    }
    const decision = evaluateShopPurgePublicBlobCandidate(normalized.canonicalUrl, shopId);
    if (!decision.ok) {
      stats.skippedInvalid += 1;
      continue;
    }
    await deleteCanonicalPublicBlobIfSafe(decision.canonicalUrl, shopId, stats, 'collected_public_cleanup');
  }
  return stats;
}

const PREFIX_SWEEP_MAX_PAGES = 500;

/**
 * Mandatory post-purge public store sweep for shops/{shopId}/ only.
 * Never lists legacy products/|barbers/|clients/ prefixes.
 */
export async function sweepShopPrefixedPublicBlobsBestEffort(
  shopId: string,
): Promise<PublicBlobCleanupStats & { pages: number; listFailed: boolean }> {
  const stats: PublicBlobCleanupStats & { pages: number; listFailed: boolean } = {
    attempted: 0,
    deleted: 0,
    failed: 0,
    skippedCrossShop: 0,
    skippedInvalid: 0,
    pages: 0,
    listFailed: false,
  };

  const prefix = `shops/${shopId}/`;
  let cursor: string | undefined;
  let previousCursor: string | undefined;

  while (stats.pages < PREFIX_SWEEP_MAX_PAGES) {
    stats.pages += 1;
    let page;
    try {
      page = await listPublicBlobsByPrefix(prefix, { cursor, limit: 100 });
    } catch (error) {
      stats.listFailed = true;
      console.error('[purge] public blob prefix list failed', {
        shopId,
        phase: 'shops_prefix_sweep',
        error: error instanceof Error ? error.message : 'unknown',
      });
      captureOpsMessage('Shop purge public Blob prefix list failed', {
        route: 'purge.public_blob_sweep',
        shopId,
        level: 'warning',
        opsAlert: true,
        tags: { phase: 'shops_prefix_sweep' },
      });
      return stats;
    }

    for (const blob of page.blobs) {
      const normalized = normalizePublicBlobHttpsUrl(blob.url);
      if (!normalized) {
        stats.skippedInvalid += 1;
        continue;
      }
      if (!normalized.pathname.startsWith(prefix)) {
        stats.skippedInvalid += 1;
        continue;
      }
      const decision = evaluateShopPurgePublicBlobCandidate(normalized.canonicalUrl, shopId);
      if (!decision.ok) {
        stats.skippedInvalid += 1;
        continue;
      }
      await deleteCanonicalPublicBlobIfSafe(
        decision.canonicalUrl,
        shopId,
        stats,
        'shops_prefix_sweep',
      );
    }

    if (!page.hasMore) break;

    if (!page.cursor) {
      stats.listFailed = true;
      console.error('[purge] public blob prefix pagination missing cursor', {
        shopId,
        phase: 'shops_prefix_sweep',
      });
      captureOpsMessage('Shop purge public Blob prefix pagination stalled', {
        route: 'purge.public_blob_sweep',
        shopId,
        level: 'warning',
        opsAlert: true,
        tags: { phase: 'shops_prefix_sweep', reason: 'missing_cursor' },
      });
      break;
    }

    if (previousCursor !== undefined && page.cursor === previousCursor) {
      stats.listFailed = true;
      console.error('[purge] public blob prefix pagination cursor did not advance', {
        shopId,
        phase: 'shops_prefix_sweep',
      });
      captureOpsMessage('Shop purge public Blob prefix pagination stalled', {
        route: 'purge.public_blob_sweep',
        shopId,
        level: 'warning',
        opsAlert: true,
        tags: { phase: 'shops_prefix_sweep', reason: 'cursor_not_advancing' },
      });
      break;
    }

    previousCursor = page.cursor;
    cursor = page.cursor;
  }

  if (stats.pages >= PREFIX_SWEEP_MAX_PAGES) {
    stats.listFailed = true;
    captureOpsMessage('Shop purge public Blob prefix sweep page limit reached', {
      route: 'purge.public_blob_sweep',
      shopId,
      level: 'warning',
      opsAlert: true,
      tags: { phase: 'shops_prefix_sweep', reason: 'page_limit' },
    });
  }

  return stats;
}

/** Post-commit public cleanup: collected refs then mandatory shops/{shopId}/ sweep. */
export async function runPostCommitPublicBlobCleanup(
  shopId: string,
  collectedCanonicalUrls: string[],
): Promise<{
  collected: PublicBlobCleanupStats;
  sweep: Awaited<ReturnType<typeof sweepShopPrefixedPublicBlobsBestEffort>>;
}> {
  const collected = await deletePublicBlobUrlsBestEffort(collectedCanonicalUrls, shopId);
  const sweep = await sweepShopPrefixedPublicBlobsBestEffort(shopId);

  const failed =
    collected.failed + sweep.failed + (sweep.listFailed ? 1 : 0);
  if (failed > 0) {
    captureOpsMessage('Shop purge public Blob cleanup incomplete', {
      route: 'purge.public_blob_cleanup',
      shopId,
      level: 'warning',
      opsAlert: true,
      tags: {
        phase: 'public_cleanup',
        collectedAttempted: String(collected.attempted),
        collectedFailed: String(collected.failed),
        sweepAttempted: String(sweep.attempted),
        sweepFailed: String(sweep.failed),
        skippedCrossShop: String(collected.skippedCrossShop + sweep.skippedCrossShop),
      },
    });
  }

  return { collected, sweep };
}
