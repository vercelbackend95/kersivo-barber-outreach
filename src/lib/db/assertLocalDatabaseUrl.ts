/**
 * Real-stack Shop Hub QA must never touch the shared Neon / production DATABASE_URL.
 * Only loopback hosts are allowed.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function databaseUrlHostname(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const normalised = value.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:');
    return new URL(normalised).hostname.toLowerCase();
  } catch {
    const match = value.match(/@([^:/?]+)/);
    return match?.[1]?.toLowerCase() ?? null;
  }
}

export function isLocalDatabaseUrl(raw: string | undefined | null): boolean {
  if (!raw?.trim()) return false;
  const host = databaseUrlHostname(raw);
  return Boolean(host && LOCAL_HOSTS.has(host));
}

export function assertLocalDatabaseUrl(raw: string | undefined | null, purpose = 'Shop Hub real QA'): string {
  const value = raw?.trim() ?? '';
  if (!isLocalDatabaseUrl(value)) {
    const host = value ? databaseUrlHostname(value) ?? 'unknown' : 'missing';
    throw new Error(
      `${purpose} aborted: DATABASE_URL host must be localhost or 127.0.0.1 (got ${host}). ` +
        'This guard exists because Preview and Production share the same Neon database.',
    );
  }
  return value;
}
