import { RecommendationJobStatus, RecommendationSetStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  MAX_JOB_ATTEMPTS,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  TAXONOMY_VERSION,
} from '@/lib/recommendations/constants';

import { deriveRecommendationHealthForShop, serviceRailWillRender } from './deriveRecommendationHealth';
import { PENDING_OVERDUE_MS, type DeriveRecommendationHealthInput } from './types';

const NOW = new Date('2026-09-06T12:00:00.000Z');
const SHOP = 'shop-1';
const MODEL = 'gpt-4o-mini';

function base(overrides: Partial<DeriveRecommendationHealthInput> = {}): DeriveRecommendationHealthInput {
  return {
    retail: { ok: true, reason: 'ok' },
    activeServiceCount: 3,
    activeProductCount: 5,
    state: {
      catalogueVersion: 2,
      publishedCatalogueVersion: 2,
      publishedSetId: 'set-1',
      pendingCatalogueVersion: null,
      rebuildAfter: null,
      jobStatus: RecommendationJobStatus.IDLE,
      processingLockExpiresAt: null,
      processingLockId: null,
      attemptCount: 0,
      nextAttemptAt: null,
      taxonomyVersion: TAXONOMY_VERSION,
      updatedAt: NOW,
    },
    publishedSet: {
      id: 'set-1',
      shopId: SHOP,
      status: RecommendationSetStatus.READY,
      catalogueVersion: 2,
      taxonomyVersion: TAXONOMY_VERSION,
      schemaVersion: SCHEMA_VERSION,
      promptVersion: PROMPT_VERSION,
      modelId: MODEL,
    },
    servicesWithReadableRail: 3,
    activeServicesConsidered: 3,
    currentTaxonomyVersion: TAXONOMY_VERSION,
    currentSchemaVersion: SCHEMA_VERSION,
    currentPromptVersion: PROMPT_VERSION,
    currentModelId: MODEL,
    maxJobAttempts: MAX_JOB_ATTEMPTS,
    ...overrides,
  };
}

describe('deriveRecommendationHealthForShop', () => {
  it('NOT_RETAIL_ELIGIBLE', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({ retail: { ok: false, reason: 'retail_disabled' } }),
      NOW,
    );
    expect(r.code).toBe('NOT_RETAIL_ELIGIBLE');
    expect(r.severity).toBe('INFO');
  });

  it('INSUFFICIENT_CATALOGUE', () => {
    expect(
      deriveRecommendationHealthForShop(SHOP, base({ activeProductCount: 1 }), NOW).code,
    ).toBe('INSUFFICIENT_CATALOGUE');
  });

  it('STATE_MISSING', () => {
    const r = deriveRecommendationHealthForShop(SHOP, base({ state: null, publishedSet: null }), NOW);
    expect(r.code).toBe('STATE_MISSING');
  });

  it('PENDING within window', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          jobStatus: RecommendationJobStatus.PENDING,
          rebuildAfter: new Date(NOW.getTime() - 60_000),
          publishedSetId: null,
        },
        publishedSet: null,
      }),
      NOW,
    );
    expect(r.code).toBe('PENDING');
  });

  it('PENDING_OVERDUE when rebuildAfter aged', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          jobStatus: RecommendationJobStatus.PENDING,
          rebuildAfter: new Date(NOW.getTime() - PENDING_OVERDUE_MS),
          publishedSetId: null,
        },
        publishedSet: null,
      }),
      NOW,
    );
    expect(r.code).toBe('PENDING_OVERDUE');
  });

  it('PENDING_OVERDUE when rebuildAfter missing', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          jobStatus: RecommendationJobStatus.PENDING,
          rebuildAfter: null,
          publishedSetId: null,
        },
        publishedSet: null,
      }),
      NOW,
    );
    expect(r.code).toBe('PENDING_OVERDUE');
    expect(r.severity).toBe('WARNING');
    expect(r.reasonCodes).toEqual(['PENDING_OVERDUE', 'pending_missing_rebuild_after']);
  });

  it('PROCESSING_LOCK_EXPIRED', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          jobStatus: RecommendationJobStatus.PROCESSING,
          processingLockId: 'lock-1',
          processingLockExpiresAt: new Date(NOW.getTime() - 1),
        },
      }),
      NOW,
    );
    expect(r.code).toBe('PROCESSING_LOCK_EXPIRED');
  });

  it('FAILED_RETRYING scheduled vs overdue', () => {
    const scheduled = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          jobStatus: RecommendationJobStatus.FAILED,
          attemptCount: 2,
          nextAttemptAt: new Date(NOW.getTime() + 60_000),
        },
      }),
      NOW,
    );
    expect(scheduled.code).toBe('FAILED_RETRYING');
    expect(scheduled.reasonCodes).toContain('retry_scheduled');

    const overdue = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          jobStatus: RecommendationJobStatus.FAILED,
          attemptCount: 2,
          nextAttemptAt: new Date(NOW.getTime() - PENDING_OVERDUE_MS),
        },
      }),
      NOW,
    );
    expect(overdue.code).toBe('FAILED_RETRYING');
    expect(overdue.reasonCodes).toContain('retry_overdue');
  });

  it('FAILED_EXHAUSTED', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          jobStatus: RecommendationJobStatus.FAILED,
          attemptCount: MAX_JOB_ATTEMPTS,
          nextAttemptAt: null,
        },
      }),
      NOW,
    );
    expect(r.code).toBe('FAILED_EXHAUSTED');
  });

  it('STALE on schema/prompt/model mismatch with WARNING when set readable', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        publishedSet: {
          ...base().publishedSet!,
          schemaVersion: '1',
          promptVersion: 'old',
          modelId: 'other-model',
        },
      }),
      NOW,
    );
    expect(r.code).toBe('STALE');
    expect(r.severity).toBe('WARNING');
    expect(r.reasonCodes).toEqual(
      expect.arrayContaining(['schema_mismatch', 'prompt_mismatch', 'model_mismatch']),
    );
  });

  it('STALE CRITICAL when metadata stale and published set missing', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        state: {
          ...base().state!,
          catalogueVersion: 5,
          publishedCatalogueVersion: 2,
        },
        publishedSet: null,
      }),
      NOW,
    );
    expect(r.code).toBe('STALE');
    expect(r.severity).toBe('CRITICAL');
  });

  it('PUBLISHED_SET_INVALID wrong shop', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({
        publishedSet: { ...base().publishedSet!, shopId: 'other' },
      }),
      NOW,
    );
    expect(r.code).toBe('PUBLISHED_SET_INVALID');
    expect(r.reasonCodes).toContain('published_set_wrong_shop');
  });

  it('READY_NO_RAILS is WARNING', () => {
    const r = deriveRecommendationHealthForShop(
      SHOP,
      base({ servicesWithReadableRail: 0, activeServicesConsidered: 3 }),
      NOW,
    );
    expect(r.code).toBe('READY_NO_RAILS');
    expect(r.severity).toBe('WARNING');
  });

  it('READY_PARTIAL and HEALTHY', () => {
    expect(
      deriveRecommendationHealthForShop(
        SHOP,
        base({ servicesWithReadableRail: 1, activeServicesConsidered: 3 }),
        NOW,
      ).code,
    ).toBe('READY_PARTIAL');
    expect(deriveRecommendationHealthForShop(SHOP, base(), NOW).code).toBe('HEALTHY');
  });
});

describe('serviceRailWillRender', () => {
  it('uses shared threshold of 2', () => {
    expect(serviceRailWillRender(1)).toBe(false);
    expect(serviceRailWillRender(2)).toBe(true);
  });
});
