import { z } from 'zod';

import {
  AFTERCARE_NEEDS,
  FINISH_TYPES,
  HAIR_LENGTHS,
  HOLD_STRENGTHS,
  INCOMPATIBILITY_TAGS,
  PRODUCT_BENEFITS,
  PRODUCT_FAMILIES,
  RETAIL_NEEDS,
  SERVICE_OUTCOMES,
  SERVICE_TECHNIQUES,
  TARGET_AREAS,
  type TargetArea,
} from '../taxonomy';

const confidenceSchema = z.number().min(0).max(1);

/** @deprecated Use serviceSemanticProfileAiV2Schema for active classification. */
export const serviceSemanticProfileAiSchema = z.object({
  targetAreas: z.array(z.enum(TARGET_AREAS)).min(1),
  typicalHairLength: z.enum(HAIR_LENGTHS),
  techniques: z.array(z.enum(SERVICE_TECHNIQUES)),
  outcomes: z.array(z.enum(SERVICE_OUTCOMES)),
  aftercareNeeds: z.array(z.enum(AFTERCARE_NEEDS)),
  incompatibilities: z.array(z.enum(INCOMPATIBILITY_TAGS)),
  confidence: confidenceSchema,
  fieldConfidence: z.record(z.string(), confidenceSchema).optional().default({}),
  evidenceCodes: z.array(z.string().max(80)).max(20).default([]),
  warnings: z.array(z.string().max(120)).max(10).default([]),
});

/** @deprecated Use productSemanticProfileAiV2Schema for active classification. */
export const productSemanticProfileAiSchema = z.object({
  targetAreas: z.array(z.enum(TARGET_AREAS)).min(1),
  hairLengthSuitability: z.enum(HAIR_LENGTHS),
  productFamily: z.enum(PRODUCT_FAMILIES),
  benefits: z.array(z.enum(PRODUCT_BENEFITS)),
  holdStrength: z.enum(HOLD_STRENGTHS),
  finish: z.enum(FINISH_TYPES),
  incompatibilities: z.array(z.enum(INCOMPATIBILITY_TAGS)),
  confidence: confidenceSchema,
  fieldConfidence: z.record(z.string(), confidenceSchema).optional().default({}),
  evidenceCodes: z.array(z.string().max(80)).max(20).default([]),
  warnings: z.array(z.string().max(120)).max(10).default([]),
});

export const serviceSemanticProfileAiV2Schema = serviceSemanticProfileAiSchema.extend({
  retailNeeds: z.array(z.enum(RETAIL_NEEDS)).min(1).max(8),
});

export const productSemanticProfileAiV2Schema = productSemanticProfileAiSchema.extend({
  retailNeeds: z.array(z.enum(RETAIL_NEEDS)).min(1).max(8),
});

export const aiCandidateRerankSchema = z.object({
  schemaVersion: z.literal('1'),
  serviceId: z.string().min(1),
  orderedProductIds: z.array(z.string().min(1)).max(12),
  confidence: confidenceSchema,
  evidenceCodes: z.array(z.string().max(80)).max(20).default([]),
  warnings: z.array(z.string().max(120)).max(10).default([]),
});

/** @deprecated Use ServiceSemanticProfileAiV2. */
export type ServiceSemanticProfileAiV1 = z.infer<typeof serviceSemanticProfileAiSchema>;
/** @deprecated Use ProductSemanticProfileAiV2. */
export type ProductSemanticProfileAiV1 = z.infer<typeof productSemanticProfileAiSchema>;
export type ServiceSemanticProfileAiV2 = z.infer<typeof serviceSemanticProfileAiV2Schema>;
export type ProductSemanticProfileAiV2 = z.infer<typeof productSemanticProfileAiV2Schema>;
export type AiCandidateRerankV1 = z.infer<typeof aiCandidateRerankSchema>;

