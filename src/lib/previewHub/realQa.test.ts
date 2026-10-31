import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPreviewHubRealQaEnabled, isStripeCheckoutStubEnabled } from './realQa';
import { qaEmailLogPath } from './qaEmailLog';
import { isMemoryPrivateBlobEnabled } from '@/lib/storage/memoryPrivateBlob';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

describe('Shop Hub real-QA gates', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('never enables QA routes on Vercel production or preview', () => {
    vi.stubEnv('PREVIEW_HUB_REAL_QA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isPreviewHubRealQaEnabled()).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(isPreviewHubRealQaEnabled()).toBe(false);
  });

  it('refuses a remote DATABASE_URL even when the QA flag is on', () => {
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('PREVIEW_HUB_REAL_QA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://neondb_owner:x@ep-example.eu-west-2.aws.neon.tech/neondb');
    expect(isPreviewHubRealQaEnabled()).toBe(false);
  });

  it('never uses the memory blob driver in Vercel production', () => {
    vi.stubEnv('PRIVATE_BLOB_DRIVER', 'memory');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isMemoryPrivateBlobEnabled()).toBe(false);
  });

  it('never enables QA gates inside vitest', () => {
    vi.stubEnv('VITEST', 'true');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('PREVIEW_HUB_REAL_QA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa');
    expect(isPreviewHubRealQaEnabled()).toBe(false);
  });

  it('skips IP rate limits on the local real-QA stack', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('PREVIEW_HUB_REAL_QA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa');
    expect(isPreviewHubRealQaEnabled()).toBe(true);
    const blocked = await enforceIpRateLimit(new Request('http://127.0.0.1/x'), 'qa', 1, 60_000);
    expect(blocked).toBeNull();
  });

  it('keeps the QA email log at the repo root so NFT cannot walk scripts/', () => {
    expect(qaEmailLogPath().replace(/\\/g, '/')).toMatch(/\/\.preview-hub-qa-emails\.json$/);
    expect(qaEmailLogPath()).not.toContain('scripts');
  });

  it('never stubs Stripe checkout in Vercel production', () => {
    vi.stubEnv('PREVIEW_HUB_STRIPE_STUB', 'true');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isStripeCheckoutStubEnabled()).toBe(false);
  });
});
