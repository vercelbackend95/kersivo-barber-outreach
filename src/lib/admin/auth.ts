import type { APIContext } from 'astro';
import { getAdminSessionCookieName, getSessionSecret, parseAdminSessionToken } from './session';

export function getSessionBarberId(context: APIContext): string | null {
  const sessionSecret = getSessionSecret();
  const cookieToken = context.cookies.get(getAdminSessionCookieName())?.value;
  if (!cookieToken || !sessionSecret) return null;
  return parseAdminSessionToken(cookieToken, sessionSecret)?.barberId ?? null;
}

export function resolveNoteAuthorBarberId(context: APIContext): string | null {
  return getSessionBarberId(context);
}

export function isAdminAuthorized(context: APIContext): boolean {
  const secret = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  const sessionSecret = getSessionSecret();

  const cookieToken = context.cookies.get(getAdminSessionCookieName())?.value;
  if (cookieToken && sessionSecret && parseAdminSessionToken(cookieToken, sessionSecret)) {
    return true;
  }

  const header = context.request.headers.get('x-admin-secret');
  return !!secret && header === secret;
}

export function requireAdmin(context: APIContext): Response | null {
  if (!isAdminAuthorized(context)) {
        console.error('[admin/auth] Unauthorized admin API request.', { path: new URL(context.request.url).pathname });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return null;
}
