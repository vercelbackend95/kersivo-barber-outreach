export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { storeShopLogo } from '@/lib/storage/storeShopLogo';

const jsonSchema = z.object({
  name: z.string().trim().min(1, 'Barbershop name is required.').max(120),
  townCity: z.string().trim().max(120).optional().nullable(),
  logoUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  clearLogo: z.boolean().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PUT: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['shop.settings']);
  if (denied) return denied;

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
        return json({ error: 'Barbershop name is required.' }, 400);
      }

      if (logo instanceof File && logo.size > 0) {
        logoUrl = await storeShopLogo(logo, shopId);
      } else if (clearLogo) {
        logoUrl = null;
      }
    } else {
      const parsed = jsonSchema.safeParse(await ctx.request.json());
      if (!parsed.success) {
        return json({ error: parsed.error.flatten() }, 400);
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

    const updated = await prisma.shopSettings.update({
      where: { id: shopId },
      data: {
        name,
        townCity,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      },
      select: { name: true, townCity: true, logoUrl: true },
    });

    return json({
      identity: {
        name: updated.name,
        townCity: updated.townCity,
        logoUrl: updated.logoUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save barbershop details.';
    return json({ error: message }, 500);
  }
};
