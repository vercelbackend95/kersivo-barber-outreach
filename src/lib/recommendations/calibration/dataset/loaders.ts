import { z } from 'zod';

import type { CalibrationCatalogue } from '../types';
import { CALIBRATION_CATALOGUE } from './catalogue';
import { CALIBRATION_DATASET_VERSION } from './version';

const rawServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
});

const rawProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().min(1),
});

const catalogueSchema = z.object({
  shopName: z.string().min(1),
  services: z.array(rawServiceSchema).min(1),
  products: z.array(rawProductSchema).min(1),
});

export const EXPECTED_SERVICE_COUNT = 27;
export const EXPECTED_PRODUCT_COUNT = 40;

export function loadCalibrationCatalogue(): CalibrationCatalogue {
  const parsed = catalogueSchema.parse(CALIBRATION_CATALOGUE);
  return parsed;
}

export function validateCalibrationDatasetCounts(catalogue: CalibrationCatalogue): void {
  if (catalogue.services.length !== EXPECTED_SERVICE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_SERVICE_COUNT} calibration services, got ${catalogue.services.length}`,
    );
  }
  if (catalogue.products.length !== EXPECTED_PRODUCT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PRODUCT_COUNT} calibration products, got ${catalogue.products.length}`,
    );
  }
}

export function getCalibrationDatasetVersion(): string {
  return CALIBRATION_DATASET_VERSION;
}
