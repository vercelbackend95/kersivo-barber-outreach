import { describe, expect, it } from 'vitest';

import {
  hostnameIsAllowedVercelApp,
  isVercelPreviewEnv,
  resolveBetterAuthBaseUrl,
  resolveVercelPreviewTrustedOrigins,
  vercelSystemValueToOrigin,
} from './vercelPreviewOrigins';

describe('isVercelPreviewEnv', () => {
  it('is true only for preview', () => {
    expect(isVercelPreviewEnv({ VERCEL_ENV: 'preview' })).toBe(true);
    expect(isVercelPreviewEnv({ VERCEL_ENV: 'production' })).toBe(false);
    expect(isVercelPreviewEnv({ VERCEL_ENV: 'development' })).toBe(false);
    expect(isVercelPreviewEnv({})).toBe(false);
  });
});

describe('hostnameIsAllowedVercelApp', () => {
  it('accepts vercel.app and subdomains', () => {
    expect(hostnameIsAllowedVercelApp('vercel.app')).toBe(true);
    expect(hostnameIsAllowedVercelApp('my-app.vercel.app')).toBe(true);
    expect(hostnameIsAllowedVercelApp('feat-smart-retail-ops-panel.vercel.app')).toBe(true);
  });

  it('rejects lookalikes and malformed hosts', () => {
    expect(hostnameIsAllowedVercelApp('evilvercel.app')).toBe(false);
    expect(hostnameIsAllowedVercelApp('example.vercel.app.evil.com')).toBe(false);
    expect(hostnameIsAllowedVercelApp('localhost')).toBe(false);
    expect(hostnameIsAllowedVercelApp('.vercel.app')).toBe(false);
    expect(hostnameIsAllowedVercelApp('')).toBe(false);
  });
});

describe('vercelSystemValueToOrigin', () => {
  it('accepts bare hostnames and https origins', () => {
    expect(vercelSystemValueToOrigin('my-app.vercel.app')).toBe('https://my-app.vercel.app');
    expect(vercelSystemValueToOrigin('https://my-app.vercel.app')).toBe(
      'https://my-app.vercel.app',
    );
    expect(vercelSystemValueToOrigin('HTTPS://My-App.Vercel.App')).toBe(
      'https://my-app.vercel.app',
    );
  });

  it('rejects http, paths, query, fragment, userinfo, malformed, lookalikes', () => {
    expect(vercelSystemValueToOrigin('http://my-app.vercel.app')).toBeNull();
    expect(vercelSystemValueToOrigin('my-app.vercel.app/foo')).toBeNull();
    expect(vercelSystemValueToOrigin('https://my-app.vercel.app/path')).toBeNull();
    expect(vercelSystemValueToOrigin('https://my-app.vercel.app?x=1')).toBeNull();
    expect(vercelSystemValueToOrigin('https://my-app.vercel.app#hash')).toBeNull();
    expect(vercelSystemValueToOrigin('https://user:pass@my-app.vercel.app')).toBeNull();
    expect(vercelSystemValueToOrigin('evilvercel.app')).toBeNull();
    expect(vercelSystemValueToOrigin('example.vercel.app.evil.com')).toBeNull();
    expect(vercelSystemValueToOrigin('not a host')).toBeNull();
    expect(vercelSystemValueToOrigin('')).toBeNull();
    expect(vercelSystemValueToOrigin(null)).toBeNull();
  });
});

describe('resolveVercelPreviewTrustedOrigins', () => {
  it('returns branch URL in preview', () => {
    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'feat-branch.vercel.app',
      }),
    ).toEqual(['https://feat-branch.vercel.app']);
  });

  it('returns deploy URL in preview', () => {
    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'proj-abc123.vercel.app',
      }),
    ).toEqual(['https://proj-abc123.vercel.app']);
  });

  it('includes both and deduplicates', () => {
    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'feat-branch.vercel.app',
        VERCEL_URL: 'proj-abc123.vercel.app',
      }),
    ).toEqual(['https://feat-branch.vercel.app', 'https://proj-abc123.vercel.app']);

    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'same.vercel.app',
        VERCEL_URL: 'https://same.vercel.app',
      }),
    ).toEqual(['https://same.vercel.app']);
  });

  it('ignores Vercel URLs outside preview', () => {
    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_ENV: 'production',
        VERCEL_BRANCH_URL: 'feat-branch.vercel.app',
        VERCEL_URL: 'proj.vercel.app',
      }),
    ).toEqual([]);
    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_ENV: 'development',
        VERCEL_URL: 'proj.vercel.app',
      }),
    ).toEqual([]);
    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_URL: 'proj.vercel.app',
      }),
    ).toEqual([]);
  });

  it('skips malformed preview values', () => {
    expect(
      resolveVercelPreviewTrustedOrigins({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'evilvercel.app',
        VERCEL_URL: 'proj.vercel.app/path',
      }),
    ).toEqual([]);
  });
});

