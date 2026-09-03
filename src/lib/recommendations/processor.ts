import {
  RecommendationJobStatus,
  RecommendationSetStatus,
  type Prisma,
} from '@prisma/client';

import { prisma } from '@/lib/db/client';
import { notifyOpsDurable } from '@/lib/ops/stripeWebhookLedger';
import { opsLog, opsLogError } from '@/lib/ops/opsLog';

import {
  classifyProductEntity,
  classifyServiceEntity,
  createRecommendationOpenAiClient,
  rerankEligibleCandidates,
  resolveRecommendationModel,
} from './ai/classify';
import {
  buildProductProfileEnvelope,
  buildServiceProfileEnvelope,
  CLASSIFIER_PROMPT_VERSION,
} from './ai/prompts';
import {
  MAX_JOB_ATTEMPTS,
  MAX_PER_PRODUCT_FAMILY,
  MAX_RECOMMENDATIONS,
  SCHEMA_VERSION,
  TAXONOMY_VERSION,
} from './constants';
import type {
  ProductSemanticProfileV2,
  RecommendationSetStats,
  ServiceSemanticProfileV2,
} from './contracts';
import { computeProductSemanticHash, computeServiceSemanticHash } from './hash';
import { isStoredProfileReusable } from './profileReuse';
import { applyBoundedRerank } from './boundedRerank';
import { selectDiverseCandidates } from './candidateSelection';
import {
  buildCandidateRerankSummary,
  buildServiceRerankSummary,
} from './rerankPayload';
import { createRerankPool } from './rerankPool';
import { createEmptyRerankStats, recordRerankFallback } from './rerankStats';
import { scoreEligibleCandidatesForService } from './scorer';
import {
  acquireShopLock,
  buildOwnedStateWhere,
  claimOwnedFailure,
  markSetTerminal,
  releaseOwnedLock,
  StaleBuildError,
  STALE_BUILD_ERROR_CODE,
  type OwnedWorkerContext,
} from './workerOwnership';

function profileFromJson<T>(json: unknown): T {
  return json as T;
}

export type ProcessorSummary = {
  shopsProcessed: number;
  shopsSucceeded: number;
  shopsFailed: number;
};

async function publishAtomically(
  ctx: OwnedWorkerContext,
  setId: string,
  stats: RecommendationSetStats,
  rerankModelId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.shopRecommendationState.updateMany({
      where: buildOwnedStateWhere(ctx),
      data: {
        publishedSetId: setId,
        publishedCatalogueVersion: ctx.targetVersion,
        pendingCatalogueVersion: null,
        rebuildAfter: null,
        jobStatus: RecommendationJobStatus.IDLE,
        processingLockId: null,
        processingLockExpiresAt: null,
        processingCatalogueVersion: null,
        attemptCount: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });

    if (claimed.count !== 1) {
      throw new StaleBuildError();
    }

    await tx.recommendationSet.update({
      where: { id: setId },
      data: {
        status: RecommendationSetStatus.READY,
        buildFinishedAt: new Date(),
        stats,
        rerankModelId,
      },
    });

    await tx.recommendationSet.updateMany({
      where: {
        shopId: ctx.shopId,
        status: RecommendationSetStatus.READY,
        id: { not: setId },
      },
      data: { status: RecommendationSetStatus.SUPERSEDED },
    });
  });
}

async function handleStaleBuild(ctx: OwnedWorkerContext, setId: string): Promise<void> {
  await markSetTerminal(setId, RecommendationSetStatus.SUPERSEDED, STALE_BUILD_ERROR_CODE);
  await releaseOwnedLock(ctx);
}

