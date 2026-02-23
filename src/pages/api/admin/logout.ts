export const prerender = false;

import type { APIRoute } from 'astro';
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions
} from '../../../lib/admin/session';

export const POST: APIRoute = async ({ cookies }) => {
  cookies.set(
    getAdminSessionCookieName(),
    '',
    {
      ...getAdminSessionCookieOptions(import.meta.env.PROD),
      maxAge: 0
    }
  );

  return new Response(JSON.stringify({ ok: true }));
};