describe('resolveBetterAuthBaseUrl', () => {
  it('prefers VERCEL_BRANCH_URL over VERCEL_URL in preview', () => {
    expect(
      resolveBetterAuthBaseUrl({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'feat-branch.vercel.app',
        VERCEL_URL: 'proj-abc.vercel.app',
        BETTER_AUTH_URL: 'https://kersivo.co.uk',
      }),
    ).toBe('https://feat-branch.vercel.app');
  });

  it('falls back to VERCEL_URL then static env outside / when branch missing', () => {
    expect(
      resolveBetterAuthBaseUrl({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'proj-abc.vercel.app',
        BETTER_AUTH_URL: 'https://kersivo.co.uk',
      }),
    ).toBe('https://proj-abc.vercel.app');

    expect(
      resolveBetterAuthBaseUrl({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'evilvercel.app',
        BETTER_AUTH_URL: 'https://kersivo.co.uk/',
      }),
    ).toBe('https://kersivo.co.uk');
  });

  it('production and development ignore Vercel Preview URLs', () => {
    expect(
      resolveBetterAuthBaseUrl({
        VERCEL_ENV: 'production',
        VERCEL_BRANCH_URL: 'feat-branch.vercel.app',
        VERCEL_URL: 'proj.vercel.app',
        BETTER_AUTH_URL: 'https://kersivo.co.uk',
      }),
    ).toBe('https://kersivo.co.uk');

    expect(
      resolveBetterAuthBaseUrl({
        VERCEL_ENV: 'development',
        VERCEL_URL: 'proj.vercel.app',
        PUBLIC_SITE_URL: 'https://kersivo.co.uk',
      }),
    ).toBe('https://kersivo.co.uk');

    expect(
      resolveBetterAuthBaseUrl({
        VERCEL_URL: 'proj.vercel.app',
      }),
    ).toBe('http://localhost:4321');
  });

  it('preserves BETTER_AUTH_URL / PUBLIC_SITE_URL fallbacks via explicit args', () => {
    expect(
      resolveBetterAuthBaseUrl(
        { VERCEL_ENV: 'production' },
        {
          betterAuthUrl: 'https://auth.example.com/',
          publicSiteUrl: 'https://ignored.example.com',
        },
      ),
    ).toBe('https://auth.example.com');
  });
});

describe('static + preview origin composition (auth.ts contract)', () => {
  it('keeps production static hosts and BETTER_AUTH_TRUSTED_ORIGINS alongside preview', () => {
    const previewEnv = {
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: 'feat-branch.vercel.app',
      VERCEL_URL: 'proj-abc.vercel.app',
    };
    const baseURL = resolveBetterAuthBaseUrl(previewEnv, {
      betterAuthUrl: 'https://kersivo.co.uk',
    });
    const envTrusted = ['https://extra.example.com'];
    const composed = [
      ...new Set([
        baseURL,
        'http://localhost:4321',
        'http://127.0.0.1:4321',
        'https://kersivo.co.uk',
        'https://www.kersivo.co.uk',
        ...envTrusted,
        ...resolveVercelPreviewTrustedOrigins(previewEnv),
      ]),
    ];

    expect(baseURL).toBe('https://feat-branch.vercel.app');
    expect(composed).toEqual([
      'https://feat-branch.vercel.app',
      'http://localhost:4321',
      'http://127.0.0.1:4321',
      'https://kersivo.co.uk',
      'https://www.kersivo.co.uk',
      'https://extra.example.com',
      'https://proj-abc.vercel.app',
    ]);
    expect(composed.some((o) => o.includes('*'))).toBe(false);
  });
});
