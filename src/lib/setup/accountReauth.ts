import { verifyPassword } from 'better-auth/crypto';
import { prisma } from '@/lib/db/client';

export type AccountReauthResult =
  | { ok: true; hasPassword: boolean }
  | { ok: false; status: 400 | 401; error: string };

/**
 * Credential accounts must supply the current password.
 * OAuth-only accounts must confirm their email exactly (plus DELETE confirm elsewhere).
 */
export async function verifyAccountDeletionReauth(input: {
  userId: string;
  email: string;
  password?: string | null;
  emailConfirm?: string | null;
}): Promise<AccountReauthResult> {
  const credential = await prisma.account.findFirst({
    where: {
      userId: input.userId,
      password: { not: null },
    },
    select: { password: true },
  });

  const hasPassword = Boolean(credential?.password);

  if (hasPassword) {
    const password = typeof input.password === 'string' ? input.password : '';
    if (!password) {
      return { ok: false, status: 400, error: 'Password is required to delete this account.' };
    }
    const valid = await verifyPassword({
      hash: credential!.password!,
      password,
    });
    if (!valid) {
      return { ok: false, status: 401, error: 'Incorrect password.' };
    }
    return { ok: true, hasPassword: true };
  }

  const expected = input.email.trim().toLowerCase();
  const provided = (input.emailConfirm ?? '').trim().toLowerCase();
  if (!provided) {
    return {
      ok: false,
      status: 400,
      error: 'Type your account email to confirm deletion.',
    };
  }
  if (provided !== expected) {
    return { ok: false, status: 401, error: 'Email confirmation does not match.' };
  }
  return { ok: true, hasPassword: false };
}

export async function userHasPasswordCredential(userId: string): Promise<boolean> {
  const credential = await prisma.account.findFirst({
    where: {
      userId,
      password: { not: null },
    },
    select: { id: true },
  });
  return Boolean(credential);
}
