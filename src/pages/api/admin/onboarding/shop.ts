export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_SHOP_HOURS,
  requireOnboardingAccess,
} from '@/lib/admin/onboarding';
import { storeShopLogo } from '@/lib/storage/storeShopLogo';
import {
  assertUserSuppliedPublicMediaUrlAllowed,
  compensateFreshPublicBlobUpload,
  isUserSuppliedPublicMediaUrlRejectedError,
} from '@/lib/storage/publicBlobSafety';
import {
  assertShopAllowsPublicMediaMutation,
  isShopMediaMutationBlockedError,
  runWithShopMediaAssociationLock,
} from '@/lib/storage/shopPublicMediaGate';
import { prisma } from '@/lib/db/client';

const jsonSchema = z.object({
  name: z.string().trim().min(1, 'Barbershop name is required.').max(120),
  townCity: z.string().trim().max(120).optional().nullable(),
  logoUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  clearLogo: z.boolean().optional(),
});

export const PUT: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const contentType = ctx.request.headers.get('content-type') ?? '';
    let name: string;
    let townCity: string | null;
    let logoUrl: string | null | undefined;
    let clearLogo = false;
    let uploadedLogoUrl: string | undefined;

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
        await assertShopAllowsPublicMediaMutation(shopId);
        uploadedLogoUrl = await storeShopLogo(logo, shopId);
        logoUrl = uploadedLogoUrl;
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

    const touchesLogo = logoUrl !== undefined;
    if (touchesLogo && !uploadedLogoUrl && logoUrl) {
      const existing = await prisma.shopSettings.findUnique({
        where: { id: shopId },
        select: { logoUrl: true },
      });
      assertUserSuppliedPublicMediaUrlAllowed({
        shopId,
        proposedUrl: logoUrl,
        existingUrl: existing?.logoUrl,
      });
    }
    try {
      if (touchesLogo) {
        await runWithShopMediaAssociationLock(shopId, async (tx) => {
          await tx.shopSettings.update({
            where: { id: shopId },
            data: { name, townCity, logoUrl },
          });
        });
      } else {
        await prisma.shopSettings.update({
          where: { id: shopId },
          data: { name, townCity },
        });
      }
    } catch (error) {
      if (uploadedLogoUrl) {
        await compensateFreshPublicBlobUpload(uploadedLogoUrl, {
          shopId,
          expectedPathPrefix: `shops/${shopId}/`,
        });
      }
      throw error;
    }

    await advanceOnboardingStep(shopId, ONBOARDING_STEP_SHOP_HOURS);

    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    if (isShopMediaMutationBlockedError(error)) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), { status: 409 });
    }
    if (isUserSuppliedPublicMediaUrlRejectedError(error)) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Unable to save shop details.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
