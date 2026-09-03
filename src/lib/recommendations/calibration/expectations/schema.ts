import { z } from 'zod';

import { PRODUCT_FAMILIES } from '../../taxonomy';
import { PAIR_REJECTION_CODES } from './pairRejectionCodes';

const fieldExpectationSchema = z
  .object({
    required: z.array(z.string()).optional(),
    allowed: z.array(z.string()).optional(),
    forbidden: z.array(z.string()).optional(),
  })
  .strict();

export const classificationGoldExpectationSchema = z
  .object({
    entityId: z.string().min(1),
    entityType: z.enum(['SERVICE', 'PRODUCT']),
    minConfidence: z.number().min(0).max(1).optional(),
    maxConfidence: z.number().min(0).max(1).optional(),
    expectFailClosed: z.boolean().optional(),
    targetAreas: fieldExpectationSchema.optional(),
    retailNeeds: fieldExpectationSchema.optional(),
    productFamily: fieldExpectationSchema.optional(),
    hairLengthSuitability: fieldExpectationSchema.optional(),
    incompatibilities: fieldExpectationSchema.optional(),
  })
  .strict();

export const pairAssertionSchema = z
  .object({
    productId: z.string().min(1),
    expected: z.enum(['ELIGIBLE', 'REJECTED']),
    allowedRejectionCodes: z.array(z.enum(PAIR_REJECTION_CODES)).optional(),
  })
  .strict();

export const recommendationGoldScenarioSchema = z
  .object({
    id: z.string().min(1),
    serviceId: z.string().min(1),
    relevantProductIds: z.array(z.string().min(1)).optional(),
    mustInclude: z.array(z.string()).optional(),
    mustExclude: z.array(z.string()).optional(),
    criticalMustExclude: z.array(z.string()).optional(),
    pairAssertions: z.array(pairAssertionSchema).optional(),
    requiredFamilies: z.array(z.enum(PRODUCT_FAMILIES)).optional(),
    allowedFamilies: z.array(z.enum(PRODUCT_FAMILIES)).optional(),
    requireHairAndBeardCoverage: z.boolean().optional(),
    expectEmpty: z.boolean().optional(),
  })
  .strict();

export const calibrationGoldExpectationsSchema = z
  .object({
    classification: z.array(classificationGoldExpectationSchema),
    recommendations: z.array(recommendationGoldScenarioSchema),
  })
  .strict();

export type ClassificationGoldExpectationInput = z.infer<typeof classificationGoldExpectationSchema>;
export type RecommendationGoldScenarioInput = z.infer<typeof recommendationGoldScenarioSchema>;
