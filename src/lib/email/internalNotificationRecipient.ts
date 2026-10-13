/** The only production recipient for internal KERSIVO operational notifications. */
export const KERSIVO_INTERNAL_NOTIFICATIONS_EMAIL = 'hello@kersivo.co.uk';

export type InternalNotificationTarget =
  | { mode: 'production'; to: string; subjectPrefix: '' }
  | { mode: 'test'; to: string; subjectPrefix: '[Preview] ' }
  | { mode: 'suppressed'; to: string; subjectPrefix: '[Preview] ' };

const SIMPLE_EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

function readEnv(name: string): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return String(process.env[name] ?? env[name] ?? '').trim();
}

export type DeploymentEnvironment = 'production' | 'preview' | 'development';

/**
 * Runtime deployment environment. Only VERCEL_ENV distinguishes Production from Preview
 * (PROD / NODE_ENV are also "production" on Preview builds).
 */
export function resolveDeploymentEnvironment(): DeploymentEnvironment {
  const value = readEnv('VERCEL_ENV');
  if (value === 'production') return 'production';
  if (value === 'preview') return 'preview';
  return 'development';
}

/**
 * Deterministic recipient for internal notifications. Deliberately independent of FROM_EMAIL,
 * CONTACT_INBOX_EMAIL and any user-supplied address.
 *
 * - Production (VERCEL_ENV=production): hello@kersivo.co.uk.
 * - Anywhere else: INTERNAL_NOTIFICATIONS_TEST_EMAIL when valid, otherwise suppressed, so Preview
 *   and local development never reach the production inbox.
 */
export function resolveInternalNotificationTarget(): InternalNotificationTarget {
  if (resolveDeploymentEnvironment() === 'production') {
    return { mode: 'production', to: KERSIVO_INTERNAL_NOTIFICATIONS_EMAIL, subjectPrefix: '' };
  }
  const testEmail = readEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL').toLowerCase();
  if (
    testEmail &&
    SIMPLE_EMAIL.test(testEmail) &&
    testEmail !== KERSIVO_INTERNAL_NOTIFICATIONS_EMAIL
  ) {
    return { mode: 'test', to: testEmail, subjectPrefix: '[Preview] ' };
  }
  return { mode: 'suppressed', to: KERSIVO_INTERNAL_NOTIFICATIONS_EMAIL, subjectPrefix: '[Preview] ' };
}
