import { describe, expect, it } from 'vitest';

import {
  EXPECTED_PRODUCT_COUNT,
  EXPECTED_SERVICE_COUNT,
  loadCalibrationCatalogue,
  validateCalibrationDatasetCounts,
} from './loaders';
import { CALIBRATION_DATASET_VERSION } from './version';

describe('calibration dataset', () => {
  it('loads fictional catalogue with expected counts', () => {
    const catalogue = loadCalibrationCatalogue();
    expect(catalogue.shopName).toContain('Fictional');
    expect(catalogue.services).toHaveLength(EXPECTED_SERVICE_COUNT);
    expect(catalogue.products).toHaveLength(EXPECTED_PRODUCT_COUNT);
    validateCalibrationDatasetCounts(catalogue);
  });

  it('uses stable dataset version', () => {
    expect(CALIBRATION_DATASET_VERSION).toBe('2026-09-v1');
  });

  it('has unique entity ids', () => {
    const catalogue = loadCalibrationCatalogue();
    const serviceIds = catalogue.services.map((s) => s.id);
    const productIds = catalogue.products.map((p) => p.id);
    expect(new Set(serviceIds).size).toBe(serviceIds.length);
    expect(new Set(productIds).size).toBe(productIds.length);
  });
});
