/**
 * Server Sentry is on only for deployed Vercel runtimes (production and preview), so local
 * `npm run dev` with a copied SENTRY_DSN does not send HMR / dev-server noise to the production
 * Sentry project. Set SENTRY_ENABLE_LOCAL=true to test Sentry deliberately on a local machine.
 */
export function isSentryServerEnabled(env: {
  dsn: string | undefined;
  vercelEnv: string | undefined;
  enableLocal: string | undefined;
}): boolean {
  if (!env.dsn?.trim()) return false;
  const vercelEnv = env.vercelEnv?.trim().toLowerCase();
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;
  return env.enableLocal?.trim().toLowerCase() === 'true';
}
