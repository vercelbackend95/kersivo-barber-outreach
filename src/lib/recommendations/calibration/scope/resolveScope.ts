import type { CalibrationGoldExpectations, CalibrationScope, ScopedCalibrationEntities } from '../types';
import { getSmokeScopedEntities } from './smokeManifest';

export function resolveScopedEntities(
  scope: CalibrationScope,
  gold: CalibrationGoldExpectations,
): ScopedCalibrationEntities {
  if (scope === 'smoke') {
    return getSmokeScopedEntities();
  }

  return {
    serviceIds: new Set(gold.recommendations.map((s) => s.serviceId)),
    productIds: new Set(),
    scenarioIds: new Set(gold.recommendations.map((s) => s.id)),
    classificationEntityIds: new Set(gold.classification.map((c) => c.entityId)),
  };
}

export function filterGoldByScope(
  gold: CalibrationGoldExpectations,
  scope: ScopedCalibrationEntities,
): CalibrationGoldExpectations {
  return {
    classification: gold.classification.filter((c) => scope.classificationEntityIds.has(c.entityId)),
    recommendations: gold.recommendations.filter((s) => scope.scenarioIds.has(s.id)),
  };
}