async function loadOrClassifyProfiles(
  shopId: string,
  modelId: string,
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string | null;
  }>,
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
  }>,
) {
  const client = createRecommendationOpenAiClient();
  if (!client) {
    throw new Error('MISSING_OPENAI_KEY');
  }

  const [existingServiceProfiles, existingProductProfiles] = await Promise.all([
    prisma.serviceSemanticProfile.findMany({ where: { shopId } }),
    prisma.productSemanticProfile.findMany({ where: { shopId } }),
  ]);

  const serviceProfileMap = new Map<string, ServiceSemanticProfileV2>();
  const productProfileMap = new Map<string, ProductSemanticProfileV2>();

  for (const service of services) {
    const hash = computeServiceSemanticHash({
      name: service.name,
      description: service.description,
      category: service.category,
    });
    const existing = existingServiceProfiles.find((p) => p.serviceId === service.id);
    if (
      existing &&
      isStoredProfileReusable(existing, {
        contentHash: hash,
        taxonomyVersion: TAXONOMY_VERSION,
        schemaVersion: SCHEMA_VERSION,
        promptVersion: CLASSIFIER_PROMPT_VERSION,
        modelId,
      })
    ) {
      serviceProfileMap.set(service.id, profileFromJson(existing.profile));
      continue;
    }

    const classified = await classifyServiceEntity(client, {
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category ?? '',
    });
    if (!classified.ok) throw new Error(`SERVICE_CLASSIFY_FAILED:${classified.error}`);

    const envelope = buildServiceProfileEnvelope(
      {
        entityId: service.id,
        shopId,
        name: service.name,
        description: service.description,
        category: service.category,
      },
      classified.data,
      modelId,
    );

    await prisma.serviceSemanticProfile.upsert({
      where: { serviceId: service.id },
      create: {
        shopId,
        serviceId: service.id,
        contentHash: envelope.contentHash,
        taxonomyVersion: envelope.taxonomyVersion,
        schemaVersion: envelope.schemaVersion,
        profile: envelope as unknown as Prisma.InputJsonValue,
        confidence: envelope.confidence,
        modelId,
        promptVersion: CLASSIFIER_PROMPT_VERSION,
        classifiedAt: new Date(envelope.classifiedAt),
      },
      update: {
        contentHash: envelope.contentHash,
        taxonomyVersion: envelope.taxonomyVersion,
        schemaVersion: envelope.schemaVersion,
        profile: envelope as unknown as Prisma.InputJsonValue,
        confidence: envelope.confidence,
        modelId,
        promptVersion: CLASSIFIER_PROMPT_VERSION,
        classifiedAt: new Date(envelope.classifiedAt),
      },
    });

    serviceProfileMap.set(service.id, envelope);
  }

  for (const product of products) {
    const hash = computeProductSemanticHash({
      name: product.name,
      description: product.description,
      category: product.category,
    });
    const existing = existingProductProfiles.find((p) => p.productId === product.id);
    if (
      existing &&
      isStoredProfileReusable(existing, {
        contentHash: hash,
        taxonomyVersion: TAXONOMY_VERSION,
        schemaVersion: SCHEMA_VERSION,
        promptVersion: CLASSIFIER_PROMPT_VERSION,
        modelId,
      })
    ) {
      productProfileMap.set(product.id, profileFromJson(existing.profile));
      continue;
    }

    const classified = await classifyProductEntity(client, {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
    });
    if (!classified.ok) throw new Error(`PRODUCT_CLASSIFY_FAILED:${classified.error}`);

    const envelope = buildProductProfileEnvelope(
      {
        entityId: product.id,
        shopId,
        name: product.name,
        description: product.description,
        category: product.category,
      },
      classified.data,
      modelId,
    );

    await prisma.productSemanticProfile.upsert({
      where: { productId: product.id },
      create: {
        shopId,
        productId: product.id,
        contentHash: envelope.contentHash,
        taxonomyVersion: envelope.taxonomyVersion,
        schemaVersion: envelope.schemaVersion,
        profile: envelope as unknown as Prisma.InputJsonValue,
        confidence: envelope.confidence,
        modelId,
        promptVersion: CLASSIFIER_PROMPT_VERSION,
        classifiedAt: new Date(envelope.classifiedAt),
      },
      update: {
        contentHash: envelope.contentHash,
        taxonomyVersion: envelope.taxonomyVersion,
        schemaVersion: envelope.schemaVersion,
        profile: envelope as unknown as Prisma.InputJsonValue,
        confidence: envelope.confidence,
        modelId,
        promptVersion: CLASSIFIER_PROMPT_VERSION,
        classifiedAt: new Date(envelope.classifiedAt),
      },
    });

    productProfileMap.set(product.id, envelope);
  }

  return { serviceProfileMap, productProfileMap, client };
}

