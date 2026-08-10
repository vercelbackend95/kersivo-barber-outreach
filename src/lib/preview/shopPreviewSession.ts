import { createHash, randomBytes } from 'node:crypto';
import type { APIContext } from 'astro';
import { prisma } from '@/lib/db/client';

export const SHOP_PREVIEW_COOKIE = 'kersivo_shop_preview';
export const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** IP rate limits for guest preview onboarding. */
export const PREVIEW_START_RATE = { action: 'preview_onboarding_start', limit: 8, windowMs: 60 * 60 * 1000 };
export const PREVIEW_WRITE_RATE = { action: 'preview_onboarding_write', limit: 120, windowMs: 60 * 60 * 1000 };

export type PreviewAccess = {
  shopId: string;
  sessionId: string;
};

export function hashPreviewToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function mintPreviewToken(): string {
  return randomBytes(32).toString('base64url');
}

export function previewCookieSecure(): boolean {
  return (
    import.meta.env.PROD === true ||
    process.env.NODE_ENV === 'production' ||
    Boolean((import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? '').startsWith('https://'))
  );
}

export function setPreviewCookie(ctx: APIContext, token: string, maxAgeSeconds: number) {
  ctx.cookies.set(SHOP_PREVIEW_COOKIE, token, {
    httpOnly: true,
    secure: previewCookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function clearPreviewCookie(ctx: APIContext) {
  ctx.cookies.delete(SHOP_PREVIEW_COOKIE, { path: '/' });
}

export async function resolvePreviewAccess(ctx: APIContext): Promise<PreviewAccess | null> {
  const token = ctx.cookies.get(SHOP_PREVIEW_COOKIE)?.value?.trim() || '';
  if (!token) return null;

  const tokenHash = hashPreviewToken(token);
  const session = await prisma.shopPreviewSession.findUnique({
    where: { tokenHash },
    select: { id: true, shopId: true, expiresAt: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.shopPreviewSession.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }
  return { shopId: session.shopId, sessionId: session.id };
}

export async function requirePreviewOnboardingAccess(
  ctx: APIContext,
): Promise<PreviewAccess | Response> {
  const access = await resolvePreviewAccess(ctx);
  if (!access) {
    return new Response(JSON.stringify({ error: 'Preview session required.' }), { status: 401 });
  }
  return access;
}

/** Create provisional shop + preview session; returns plaintext token for cookie. */
export async function createPreviewShopSession(): Promise<{
  shopId: string;
  token: string;
  expiresAt: Date;
}> {
  const token = mintPreviewToken();
  const tokenHash = hashPreviewToken(token);
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);

  const shop = await prisma.shopSettings.create({
    data: {
      name: 'My Barbershop',
      timezone: 'Europe/London',
      ownerUserId: null,
      onboardingCompleted: false,
      onboardingCurrentStep: 0,
      publicActivityPaused: true,
      publicActivityPausedAt: new Date(),
      publicActivityPauseReason: 'Guest preview — not public until subscribed.',
    },
    select: { id: true },
  });

  await prisma.shopPreviewSession.create({
    data: {
      shopId: shop.id,
      tokenHash,
      expiresAt,
    },
  });

  return { shopId: shop.id, token, expiresAt };
}

export async function resolvePreviewShopIdFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SHOP_PREVIEW_COOKIE}=([^;]+)`));
  const token = match?.[1] ? decodeURIComponent(match[1].trim()) : '';
  if (!token) return null;

  const tokenHash = hashPreviewToken(token);
  const session = await prisma.shopPreviewSession.findUnique({
    where: { tokenHash },
    select: { shopId: true, expiresAt: true, id: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.shopPreviewSession.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }
  return session.shopId;
}
