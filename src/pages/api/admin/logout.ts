export const prerender = false;

import type { APIRoute } from 'astro';
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions
} from '../../../lib/admin/session';
import { clearPreviewCookie } from '../../../lib/preview/shopPreviewSession';
import { HUB_COOKIE_NAME } from '../../../lib/adminHub/hubSession';
import { ACTIVE_SHOP_COOKIE_NAME } from '../../../lib/admin/activeShopSelection';

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
  // Leaving the admin also ends any "Viewing as KERSIVO" impersonation and the multi-shop selection.
  for (const name of [HUB_COOKIE_NAME, ACTIVE_SHOP_COOKIE_NAME]) {
    cookies.set(name, '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax' });
  }

  return new Response(JSON.stringify({ ok: true }));
};
