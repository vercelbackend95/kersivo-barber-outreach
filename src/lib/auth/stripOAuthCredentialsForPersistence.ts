/**
 * Persistence guard: never durably store OAuth credential material on Better Auth Account rows.
 *
 * KERSIVO only needs Account identity (providerId / accountId / userId) and, for password
 * accounts, the password hash. Access / refresh / ID tokens and related OAuth metadata are
 * unused after authentication and must not persist through any Account create/update path.
 *
 * Applied via databaseHooks.account.create|update.before — independent of provider, route,
 * or request context.
 */

export const OAUTH_CREDENTIAL_FIELDS = [
  'accessToken',
  'refreshToken',
  'idToken',
  'accessTokenExpiresAt',
  'refreshTokenExpiresAt',
  'scope',
] as const;

export type OAuthCredentialField = (typeof OAUTH_CREDENTIAL_FIELDS)[number];

export type AccountPersistenceFields = {
  providerId?: string | null;
  accountId?: string | null;
  userId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  accessTokenExpiresAt?: Date | string | null;
  refreshTokenExpiresAt?: Date | string | null;
  scope?: string | null;
  password?: string | null;
} & Record<string, unknown>;

/**
 * Force OAuth credential fields to null before durable Account writes.
 * All other fields are preserved with the same values.
 */
export function stripOAuthCredentialsForPersistence<T extends AccountPersistenceFields>(
  account: T,
): T {
  const next: T = { ...account };
  for (const field of OAUTH_CREDENTIAL_FIELDS) {
    (next as AccountPersistenceFields)[field] = null;
  }
  return next;
}

/** Better Auth create/update.before return shape. */
export function stripOAuthCredentialsForHook<T extends AccountPersistenceFields>(
  account: T,
): { data: T } {
  return { data: stripOAuthCredentialsForPersistence(account) };
}
