export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  advanceOnboardingStep,
  GUEST_ONBOARDING_VIEWER,
  loadOnboardingState,
  ONBOARDING_STEP_SHOP_HOURS,
} from '@/lib/admin/onboarding';
import { prisma } from '@/lib/db/client';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import {
  PREVIEW_WRITE_RATE,
  requirePreviewOnboardingAccess,
} from '@/lib/preview/shopPreviewSession';
import { storeShopLogo } from '@/lib/storage/storeShopLogo';

const jsonSchema = z.object({
  name: z.string().trim().min(1, 'Barbershop name is required.').max(120),
  townCity: z.string().trim().max(120).optional().nullable(),
  logoUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  clearLogo: z.boolean().optional(),
});

export const PUT: APIRoute = async (ctx) => {
  const limited = await enforceIpRateLimit(
    ctx.request,
    PREVIEW_WRITE_RATE.action,
    PREVIEW_WRITE_RATE.limit,
    PREVIEW_WRITE_RATE.windowMs,
  );
  if (limited) return limited;

  const access = await requirePreviewOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const contentType = ctx.request.headers.get('content-type') ?? '';
    let name: string;
    let townCity: string | null;
    let logoUrl: string | null | undefined;
    let clearLogo = false;

    if (contentType.includes('multipart/form-data')) {
      const form = await ctx.request.formData();
      name = String(form.get('name') ?? '').trim();
      townCity = String(form.get('townCity') ?? '').trim() || null;
      clearLogo = String(form.get('clearLogo') ?? '').trim() === 'true';
      const logo = form.get('logo');

      if (!name) {
        return new Response(JSON.stringify({ error: 'Barbershop name is required.' }), { status: 400 });
      }

      if (logo instanceof File && logo.size > 0) {
        logoUrl = await storeShopLogo(logo, shopId);
      } else if (clearLogo) {
        logoUrl = null;
      }
    } else {
      const parsed = jsonSchema.safeParse(await ctx.request.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
      }
      name = parsed.data.name;
      townCity = parsed.data.townCity?.trim() || null;
      clearLogo = Boolean(parsed.data.clearLogo);
      if (clearLogo) {
        logoUrl = null;
      } else if (parsed.data.logoUrl === '') {
        logoUrl = undefined;
      } else if (parsed.data.logoUrl) {
        logoUrl = parsed.data.logoUrl;
      }
    }

    await prisma.shopSettings.update({
      where: { id: shopId },
      data: {
        name,
        townCity,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      },
    });

    await advanceOnboardingStep(shopId, ONBOARDING_STEP_SHOP_HOURS);
    const state = await loadOnboardingState(shopId, GUEST_ONBOARDING_VIEWER);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save shop details.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
