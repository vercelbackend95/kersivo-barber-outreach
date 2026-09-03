import type { ProductSemanticProfileV2 } from '../../contracts';
import type { CalibrationCatalogue, CalibrationGoldExpectations, ScopedCalibrationEntities } from '../types';
import { buildCalibrationStubProfiles } from '../dataset/stubProfiles';
import { evaluateServiceProductPair } from '../../pairEvaluation';

export const SMOKE_MAX_PROVIDER_REQUESTS = 20;

/** Single authoritative smoke execution manifest — all counts derived from here. */
export const CALIBRATION_SMOKE_EXECUTION_MANIFEST = {
  version: '2026-09-v2',
  classifyServiceIds: [
    'cal-svc-skin-fade',
    'cal-svc-hair-beard',
  ] as const,
  classifyProductIds: [
    'cal-prod-matte-clay',
    'cal-prod-powder',
    'cal-prod-fibre',
    'cal-prod-pomade',
    'cal-prod-wax',
    'cal-prod-injection',
    'cal-prod-short-only-clay',
    'cal-prod-kids-gel',
    'cal-prod-typo-pomad',
    'cal-prod-misleading',
    'cal-prod-sea-salt',
    'cal-prod-long-shampoo',
    'cal-prod-beard-oil',
    'cal-prod-gift-set',
    'cal-prod-multi-balm',
    'cal-prod-beard-balm',
    'cal-prod-ambiguous',
  ] as const,
  rerankServiceIds: ['cal-svc-skin-fade'] as const,
  scenarioIds: ['skin-fade-safety', 'combo-hair-beard-coverage'] as const,
  classificationEntityIds: [
    'cal-svc-skin-fade',
    'cal-svc-hair-beard',
    'cal-prod-ambiguous',
    'cal-prod-injection',
  ] as const,
} as const;

export const CALIBRATION_SMOKE_MANIFEST_VERSION = CALIBRATION_SMOKE_EXECUTION_MANIFEST.version;

export function getSmokeCallCounts(): {
  serviceClassifications: number;
  productClassifications: number;
  rerankAttempts: number;
  totalMaxCalls: number;
} {
  const serviceClassifications = CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyServiceIds.length;
  const productClassifications = CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyProductIds.length;
  const rerankAttempts = CALIBRATION_SMOKE_EXECUTION_MANIFEST.rerankServiceIds.length;
  return {
    serviceClassifications,
    productClassifications,
    rerankAttempts,
    totalMaxCalls: serviceClassifications + productClassifications + rerankAttempts,
  };
}

export function getSmokeScopedEntities(): ScopedCalibrationEntities {
  return {
    serviceIds: new Set(CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyServiceIds),
    productIds: new Set(CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyProductIds),
    scenarioIds: new Set(CALIBRATION_SMOKE_EXECUTION_MANIFEST.scenarioIds),
    classificationEntityIds: new Set(CALIBRATION_SMOKE_EXECUTION_MANIFEST.classificationEntityIds),
  };
}

function collectScenarioProductIds(scenario: CalibrationGoldExpectations['recommendations'][number]): Set<string> {
  const ids = new Set<string>();
  for (const id of scenario.relevantProductIds ?? []) ids.add(id);
  for (const id of scenario.mustInclude ?? []) ids.add(id);
  for (const id of scenario.mustExclude ?? []) ids.add(id);
  for (const id of scenario.criticalMustExclude ?? []) ids.add(id);
  for (const assertion of scenario.pairAssertions ?? []) ids.add(assertion.productId);
  return ids;
}

export function validateSmokeManifestClosure(
  gold: CalibrationGoldExpectations,
  catalogue: CalibrationCatalogue,
): void {
  const manifest = CALIBRATION_SMOKE_EXECUTION_MANIFEST;
  const counts = getSmokeCallCounts();
  if (counts.totalMaxCalls > SMOKE_MAX_PROVIDER_REQUESTS) {
    throw new Error(
      `Smoke manifest exceeds ${SMOKE_MAX_PROVIDER_REQUESTS} provider requests: ${counts.totalMaxCalls}`,
    );
  }

  const serviceSet = new Set<string>(manifest.classifyServiceIds);
  const productSet = new Set<string>(manifest.classifyProductIds);
  const catalogueServiceIds = new Set(catalogue.services.map((s) => s.id));
  const catalogueProductIds = new Set(catalogue.products.map((p) => p.id));

  for (const serviceId of manifest.classifyServiceIds) {
    if (!catalogueServiceIds.has(serviceId)) {
      throw new Error(`Smoke manifest service not in catalogue: ${serviceId}`);
    }
  }
  for (const productId of manifest.classifyProductIds) {
    if (!catalogueProductIds.has(productId)) {
      throw new Error(`Smoke manifest product not in catalogue: ${productId}`);
    }
  }
  for (const rerankServiceId of manifest.rerankServiceIds) {
    if (!serviceSet.has(rerankServiceId)) {
      throw new Error(`Smoke rerank service not in classified smoke services: ${rerankServiceId}`);
    }
  }

  const smokeScenarios = gold.recommendations.filter((s) =>
    (manifest.scenarioIds as readonly string[]).includes(s.id),
  );
  if (smokeScenarios.length !== manifest.scenarioIds.length) {
    throw new Error('Smoke manifest scenario IDs do not match gold expectations');
  }

  for (const scenario of smokeScenarios) {
    if (!serviceSet.has(scenario.serviceId)) {
      throw new Error(`Smoke scenario service not in classified smoke services: ${scenario.id}`);
    }
    for (const productId of collectScenarioProductIds(scenario)) {
      if (!productSet.has(productId)) {
        throw new Error(`Smoke scenario product not in classified smoke pool: ${scenario.id}:${productId}`);
      }
    }
  }

  const stubs = buildCalibrationStubProfiles();
  const smokeProducts: Array<{ id: string; profile: ProductSemanticProfileV2 }> = [];
  for (const id of manifest.classifyProductIds) {
    const profile = stubs.products.get(id);
    if (profile) smokeProducts.push({ id, profile });
  }

  for (const rerankServiceId of manifest.rerankServiceIds) {
    const service = stubs.services.get(rerankServiceId);
    if (!service) {
      throw new Error(`Smoke rerank service stub missing: ${rerankServiceId}`);
    }
    const eligibleCount = smokeProducts.filter(
      (product) => evaluateServiceProductPair({ service, product: product.profile, productId: product.id }).eligible,
    ).length;
    if (eligibleCount < 2) {
      throw new Error(
        `Smoke rerank service has fewer than 2 eligible smoke products: ${rerankServiceId} (${eligibleCount})`,
      );
    }
  }
}
