import { describe, expect, it } from 'vitest';

import { getCalibrationCatalogue } from './calibration/dataset/catalogue';
import { buildCalibrationStubProfiles } from './calibration/dataset/stubProfiles';
import { checkServiceConfidenceGates } from './confidenceGates';
import {
  CRITICAL_FIELD_CONFIDENCE_MIN,
  MATCH_SCORE_MIN,
  SOURCE_EVIDENCE_CONFIDENCE,
  TAXONOMY_VERSION,
} from './constants';
import type {
  ProductSemanticProfileAiV2,
  ProductSemanticProfileV2,
  ServiceSemanticProfileAiV2,
  ServiceSemanticProfileV2,
} from './contracts';
import { canonicalizeProductDraftFromSource } from './canonicalizeProductDraft';
import { applyExplicitHairLengthToProductDraft } from './explicitHairLengthRestriction';
import { evaluateHardEligibility } from './hardEligibility';
import { evaluateServiceProductPair } from './pairEvaluation';
import { computeDeterministicScore } from './scoreComponents';
import { buildRankedRecommendationsForService } from './scorer';
import {
  inferServiceSemanticEvidence,
  mergeServiceSemanticEvidence,
} from './serviceSemanticEvidence';

function weakHairBeardDraft(): ServiceSemanticProfileAiV2 {
  return {
    targetAreas: ['HAIR', 'BEARD'],
    typicalHairLength: 'UNKNOWN',
    techniques: ['UNKNOWN'],
    outcomes: ['UNKNOWN'],
    aftercareNeeds: ['UNKNOWN'],
    incompatibilities: [],
    retailNeeds: ['UNKNOWN'],
    confidence: 0.7,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.5 },
    evidenceCodes: [],
    warnings: [],
  };
}

function toServiceEnvelope(
  entityId: string,
  draft: ServiceSemanticProfileAiV2,
  source: { name: string; description: string | null; category: string | null },
): ServiceSemanticProfileV2 {
  return {
    ...draft,
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId,
    shopId: 'shop',
    contentHash: 'hash',
    sourceSnapshot: {
      name: source.name,
      description: source.description,
      category: source.category,
    },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
  };
}

function toProductEnvelope(
  entityId: string,
  draft: ProductSemanticProfileAiV2,
  source: { name: string; description: string | null; category: string | null },
): ProductSemanticProfileV2 {
  return {
    ...draft,
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId,
    shopId: 'shop',
    contentHash: 'hash',
    sourceSnapshot: {
      name: source.name,
      description: source.description,
      category: source.category ?? '',
    },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
  };
}

describe('serviceSemanticEvidence', () => {
  it('infers Haircut & Beard family', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Haircut & Beard',
      description: 'Haircut plus beard trim combo.',
      category: 'combo',
    });
    expect(inference).not.toBeNull();
    expect(inference?.targetAreas).toEqual(['HAIR', 'BEARD']);
    expect(inference?.retailNeeds).toEqual([
      'HAIR_STYLING_CONTROL',
      'BEARD_SOFTENING',
      'BEARD_SHAPING',
    ]);
  });

  it('does not invent styling for Buzz Cut', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Buzz Cut',
      description: 'Uniform clipper cut',
      category: 'cuts',
    });
    expect(inference).not.toBeNull();
    expect(inference?.targetAreas).toEqual(['HAIR']);
    expect(inference?.retailNeeds).toEqual([]);
    expect(inference?.retailNeeds).not.toContain('HAIR_STYLING_CONTROL');
  });

  it('enriches weak Haircut & Beard AI draft to usable confidence', () => {
    const merged = mergeServiceSemanticEvidence(weakHairBeardDraft(), {
      name: 'Haircut & Beard',
      description: 'Haircut plus beard trim combo.',
      category: 'combo',
    });
    expect(merged.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(merged.retailNeeds).toEqual(
      expect.arrayContaining(['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING', 'BEARD_SHAPING']),
    );
    expect(merged.retailNeeds).not.toContain('UNKNOWN');
    expect(merged.typicalHairLength).toBe('UNKNOWN');
    expect(merged.fieldConfidence.retailNeeds).toBeGreaterThanOrEqual(SOURCE_EVIDENCE_CONFIDENCE);
    expect(merged.fieldConfidence.retailNeeds).toBeGreaterThanOrEqual(CRITICAL_FIELD_CONFIDENCE_MIN);
    expect(merged.confidence).toBeGreaterThanOrEqual(0.75);

    const service = toServiceEnvelope('cal-svc-hair-beard', merged, {
      name: 'Haircut & Beard',
      description: 'Haircut plus beard trim combo.',
      category: 'combo',
    });
    expect(checkServiceConfidenceGates(service)).toBeNull();
  });
});

