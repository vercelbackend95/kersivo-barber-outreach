import { isLocalDatabaseUrl } from '@/lib/db/assertLocalDatabaseUrl';

/**
 * Gates the local-only Shop Hub QA routes and stubs.
 * Never true on Vercel Production or Preview (those share the production database).
 */
export function isPreviewHubRealQaEnabled(): boolean {
  if (process.env.VITEST === 'true') return false;
  const vercelEnv = (process.env.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnv === 'production' || vercelEnv === 'preview') return false;
  if ((process.env.PREVIEW_HUB_REAL_QA ?? '').trim().toLowerCase() !== 'true') return false;
  return isLocalDatabaseUrl(process.env.DATABASE_URL);
}

export function isStripeCheckoutStubEnabled(): boolean {
  if ((process.env.VERCEL_ENV ?? '').trim().toLowerCase() === 'production') return false;
  return (process.env.PREVIEW_HUB_STRIPE_STUB ?? '').trim().toLowerCase() === 'true';
}

export const HUB_REAL_QA_STRIPE_SESSION_ID = 'cs_stub_preview_hub';
