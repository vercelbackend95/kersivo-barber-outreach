import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/db/client';
import { isPauseActiveNow } from '@/lib/admin/shopPublicActivity';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { canSellRetail } from '@/lib/shop/cardPaymentsGate';
import { RecommendationSetStatus } from '@prisma/client';

import { MAX_SERVICE_IDS } from './constants';
import type { PublicRecommendationProductV1, PublicRecommendationResponseV1 } from './contracts';
import { shouldRenderRecommendations } from './scorer';

export type ReadRecommendationsInput = {
  shopId: string;
  serviceIds: string[];
};

export type ReadRecommendationsResult =
  | { ok: true; response: PublicRecommendationResponseV1 }
  | { ok: false; status: number; error: string };

function emptyResponse(
  shopId: string,
  serviceIds: string[],
): PublicRecommendationResponseV1 {
  return {
    ok: true,
    shopId,
    serviceIds,
    products: [],
    exposureId: randomUUID(),
  };
}

export async function readPublishedRecommendations(
  input: ReadRecommendationsInput,
): Promise<ReadRecommendationsResult> {
  const shopId = input.shopId.trim();
  const serviceIds = [...new Set(input.serviceIds.map((id) => id.trim()).filter(Boolean))];

  if (!shopId || serviceIds.length === 0) {
    return { ok: false, status: 400, error: 'shopId and serviceId are required.' };
  }

  if (serviceIds.length > MAX_SERVICE_IDS) {
    return { ok: false, status: 400, error: `At most ${MAX_SERVICE_IDS} serviceId values are allowed.` };
  }

  if (shopId === DEMO_SHOP_ID) {
    return { ok: false, status: 404, error: 'Shop not found.' };
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      retailEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      publicActivityPaused: true,
      publicActivityPauseFrom: true,
      publicActivityPauseUntil: true,
      publicActivityPauseReason: true,
      timezone: true,
    },
  });
  if (!shop) {
    return { ok: false, status: 404, error: 'Shop not found.' };
  }

  if (!canSellRetail(shop) || isPauseActiveNow(shop)) {
    return { ok: true, response: emptyResponse(shopId, serviceIds) };
  }

  const ownedServices = await prisma.service.findMany({
    where: { shopId, id: { in: serviceIds }, isActive: true },
    select: { id: true },
  });
  if (ownedServices.length !== serviceIds.length) {
    return { ok: true, response: emptyResponse(shopId, serviceIds) };
  }

  const state = await prisma.shopRecommendationState.findUnique({
    where: { shopId },
    select: { publishedSetId: true },
  });

  if (!state?.publishedSetId) {
    return { ok: true, response: emptyResponse(shopId, serviceIds) };
  }

  const publishedSet = await prisma.recommendationSet.findFirst({
    where: {
      id: state.publishedSetId,
      shopId,
      status: RecommendationSetStatus.READY,
    },
    select: { id: true },
  });

  if (!publishedSet) {
    return { ok: true, response: emptyResponse(shopId, serviceIds) };
  }

  const items = await prisma.recommendationSetItem.findMany({
    where: {
      setId: publishedSet.id,
      shopId,
      serviceId: serviceIds.length === 1 ? serviceIds[0] : { in: serviceIds },
    },
    orderBy: [{ serviceId: 'asc' }, { rank: 'asc' }],
    select: {
      productId: true,
      rank: true,
      deterministicScore: true,
    },
  });

  if (items.length === 0) {
    return { ok: true, response: emptyResponse(shopId, serviceIds) };
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { shopId, id: { in: productIds }, active: true },
    select: {
      id: true,
      name: true,
      pricePence: true,
      category: true,
      imageUrl: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  const merged = new Map<string, { rank: number; score: number; product: (typeof products)[number] }>();
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const existing = merged.get(item.productId);
    if (!existing || item.deterministicScore > existing.score) {
      merged.set(item.productId, { rank: item.rank, score: item.deterministicScore, product });
    }
  }

  const ordered = [...merged.values()]
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .slice(0, 4)
    .map(({ product }) => product);

  if (!shouldRenderRecommendations(ordered.length)) {
    return { ok: true, response: emptyResponse(shopId, serviceIds) };
  }

  const dto: PublicRecommendationProductV1[] = ordered.map((p) => ({
    id: p.id,
    name: p.name,
    pricePence: p.pricePence,
    category: p.category,
    imageUrl: p.imageUrl,
    available: true,
    requiresOptions: false,
  }));

  return {
    ok: true,
    response: {
      ok: true,
      shopId,
      serviceIds,
      products: dto,
      exposureId: randomUUID(),
    },
  };
}
