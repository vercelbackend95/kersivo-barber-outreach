import {
  parseCheckoutAttemptId,
  SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY,
} from '@/lib/setup/saasCheckoutAttempt';

function readStoredAttemptId(): string | null {
  try {
    return parseCheckoutAttemptId(sessionStorage.getItem(SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredAttemptId(id: string): void {
  try {
    sessionStorage.setItem(SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY, id);
  } catch {
    // sessionStorage may be unavailable; caller still has the in-memory id for this page.
  }
}

/** Reuse the same attempt across retries / double-clicks; create once per browser tab session. */
export function getOrCreateSaasCheckoutAttemptId(): string {
  const existing = readStoredAttemptId();
  if (existing) return existing;
  const next = crypto.randomUUID();
  writeStoredAttemptId(next);
  return next;
}

/** Replace the stored attempt after CHECKOUT_ATTEMPT_EXPIRED / MISMATCH. */
export function rotateSaasCheckoutAttemptId(): string {
  const next = crypto.randomUUID();
  writeStoredAttemptId(next);
  return next;
}

/** Clear after verified purchase on /setup/success. Do not clear on cancel. */
export function clearSaasCheckoutAttemptId(): void {
  try {
    sessionStorage.removeItem(SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
