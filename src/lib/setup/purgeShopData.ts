import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { deletePrivateOnboardingFile } from '@/lib/storage/privateOnboardingBlob';
import { isPrivateNoteBlobPathname } from '@/lib/storage/storeNoteImage';

type Tx = Prisma.TransactionClient;

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
      console.error(`[purge] private blob delete failed for ${path}`, error);
    }
  }
}
