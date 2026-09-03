const EXPOSURE_STORAGE_KEY = 'kersivo_recommendation_exposure_v1';

export function storeRecommendationExposureId(exposureId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const trimmed = exposureId.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(EXPOSURE_STORAGE_KEY, trimmed);
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function readRecommendationExposureId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(EXPOSURE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearRecommendationExposureId(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(EXPOSURE_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
