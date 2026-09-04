import type { CalibrationCachePolicy, ProviderRunKind } from '../types';

/**
 * Derive provider run kind from actual call activity.
 * `cachePolicy` is accepted for caller compatibility but does not override
 * activity-based classification when attempts > 0 (readonly yields attempted === 0).
 */
export function resolveProviderRunKind(input: {
  cachePolicy: CalibrationCachePolicy;
  attempted: number;
  successful: number;
  cacheHits: number;
}): { providerRunKind: ProviderRunKind; providerConnectivityVerified: boolean } {
  void input.cachePolicy;

  if (input.attempted === 0) {
    return { providerRunKind: 'CACHE_ONLY_REPLAY', providerConnectivityVerified: false };
  }

  const providerConnectivityVerified = input.successful > 0;

  if (input.cacheHits > 0) {
    return { providerRunKind: 'MIXED_CACHE_PROVIDER_RUN', providerConnectivityVerified };
  }

  return { providerRunKind: 'FRESH_PROVIDER_RUN', providerConnectivityVerified };
}
