import { z } from 'zod';

import type { ProductSemanticProfileAiV2, ServiceSemanticProfileAiV2 } from '../contracts';
import { canonicalizeRetailNeeds } from '../retailNeeds';
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
} from '../taxonomy';

const confidenceSchema = z.number().min(0).max(1);

export const SERVICE_CLASSIFICATION_SCHEMA_NAME = 'service_classification';
export const PRODUCT_CLASSIFICATION_SCHEMA_NAME = 'product_classification';
export const RERANK_SCHEMA_NAME = 'candidate_rerank';

export const serviceFieldConfidenceTransportSchema = z
  .object({
    targetAreas: confidenceSchema,
    typicalHairLength: confidenceSchema,
    techniques: confidenceSchema,
    outcomes: confidenceSchema,
    aftercareNeeds: confidenceSchema,
    incompatibilities: confidenceSchema,
    retailNeeds: confidenceSchema,
  })
  .strict();

export const serviceClassificationTransportSchema = z
  .object({
    targetAreas: z.array(z.enum(TARGET_AREAS)).min(1).max(8),
    typicalHairLength: z.enum(HAIR_LENGTHS),
    techniques: z.array(z.enum(SERVICE_TECHNIQUES)).max(12),
    outcomes: z.array(z.enum(SERVICE_OUTCOMES)).max(8),
    aftercareNeeds: z.array(z.enum(AFTERCARE_NEEDS)).max(8),
    incompatibilities: z.array(z.enum(INCOMPATIBILITY_TAGS)).max(8),
    retailNeeds: z.array(z.enum(RETAIL_NEEDS)).min(1).max(8),
    confidence: confidenceSchema,
    fieldConfidence: serviceFieldConfidenceTransportSchema,
    evidenceCodes: z.array(z.string().max(80)).max(20),
    warnings: z.array(z.string().max(120)).max(10),
  })
  .strict();

export const productFieldConfidenceTransportSchema = z
  .object({
    targetAreas: confidenceSchema,
    hairLengthSuitability: confidenceSchema,
    productFamily: confidenceSchema,
    benefits: confidenceSchema,
    holdStrength: confidenceSchema,
    finish: confidenceSchema,
    incompatibilities: confidenceSchema,
    retailNeeds: confidenceSchema,
  })
  .strict();

export const productClassificationTransportSchema = z
  .object({
    targetAreas: z.array(z.enum(TARGET_AREAS)).min(1).max(8),
    hairLengthSuitability: z.enum(HAIR_LENGTHS),
    productFamily: z.enum(PRODUCT_FAMILIES),
    benefits: z.array(z.enum(PRODUCT_BENEFITS)).max(8),
    holdStrength: z.enum(HOLD_STRENGTHS),
    finish: z.enum(FINISH_TYPES),
    incompatibilities: z.array(z.enum(INCOMPATIBILITY_TAGS)).max(8),
    retailNeeds: z.array(z.enum(RETAIL_NEEDS)).min(1).max(8),
    confidence: confidenceSchema,
    fieldConfidence: productFieldConfidenceTransportSchema,
    evidenceCodes: z.array(z.string().max(80)).max(20),
    warnings: z.array(z.string().max(120)).max(10),
  })
  .strict();

export const rerankTransportSchema = z
  .object({
    schemaVersion: z.literal('1'),
    serviceId: z.string().min(1).max(120),
    orderedProductIds: z.array(z.string().min(1).max(120)).max(12),
    confidence: confidenceSchema,
    evidenceCodes: z.array(z.string().max(80)).max(20),
    warnings: z.array(z.string().max(120)).max(10),
  })
  .strict();

export type ServiceClassificationTransport = z.infer<typeof serviceClassificationTransportSchema>;
export type ProductClassificationTransport = z.infer<typeof productClassificationTransportSchema>;
export type RerankTransport = z.infer<typeof rerankTransportSchema>;

function stripMedicalClaims(warnings: string[]): string[] {
  const filtered = warnings.filter((w) => !/medical|therapeutic|disease|eczema|psoriasis/i.test(w));
  if (filtered.length !== warnings.length) filtered.push('MEDICAL_CLAIM_SUPPRESSED');
  return filtered;
}

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function mapServiceTransportToProfile(
  transport: ServiceClassificationTransport,
): ServiceSemanticProfileAiV2 {
  const fc = transport.fieldConfidence;
  const retailNeeds = canonicalizeRetailNeeds(transport.retailNeeds);
  return {
    targetAreas: transport.targetAreas,
    typicalHairLength: transport.typicalHairLength,
    techniques: transport.techniques,
    outcomes: transport.outcomes,
    aftercareNeeds: transport.aftercareNeeds,
    incompatibilities: transport.incompatibilities,
    retailNeeds,
    confidence: clampConfidence(transport.confidence),
    fieldConfidence: {
      targetAreas: fc.targetAreas,
      typicalHairLength: fc.typicalHairLength,
      techniques: fc.techniques,
      outcomes: fc.outcomes,
      aftercareNeeds: fc.aftercareNeeds,
      incompatibilities: fc.incompatibilities,
      retailNeeds: fc.retailNeeds,
    },
    evidenceCodes: transport.evidenceCodes,
    warnings: stripMedicalClaims(transport.warnings),
  };
}

export function mapProductTransportToProfile(
  transport: ProductClassificationTransport,
): ProductSemanticProfileAiV2 {
  const fc = transport.fieldConfidence;
  const retailNeeds = canonicalizeRetailNeeds(transport.retailNeeds);
  return {
    targetAreas: transport.targetAreas,
    hairLengthSuitability: transport.hairLengthSuitability,
    productFamily: transport.productFamily,
    benefits: transport.benefits,
    holdStrength: transport.holdStrength,
    finish: transport.finish,
    incompatibilities: transport.incompatibilities,
    retailNeeds,
    confidence: clampConfidence(transport.confidence),
    fieldConfidence: {
      targetAreas: fc.targetAreas,
      hairLengthSuitability: fc.hairLengthSuitability,
      productFamily: fc.productFamily,
      benefits: fc.benefits,
      holdStrength: fc.holdStrength,
      finish: fc.finish,
      incompatibilities: fc.incompatibilities,
      retailNeeds: fc.retailNeeds,
    },
    evidenceCodes: transport.evidenceCodes,
    warnings: stripMedicalClaims(transport.warnings),
  };
}
