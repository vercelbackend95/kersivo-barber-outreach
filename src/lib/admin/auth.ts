import type { APIContext } from 'astro';
import { getAdminSessionCookieName, getSessionSecret, verifyAdminSessionToken } from './session';

export function isAdminAuthorized(context: APIContext): boolean {
  const secret = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  const sessionSecret = getSessionSecret();

  const cookieToken = context.cookies.get(getAdminSessionCookieName())?.value;
  if (cookieToken && sessionSecret && verifyAdminSessionToken(cookieToken, sessionSecret)) {
    return true;
  }

  const header = context.request.headers.get('x-admin-secret');
  return !!secret && header === secret;
}

export function requireAdmin(context: APIContext): Response | null {
  if (!isAdminAuthorized(context)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return null;
}
