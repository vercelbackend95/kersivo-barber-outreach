export const prerender = false;

import type { APIRoute } from 'astro';
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions
} from '../../../lib/admin/session';
import { clearPreviewCookie } from '../../../lib/preview/shopPreviewSession';

export const POST: APIRoute = async (ctx) => {
  const { cookies } = ctx;
  cookies.set(
    getAdminSessionCookieName(),
    '',
    {
      ...getAdminSessionCookieOptions(import.meta.env.PROD),
      maxAge: 0
    }
  );
  clearPreviewCookie(ctx);

  return new Response(JSON.stringify({ ok: true }));
};
