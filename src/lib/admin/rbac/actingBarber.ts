import type { APIContext } from 'astro';
import type { AdminAccess } from '@/lib/admin/auth';
import { getSessionBarberId } from '@/lib/admin/auth';

/** Prefer ShopMember.barberId; fall back to legacy cookie for demo paths. */
export function resolveActingBarberId(access: AdminAccess, context?: APIContext): string | null {
  if (access.barberId) return access.barberId;
  if (context) return getSessionBarberId(context);
  return null;
}
