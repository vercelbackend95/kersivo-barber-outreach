export const prerender = false;

import type { APIRoute } from 'astro';
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  getSessionSecret
} from '../../../lib/admin/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  const data = await request.json();
  const adminSecret = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  const sessionSecret = getSessionSecret();

  if (!adminSecret || !sessionSecret || data?.secret !== adminSecret) {
    return new Response(JSON.stringify({ error: 'Invalid secret' }), { status: 401 });
  }

  const token = createAdminSessionToken(sessionSecret);
  cookies.set(
    getAdminSessionCookieName(),
    token,
    getAdminSessionCookieOptions(import.meta.env.PROD)
  );

  return new Response(JSON.stringify({ ok: true }));
};