async function buildRecommendationItems(
  shopId: string,
  setId: string,
  activeServices: Array<{ id: string }>,
  activeProducts: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
  serviceProfileMap: Map<string, ServiceSemanticProfileV2>,
  productProfileMap: Map<string, ProductSemanticProfileV2>,
  client: Awaited<ReturnType<typeof createRecommendationOpenAiClient>>,
): Promise<{
  items: Prisma.RecommendationSetItemCreateManyInput[];
  rerankStats: RecommendationSetStats;
  rerankModelId: string | null;
}> {
  const itemsToCreate: Prisma.RecommendationSetItemCreateManyInput[] = [];
  const rerankStats = createEmptyRerankStats();
  let rerankModelId: string | null = null;

  for (const service of activeServices) {
    const serviceProfile = serviceProfileMap.get(service.id);
    if (!serviceProfile) continue;

    const eligible = scoreEligibleCandidatesForService(serviceProfile, activeProducts);
    if (eligible.length > 0) {
      rerankStats.rerankEligibleServiceCount += 1;
    }

    const rerankPool = createRerankPool(eligible);
    const rerankPoolIds = rerankPool.map((candidate) => candidate.productId);
    let candidatesForSelection = eligible;

    if (!client || rerankPool.length < 2) {
      if (client && eligible.length > 0 && rerankPool.length < 2) {
        rerankStats.rerankSkippedInsufficientCandidatesCount += 1;
      }
    } else {
      rerankStats.rerankAttemptedServiceCount += 1;
      if (!rerankModelId) {
        rerankModelId = resolveRecommendationModel();
      }

      try {
        const reranked = await rerankEligibleCandidates(
          client,
          service.id,
          buildServiceRerankSummary(serviceProfile),
          rerankPool.map((candidate) => {
            const profile = productProfileMap.get(candidate.productId);
            if (!profile) {
              throw new Error('RERANK_MISSING_PRODUCT_PROFILE');
            }
            return {
              id: candidate.productId,
              summary: buildCandidateRerankSummary(candidate, profile),
            };
          }),
        );

        if (!reranked.ok) {
          recordRerankFallback(rerankStats, reranked.error);
        } else {
          const bounded = applyBoundedRerank(eligible, rerankPoolIds, reranked.data);
          if (bounded.applied) {
            rerankStats.rerankAppliedServiceCount += 1;
            candidatesForSelection = bounded.candidates;
          } else {
            recordRerankFallback(rerankStats, bounded.reasonCode);
          }
        }
      } catch {
        recordRerankFallback(rerankStats, 'RERANK_UNEXPECTED_FAILURE');
      }
    }

    const ranked = selectDiverseCandidates(
      candidatesForSelection,
      MAX_RECOMMENDATIONS,
      MAX_PER_PRODUCT_FAMILY,
      serviceProfile,
    );

    ranked.forEach((item, index) => {
      itemsToCreate.push({
        setId,
        shopId,
        serviceId: service.id,
        productId: item.productId,
        rank: index + 1,
        deterministicScore: item.deterministicScore,
        rerankPosition: item.rerankPosition ?? null,
        reasonCodes: item.reasonCodes,
        confidenceGate: item.confidenceGate,
      });
    });
  }

  return {
    items: itemsToCreate,
    rerankStats: {
      serviceCount: activeServices.length,
      productCount: activeProducts.length,
      itemCount: itemsToCreate.length,
      ...rerankStats,
    },
    rerankModelId,
  };
}

