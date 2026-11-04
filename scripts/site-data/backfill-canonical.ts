/**
 * Backfill business data into its canonical places (docs/site-data-contract.md §Migration).
 *
 *   npx tsx scripts/site-data/backfill-canonical.ts            # dry run (default): prints the plan
 *   npx tsx scripts/site-data/backfill-canonical.ts --apply    # writes a JSON backup, then applies
 *   npx tsx scripts/site-data/backfill-canonical.ts --shop <id> [--apply]
 *
 * Idempotent: fills only empty canonical fields; a second run plans nothing. Never deletes.
 * Requires the 20261104120000_site_data_contract migration to be deployed first.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { isEmptyPlan, planShopBackfill, type BackfillShopPlan } from '../../src/lib/shopData/backfill';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const shopArg = process.argv.indexOf('--shop');
const onlyShopId = shopArg > -1 ? process.argv[shopArg + 1] : undefined;

async function loadShops() {
  return prisma.shopSettings.findMany({
    where: { purgeStartedAt: null, ...(onlyShopId ? { id: onlyShopId } : {}) },
    select: {
      id: true,
      name: true,
      townCity: true,
      publicProfile: true,
      clientOnboarding: true,
      previewRequest: {
        select: { aboutText: true, instagramUrl: true, brandPrimaryColour: true, brandSecondaryColour: true },
      },
      barbers: {
        select: {
          id: true,
          bio: true,
          showOnWebsite: true,
          updatedAt: true,
          clientOnboardingProfile: { select: { bio: true, showOnWebsite: true, updatedAt: true } },
        },
      },
    },
  });
}

async function main() {
  const shops = await loadShops();
  const plans: Array<BackfillShopPlan & { name: string }> = [];
  for (const shop of shops) {
    const plan = planShopBackfill({
      shopId: shop.id,
      townCity: shop.townCity,
      profile: shop.publicProfile,
      onboarding: shop.clientOnboarding,
      previewRequest: shop.previewRequest,
      barbers: shop.barbers.map((b) => ({ ...b, onboardingProfile: b.clientOnboardingProfile })),
    });
    if (!isEmptyPlan(plan)) plans.push({ ...plan, name: shop.name });
  }

  console.info(`[site-data backfill] ${shops.length} shop(s) checked, ${plans.length} need changes.`);
  for (const plan of plans) {
    console.info(
      `  ${plan.shopId} (${plan.name}): profile fields [${Object.keys(plan.profileFill).join(', ') || '-'}]` +
        `${plan.townCity ? `, townCity` : ''}, barbers ${plan.barberUpdates.length}`,
    );
  }

  if (!apply) {
    console.info('[site-data backfill] Dry run. Re-run with --apply to write.');
    return;
  }
  if (plans.length === 0) return;

  // Backup of the current canonical values for every row we are about to touch.
  const dir = join(process.cwd(), 'tmp', 'site-data-backfill');
  mkdirSync(dir, { recursive: true });
  const backupPath = join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const shopIds = plans.map((p) => p.shopId);
  const barberIds = plans.flatMap((p) => p.barberUpdates.map((b) => b.id));
  const backup = {
    createdAt: new Date().toISOString(),
    plans,
    profiles: await prisma.shopPublicProfile.findMany({ where: { shopId: { in: shopIds } } }),
    shops: await prisma.shopSettings.findMany({ where: { id: { in: shopIds } }, select: { id: true, townCity: true } }),
    barbers: await prisma.barber.findMany({
      where: { id: { in: barberIds } },
      select: { id: true, bio: true, showOnWebsite: true },
    }),
  };
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.info(`[site-data backfill] Backup written to ${backupPath}`);

  for (const plan of plans) {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(plan.profileFill).length) {
        // Re-check emptiness inside the transaction so a concurrent owner edit is never overwritten.
        const current = await tx.shopPublicProfile.findUnique({ where: { shopId: plan.shopId } });
        const fill = Object.fromEntries(
          Object.entries(plan.profileFill).filter(([k]) => {
            const v = current ? (current as Record<string, unknown>)[k] : null;
            return v === null || v === undefined || v === '';
          }),
        );
        if (Object.keys(fill).length) {
          await tx.shopPublicProfile.upsert({
            where: { shopId: plan.shopId },
            create: { shopId: plan.shopId, ...fill },
            update: fill,
          });
        }
      }
      if (plan.townCity) {
        await tx.shopSettings.updateMany({ where: { id: plan.shopId, townCity: null }, data: { townCity: plan.townCity } });
      }
      for (const barber of plan.barberUpdates) {
        await tx.barber.update({ where: { id: barber.id }, data: barber.data });
      }
    });
  }
  console.info(`[site-data backfill] Applied to ${plans.length} shop(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
