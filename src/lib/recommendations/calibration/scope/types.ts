import type { CalibrationScope } from '../types';

export type { CalibrationScope };

export const CALIBRATION_SCOPES = ['smoke', 'full'] as const;

export function isCalibrationScope(value: string): value is CalibrationScope {
  return (CALIBRATION_SCOPES as readonly string[]).includes(value);
}