async function processShop(shopId: string, targetVersion: number): Promise<boolean> {
  const lockId = await acquireShopLock(shopId, targetVersion);
  if (!lockId) return false;

  const ctx: OwnedWorkerContext = { shopId, lockId, targetVersion };
  let currentSetId: string | null = null;

  try {
    const [activeServices, activeProductsRaw] = await Promise.all([
      prisma.service.findMany({
        where: { shopId, isActive: true },
        select: { id: true, name: true, description: true, category: true },
      }),
      prisma.product.findMany({
        where: { shopId, active: true },
        select: { id: true, name: true, description: true, category: true },
      }),
    ]);

    const set = await prisma.recommendationSet.create({
      data: {
        shopId,
        catalogueVersion: targetVersion,
        taxonomyVersion: TAXONOMY_VERSION,
        schemaVersion: SCHEMA_VERSION,
        status: RecommendationSetStatus.BUILDING,
        modelId: resolveRecommendationModel(),
        promptVersion: CLASSIFIER_PROMPT_VERSION,
        buildStartedAt: new Date(),
      },
    });
    currentSetId = set.id;

    let itemsToCreate: Prisma.RecommendationSetItemCreateManyInput[] = [];
    let serviceProfileMap = new Map<string, ServiceSemanticProfileV2>();
    let productProfileMap = new Map<string, ProductSemanticProfileV2>();
    let client: Awaited<ReturnType<typeof createRecommendationOpenAiClient>> = null;
    let rerankStats: RecommendationSetStats = {
      ...createEmptyRerankStats(),
      serviceCount: activeServices.length,
      productCount: activeProductsRaw.length,
      itemCount: 0,
    };
    let rerankModelId: string | null = null;

    if (activeServices.length > 0 && activeProductsRaw.length >= 2) {
      const classified = await loadOrClassifyProfiles(
        shopId,
        resolveRecommendationModel(),
        activeServices,
        activeProductsRaw,
      );
      serviceProfileMap = classified.serviceProfileMap;
      productProfileMap = classified.productProfileMap;
      client = classified.client;

      const activeProducts = activeProductsRaw
        .map((p) => ({
          id: p.id,
          profile: productProfileMap.get(p.id)!,
        }))
        .filter((p) => p.profile);

      const built = await buildRecommendationItems(
        shopId,
        set.id,
        activeServices,
        activeProducts,
        serviceProfileMap,
        productProfileMap,
        client,
      );
      itemsToCreate = built.items;
      rerankStats = built.rerankStats;
      rerankModelId = built.rerankModelId;
    }

    if (itemsToCreate.length > 0) {
      await prisma.recommendationSetItem.createMany({ data: itemsToCreate });
    }

    await publishAtomically(ctx, set.id, rerankStats, rerankModelId);

    opsLog('recommendations.processor', 'published', { shopId, version: targetVersion });
    return true;
  } catch (error) {
    if (error instanceof StaleBuildError) {
      if (currentSetId) await handleStaleBuild(ctx, currentSetId);
      return false;
    }

    opsLogError('recommendations.processor', 'shop_failed', error, { shopId });
    const code = error instanceof Error ? error.message : 'PROCESSOR_FAILED';
    const failure = await claimOwnedFailure(ctx, currentSetId, code);

    if (failure.outcome === 'stale') {
      if (currentSetId) {
        await handleStaleBuild(ctx, currentSetId);
      } else {
        await releaseOwnedLock(ctx);
      }
    } else if (failure.exhausted) {
      await notifyOpsDurable({
        severity: 'critical',
        title: 'Recommendation rebuild exhausted retries',
        body: code.slice(0, 500),
        dedupeKey: `recommendations:failed:${shopId}`,
        fields: { shopId, attempts: failure.attempts },
      });
    }

    return false;
  }
}

export async function processDueRecommendationRebuilds(now = new Date()): Promise<ProcessorSummary> {
  const due = await prisma.shopRecommendationState.findMany({
    where: {
      OR: [
        {
          jobStatus: RecommendationJobStatus.PENDING,
          pendingCatalogueVersion: { not: null },
          rebuildAfter: { lte: now },
        },
        {
          jobStatus: RecommendationJobStatus.FAILED,
          nextAttemptAt: { lte: now },
          pendingCatalogueVersion: { not: null },
          attemptCount: { lt: MAX_JOB_ATTEMPTS },
        },
        {
          jobStatus: RecommendationJobStatus.PROCESSING,
          processingLockExpiresAt: { lt: now },
        },
      ],
    },
    select: {
      shopId: true,
      pendingCatalogueVersion: true,
      catalogueVersion: true,
    },
    take: 5,
  });

  let shopsSucceeded = 0;
  let shopsFailed = 0;

  for (const row of due) {
    const targetVersion = row.pendingCatalogueVersion ?? row.catalogueVersion;
    const ok = await processShop(row.shopId, targetVersion);
    if (ok) shopsSucceeded += 1;
    else shopsFailed += 1;
  }

  return {
    shopsProcessed: due.length,
    shopsSucceeded,
    shopsFailed,
  };
}

/** @internal Test-only export */
export { processShop };
