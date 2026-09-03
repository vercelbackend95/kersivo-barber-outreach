import { z } from 'zod';

import {
  HAIR_LENGTHS,
  INCOMPATIBILITY_TAGS,
  PRODUCT_FAMILIES,
  RETAIL_NEEDS,
  TARGET_AREAS,
} from '../../taxonomy';
import type { CalibrationCatalogue, CalibrationGoldExpectations } from '../types';
import {
  classificationGoldExpectationSchema,
  recommendationGoldScenarioSchema,
} from './schema';

const uniqueStrings = (values: string[], label: string) => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
};

const taxonomyFieldSchema = z.object({
  required: z.array(z.string()).optional(),
  allowed: z.array(z.string()).optional(),
  forbidden: z.array(z.string()).optional(),
});

export const strictClassificationGoldExpectationSchema = classificationGoldExpectationSchema
  .extend({
    targetAreas: taxonomyFieldSchema.optional(),
    retailNeeds: taxonomyFieldSchema.optional(),
    productFamily: taxonomyFieldSchema.optional(),
    hairLengthSuitability: taxonomyFieldSchema.optional(),
    incompatibilities: taxonomyFieldSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.minConfidence != null && value.maxConfidence != null && value.minConfidence > value.maxConfidence) {
      ctx.addIssue({ code: 'custom', message: 'minConfidence must not exceed maxConfidence' });
    }
    const fields = [
      ['targetAreas', TARGET_AREAS, value.targetAreas],
      ['retailNeeds', RETAIL_NEEDS, value.retailNeeds],
      ['productFamily', PRODUCT_FAMILIES, value.productFamily],
      ['hairLengthSuitability', HAIR_LENGTHS, value.hairLengthSuitability],
      ['incompatibilities', INCOMPATIBILITY_TAGS, value.incompatibilities],
    ] as const;
    for (const [fieldName, allowed, field] of fields) {
      if (!field) continue;
      for (const list of [field.required, field.allowed, field.forbidden]) {
        if (!list) continue;
        uniqueStrings(list, `${fieldName} value`);
        for (const item of list) {
          if (!(allowed as readonly string[]).includes(item)) {
            ctx.addIssue({
              code: 'custom',
              message: `Invalid taxonomy value for ${fieldName}: ${item}`,
            });
          }
        }
      }
    }
  });

export const strictRecommendationGoldScenarioSchema = recommendationGoldScenarioSchema
  .strict()
  .superRefine((scenario, ctx) => {
    const arrays = [
      ['mustInclude', scenario.mustInclude],
      ['mustExclude', scenario.mustExclude],
      ['criticalMustExclude', scenario.criticalMustExclude],
      ['relevantProductIds', scenario.relevantProductIds],
      ['requiredFamilies', scenario.requiredFamilies],
      ['allowedFamilies', scenario.allowedFamilies],
    ] as const;
    for (const [label, values] of arrays) {
      if (values) uniqueStrings(values, `${scenario.id}.${label}`);
    }

    if (!scenario.expectEmpty && (!scenario.relevantProductIds || scenario.relevantProductIds.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: `Scenario ${scenario.id} requires relevantProductIds unless expectEmpty is true`,
      });
    }

    const mustInclude = new Set(scenario.mustInclude ?? []);
    const mustExclude = new Set(scenario.mustExclude ?? []);
    const relevant = new Set(scenario.relevantProductIds ?? []);
    for (const id of mustInclude) {
      if (mustExclude.has(id)) {
        ctx.addIssue({ code: 'custom', message: `mustInclude/mustExclude overlap: ${id}` });
      }
      if (!scenario.expectEmpty && !relevant.has(id)) {
        ctx.addIssue({ code: 'custom', message: `mustInclude not subset of relevantProductIds: ${id}` });
      }
    }
    for (const id of scenario.criticalMustExclude ?? []) {
      if (!mustExclude.has(id)) {
        ctx.addIssue({ code: 'custom', message: `criticalMustExclude must be subset of mustExclude: ${id}` });
      }
    }
    for (const id of relevant) {
      if (mustExclude.has(id)) {
        ctx.addIssue({ code: 'custom', message: `relevantProductIds/mustExclude overlap: ${id}` });
      }
    }
  });

export const strictCalibrationGoldExpectationsSchema = z
  .object({
    classification: z.array(strictClassificationGoldExpectationSchema),
    recommendations: z.array(strictRecommendationGoldScenarioSchema),
  })
  .strict();

export function parseCalibrationGoldExpectations(raw: unknown): CalibrationGoldExpectations {
  return strictCalibrationGoldExpectationsSchema.parse(raw) as CalibrationGoldExpectations;
}

export function validateGoldCrossReferences(
  catalogue: CalibrationCatalogue,
  gold: CalibrationGoldExpectations,
): void {
  const serviceIds = new Set(catalogue.services.map((s) => s.id));
  const productIds = new Set(catalogue.products.map((p) => p.id));
  uniqueStrings(catalogue.services.map((s) => s.id), 'service id');
  uniqueStrings(catalogue.products.map((p) => p.id), 'product id');
  uniqueStrings(gold.recommendations.map((s) => s.id), 'scenario id');
  uniqueStrings(gold.classification.map((c) => c.entityId), 'classification entity id');

  for (const expectation of gold.classification) {
    if (expectation.entityType === 'SERVICE' && !serviceIds.has(expectation.entityId)) {
      throw new Error(`Classification entity not found in catalogue services: ${expectation.entityId}`);
    }
    if (expectation.entityType === 'PRODUCT' && !productIds.has(expectation.entityId)) {
      throw new Error(`Classification entity not found in catalogue products: ${expectation.entityId}`);
    }
  }

  for (const scenario of gold.recommendations) {
    if (!serviceIds.has(scenario.serviceId)) {
      throw new Error(`Scenario serviceId not found: ${scenario.serviceId}`);
    }
    const referenced = [
      ...(scenario.relevantProductIds ?? []),
      ...(scenario.mustInclude ?? []),
      ...(scenario.mustExclude ?? []),
      ...(scenario.criticalMustExclude ?? []),
      ...(scenario.pairAssertions ?? []).map((p) => p.productId),
    ];
    for (const productId of referenced) {
      if (!productIds.has(productId)) {
        throw new Error(`Scenario ${scenario.id} references unknown product: ${productId}`);
      }
    }
  }
}

export function loadValidatedGoldExpectations(
  raw: unknown,
  catalogue: CalibrationCatalogue,
): CalibrationGoldExpectations {
  const gold = parseCalibrationGoldExpectations(raw);
  validateGoldCrossReferences(catalogue, gold);
  return gold;
}