/** @deprecated Use ServiceSemanticProfileV2. */
export type ServiceSemanticProfileV1 = ServiceSemanticProfileAiV1 & {
  schemaVersion: '1';
  taxonomyVersion: string;
  entityType: 'SERVICE';
  entityId: string;
  shopId: string;
  contentHash: string;
  sourceSnapshot: { name: string; description: string | null; category: string | null };
  modelId: string;
  promptVersion: string;
  classifiedAt: string;
};

/** @deprecated Use ProductSemanticProfileV2. */
export type ProductSemanticProfileV1 = ProductSemanticProfileAiV1 & {
  schemaVersion: '1';
  taxonomyVersion: string;
  entityType: 'PRODUCT';
  entityId: string;
  shopId: string;
  contentHash: string;
  sourceSnapshot: { name: string; description: string | null; category: string };
  modelId: string;
  promptVersion: string;
  classifiedAt: string;
};

export type ServiceSemanticProfileV2 = ServiceSemanticProfileAiV2 & {
  schemaVersion: '2';
  taxonomyVersion: string;
  entityType: 'SERVICE';
  entityId: string;
  shopId: string;
  contentHash: string;
  sourceSnapshot: { name: string; description: string | null; category: string | null };
  modelId: string;
  promptVersion: string;
  classifiedAt: string;
};

export type ProductSemanticProfileV2 = ProductSemanticProfileAiV2 & {
  schemaVersion: '2';
  taxonomyVersion: string;
  entityType: 'PRODUCT';
  entityId: string;
  shopId: string;
  contentHash: string;
  sourceSnapshot: { name: string; description: string | null; category: string };
  modelId: string;
  promptVersion: string;
  classifiedAt: string;
};

export type PositiveReasonCode =
  | 'RETAIL_NEED_STRONG_MATCH'
  | 'RETAIL_NEED_PARTIAL_MATCH'
  | 'TARGET_AREA_EXACT_MATCH'
  | 'HAIR_LENGTH_EXACT_MATCH'
  | 'HAIR_LENGTH_ANY'
  | 'HAIR_LENGTH_NOT_APPLICABLE'
  | 'HAIR_LENGTH_UNKNOWN_NOT_USED'
  | 'TECHNIQUE_PRODUCT_AFFINITY'
  | 'HIGH_CONFIDENCE_MATCH';

export type ScoreBreakdown = {
  retailNeedRelevance: number;
  targetAreaRelevance: number;
  hairLengthSuitability: number;
  techniqueProductAffinity: number;
  confidenceQuality: number;
  /** When false, hairLengthSuitability was excluded from the weighted denominator. */
  hairLengthApplicable: boolean;
  /** Weights used after applicability renormalization (sum to 1). */
  appliedWeights: {
    retailNeedRelevance: number;
    targetAreaRelevance: number;
    hairLengthSuitability: number;
    techniqueProductAffinity: number;
    confidenceQuality: number;
  };
};

export type ScoredCandidate = {
  productId: string;
  deterministicScore: number;
  confidenceGate: number;
  reasonCodes: PositiveReasonCode[];
  productFamily: string;
  matchedAreas: TargetArea[];
  selectionScore?: number;
  rerankPosition?: number;
  scoreBreakdown?: ScoreBreakdown;
};

export type RecommendationSetRerankStats = {
  rerankEligibleServiceCount: number;
  rerankAttemptedServiceCount: number;
  rerankAppliedServiceCount: number;
  rerankFallbackServiceCount: number;
  rerankSkippedInsufficientCandidatesCount: number;
  rerankFallbackReasonCounts: Record<string, number>;
};

export type RecommendationSetStats = {
  serviceCount: number;
  productCount: number;
  itemCount: number;
} & RecommendationSetRerankStats;

export type PublicRecommendationProductV1 = {
  id: string;
  name: string;
  pricePence: number;
  category: string;
  imageUrl: string | null;
  available: true;
  requiresOptions: false;
};

export type PublicRecommendationResponseV1 = {
  ok: true;
  shopId: string;
  serviceIds: string[];
  products: PublicRecommendationProductV1[];
  exposureId: string;
};