describe('source-constraint pair regressions', () => {
  const catalogue = getCalibrationCatalogue();
  const hairBeardEntity = catalogue.services.find((s) => s.id === 'cal-svc-hair-beard')!;
  const matteEntity = catalogue.products.find((p) => p.id === 'cal-prod-matte-clay')!;
  const shortOnlyEntity = catalogue.products.find((p) => p.id === 'cal-prod-short-only-clay')!;
  const longShampooEntity = catalogue.products.find((p) => p.id === 'cal-prod-long-shampoo')!;

  function enrichedHairBeardService(): ServiceSemanticProfileV2 {
    return toServiceEnvelope(
      'cal-svc-hair-beard',
      mergeServiceSemanticEvidence(weakHairBeardDraft(), hairBeardEntity),
      hairBeardEntity,
    );
  }

  function sourceProduct(
    entityId: string,
    entity: { name: string; description: string | null; category: string | null },
    aiDraft: ProductSemanticProfileAiV2,
  ): ProductSemanticProfileV2 {
    const applied = applyExplicitHairLengthToProductDraft(aiDraft, entity);
    if (!applied.ok) throw new Error(applied.error);
    return toProductEnvelope(entityId, applied.draft, entity);
  }

  it('Haircut & Beard × Beard Oil is eligible with beard overlap', () => {
    const stubs = buildCalibrationStubProfiles();
    const service = enrichedHairBeardService();
    const product = stubs.products.get('cal-prod-beard-oil')!;

    const hard = evaluateHardEligibility(service, product);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;
    expect(hard.context.matchedAreas).toContain('BEARD');
    expect(hard.context.overlapNeeds).toContain('BEARD_SOFTENING');

    const scored = computeDeterministicScore(service, product, hard.context);
    expect(scored.breakdown.hairLengthApplicable).toBe(false);
    expect(scored.score).toBeGreaterThanOrEqual(MATCH_SCORE_MIN);
  });

  it('Haircut & Beard × Matte Clay is eligible with styling overlap', () => {
    const service = enrichedHairBeardService();
    const product = sourceProduct('cal-prod-matte-clay', matteEntity, {
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      productFamily: 'CLAY',
      benefits: ['HOLD'],
      holdStrength: 'STRONG',
      finish: 'MATTE',
      incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
      confidence: 0.92,
      fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
      evidenceCodes: [],
      warnings: [],
    });

    const hard = evaluateHardEligibility(service, product);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;
    expect(hard.context.matchedAreas).toContain('HAIR');
    expect(hard.context.overlapNeeds).toContain('HAIR_STYLING_CONTROL');

    const scored = computeDeterministicScore(service, product, hard.context);
    expect(scored.breakdown.hairLengthApplicable).toBe(false);
    expect(scored.reasonCodes).toContain('HAIR_LENGTH_UNKNOWN_NOT_USED');
    expect(scored.score).toBeGreaterThanOrEqual(MATCH_SCORE_MIN);
  });

  it('Haircut & Beard selection covers HAIR and BEARD and is input-order deterministic', () => {
    const stubs = buildCalibrationStubProfiles();
    const service = enrichedHairBeardService();
    const products = [
      stubs.products.get('cal-prod-matte-clay')!,
      stubs.products.get('cal-prod-beard-oil')!,
      stubs.products.get('cal-prod-pomade')!,
      stubs.products.get('cal-prod-beard-balm')!,
      stubs.products.get('cal-prod-multi-balm')!,
    ].map((profile) => ({ id: profile.entityId, profile }));

    const reversed = [...products].reverse();
    const rankedA = buildRankedRecommendationsForService(service, products);
    const rankedB = buildRankedRecommendationsForService(service, reversed);

    const areasA = new Set(rankedA.flatMap((c) => c.matchedAreas));
    expect(areasA.has('HAIR')).toBe(true);
    expect(areasA.has('BEARD')).toBe(true);
    expect(rankedA.map((c) => c.productId)).toEqual(rankedB.map((c) => c.productId));
  });

  it('Haircut & Beard selects multi-balm, keeps Beard Oil eligible, excludes kids gel', () => {
    const stubs = buildCalibrationStubProfiles();
    const service = enrichedHairBeardService();
    const multiBalm = stubs.products.get('cal-prod-multi-balm')!;
    const beardOil = stubs.products.get('cal-prod-beard-oil')!;
    const kidsGel = stubs.products.get('cal-prod-kids-gel')!;
    const specialists = [
      stubs.products.get('cal-prod-matte-clay')!,
      stubs.products.get('cal-prod-beard-balm')!,
      stubs.products.get('cal-prod-pomade')!,
    ];

    expect(multiBalm.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(
      evaluateServiceProductPair({
        service,
        product: multiBalm,
        productId: multiBalm.entityId,
      }).eligible,
    ).toBe(true);
    expect(
      evaluateServiceProductPair({
        service,
        product: beardOil,
        productId: beardOil.entityId,
      }).eligible,
    ).toBe(true);
    const kidsPair = evaluateServiceProductPair({
      service,
      product: kidsGel,
      productId: kidsGel.entityId,
    });
    expect(kidsPair.eligible).toBe(false);
    if (!kidsPair.eligible) expect(kidsPair.reasonCode).toBe('AUDIENCE_MISMATCH_CHILD_ONLY');

    const hallucinatedOil = canonicalizeProductDraftFromSource(
      {
        targetAreas: ['BEARD'],
        hairLengthSuitability: 'NOT_APPLICABLE',
        productFamily: 'OIL',
        benefits: ['BEARD_SOFTENING'],
        holdStrength: 'NONE',
        finish: 'NATURAL',
        incompatibilities: ['NOT_FOR_BEARD'],
        retailNeeds: ['BEARD_SOFTENING'],
        confidence: 0.9,
        fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
        evidenceCodes: [],
        warnings: [],
      },
      { name: 'Beard Oil', description: 'Softening beard oil.', category: 'BEARD' },
    );
    expect(hallucinatedOil.ok).toBe(true);
    if (hallucinatedOil.ok) {
      expect(hallucinatedOil.draft.incompatibilities).not.toContain('NOT_FOR_BEARD');
    }

    const ranked = buildRankedRecommendationsForService(
      service,
      [multiBalm, kidsGel, ...specialists, beardOil].map((profile) => ({
        id: profile.entityId,
        profile,
      })),
    );
    const ids = ranked.map((c) => c.productId);
    expect(ids).toContain('cal-prod-multi-balm');
    expect(ids).not.toContain('cal-prod-kids-gel');
  });

  it('Skin Fade × Matte Clay remains eligible', () => {
    const stubs = buildCalibrationStubProfiles();
    const service = stubs.services.get('cal-svc-skin-fade')!;
    const product = sourceProduct('cal-prod-matte-clay', matteEntity, {
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      productFamily: 'CLAY',
      benefits: ['HOLD'],
      holdStrength: 'STRONG',
      finish: 'MATTE',
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
      confidence: 0.92,
      fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
      evidenceCodes: [],
      warnings: [],
    });
    expect(evaluateServiceProductPair({ service, product, productId: product.entityId }).eligible).toBe(
      true,
    );
  });

  it('Skin Fade × long-only shampoo is rejected after source restriction', () => {
    const stubs = buildCalibrationStubProfiles();
    const service = stubs.services.get('cal-svc-skin-fade')!;
    const product = sourceProduct('cal-prod-long-shampoo', longShampooEntity, {
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      productFamily: 'WASH_SHAMPOO',
      benefits: ['CLEANSING'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
      retailNeeds: ['HAIR_CLEANSING'],
      confidence: 0.85,
      fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
      evidenceCodes: [],
      warnings: [],
    });
    expect(product.incompatibilities).toContain('FOR_LONG_HAIR_ONLY');
    expect(product.hairLengthSuitability).toBe('LONG');
    expect(evaluateServiceProductPair({ service, product, productId: product.entityId }).eligible).toBe(
      false,
    );
  });

  it('short-only clay retains exclusivity from source even when AI invents opposite tag', () => {
    const product = sourceProduct('cal-prod-short-only-clay', shortOnlyEntity, {
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'LONG',
      productFamily: 'CLAY',
      benefits: ['HOLD'],
      holdStrength: 'STRONG',
      finish: 'MATTE',
      incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      confidence: 0.86,
      fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
      evidenceCodes: [],
      warnings: [],
    });
    expect(product.hairLengthSuitability).toBe('SHORT');
    expect(product.incompatibilities).toContain('FOR_SHORT_HAIR_ONLY');
    expect(product.incompatibilities).not.toContain('FOR_LONG_HAIR_ONLY');
  });
});
