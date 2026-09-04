import { describe, expect, it } from 'vitest';

import { resolveProviderRunKind } from './resolveProviderRunKind';

describe('resolveProviderRunKind', () => {
  it('zero attempts + cache hits → CACHE_ONLY_REPLAY, connectivity false', () => {
    expect(
      resolveProviderRunKind({
        cachePolicy: 'reuse',
        attempted: 0,
        successful: 0,
        cacheHits: 20,
      }),
    ).toEqual({
      providerRunKind: 'CACHE_ONLY_REPLAY',
      providerConnectivityVerified: false,
    });
  });

  it('zero attempts + no cache → CACHE_ONLY_REPLAY, connectivity false', () => {
    expect(
      resolveProviderRunKind({
        cachePolicy: 'reuse',
        attempted: 0,
        successful: 0,
        cacheHits: 0,
      }),
    ).toEqual({
      providerRunKind: 'CACHE_ONLY_REPLAY',
      providerConnectivityVerified: false,
    });
  });

  it('fresh attempts with successes → FRESH_PROVIDER_RUN, connectivity true', () => {
    expect(
      resolveProviderRunKind({
        cachePolicy: 'refresh',
        attempted: 10,
        successful: 10,
        cacheHits: 0,
      }),
    ).toEqual({
      providerRunKind: 'FRESH_PROVIDER_RUN',
      providerConnectivityVerified: true,
    });
  });

  it('fresh attempts with zero successes → FRESH_PROVIDER_RUN, connectivity false', () => {
    expect(
      resolveProviderRunKind({
        cachePolicy: 'refresh',
        attempted: 5,
        successful: 0,
        cacheHits: 0,
      }),
    ).toEqual({
      providerRunKind: 'FRESH_PROVIDER_RUN',
      providerConnectivityVerified: false,
    });
  });

  it('mixed cache/provider with successes → MIXED, connectivity true', () => {
    expect(
      resolveProviderRunKind({
        cachePolicy: 'reuse',
        attempted: 5,
        successful: 5,
        cacheHits: 15,
      }),
    ).toEqual({
      providerRunKind: 'MIXED_CACHE_PROVIDER_RUN',
      providerConnectivityVerified: true,
    });
  });

  it('mixed cache/provider with zero successes → MIXED, connectivity false', () => {
    expect(
      resolveProviderRunKind({
        cachePolicy: 'reuse',
        attempted: 3,
        successful: 0,
        cacheHits: 10,
      }),
    ).toEqual({
      providerRunKind: 'MIXED_CACHE_PROVIDER_RUN',
      providerConnectivityVerified: false,
    });
  });

  it('readonly cache replay → CACHE_ONLY_REPLAY, connectivity false', () => {
    expect(
      resolveProviderRunKind({
        cachePolicy: 'readonly',
        attempted: 0,
        successful: 0,
        cacheHits: 5,
      }),
    ).toEqual({
      providerRunKind: 'CACHE_ONLY_REPLAY',
      providerConnectivityVerified: false,
    });
  });
});
