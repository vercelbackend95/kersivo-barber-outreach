export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { requirePermission } from '../../../lib/admin/rbac/can';
import { linkAllServicesToAllBarbers } from '../../../lib/admin/onboarding';
import { prisma } from '../../../lib/db/client';

const barberSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'Barber name is required.').max(120),
});

const payloadSchema = z.object({
  shopName: z.string().trim().min(1, 'Barbershop name is required.').max(120),
  townCity: z.string().trim().max(120).optional().nullable(),
  barbers: z.array(barberSchema).min(1, 'Add at least one barber.'),
});

function badRequest(message: string | unknown) {
  return new Response(JSON.stringify({ error: message }), { status: 400 });
}

/**
 * Update shop + active barbers from Launch Wizard Step 2 (inline edit).
 */
export const PUT: APIRoute = async (context) => {
  try {
    const access = await resolveAdminAccess(context);
    if (!access || access.via !== 'session') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const denied = requirePermission(access, 'billing.manage');
    if (denied) return denied;

    const shop = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: { onboardingCompleted: true },
    });

    if (!shop?.onboardingCompleted) {
      return badRequest('Complete workspace setup before editing launch details.');
    }

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return badRequest('Invalid request body.');
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.flatten());
    }

    const shopId = access.shopId;
    const shopName = parsed.data.shopName.trim();
    const townCity = parsed.data.townCity?.trim() || null;
    const items = parsed.data.barbers.map((barber) => ({
      id: barber.id,
      name: barber.name.trim(),
    }));

    const existing = await prisma.barber.findMany({
      where: { shopId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((barber) => barber.id));
    const keptIds = new Set<string>();
    let createdAny = false;

    await prisma.$transaction(async (tx) => {
      await tx.shopSettings.update({
        where: { id: shopId },
        data: {
          name: shopName,
          townCity,
        },
      });

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        if (item.id && existingIds.has(item.id)) {
          await tx.barber.update({
            where: { id: item.id },
            data: {
              name: item.name,
              active: true,
              sortOrder: index,
            },
          });
          keptIds.add(item.id);
        } else {
          const created = await tx.barber.create({
            data: {
              shopId,
              name: item.name,
              active: true,
              sortOrder: index,
            },
            select: { id: true },
          });
          keptIds.add(created.id);
          createdAny = true;
        }
      }

      const toDeactivate = existing.filter((barber) => !keptIds.has(barber.id)).map((b) => b.id);
      if (toDeactivate.length > 0) {
        await tx.barber.updateMany({
          where: { id: { in: toDeactivate }, shopId },
          data: { active: false },
        });
      }
    });

    if (createdAny) {
      await linkAllServicesToAllBarbers(shopId);
    }

    const updated = await prisma.shopSettings.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        name: true,
        townCity: true,
        barbers: {
          where: { active: true },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        shop: {
          name: updated.name,
          townCity: updated.townCity?.trim() || null,
          barbers: updated.barbers.map((barber) => ({ id: barber.id, name: barber.name })),
        },
        user: {
          name: access.userName,
          email: access.userEmail,
        },
      }),
    );
  } catch (error) {
    console.error('Launch workspace update failed', error);
    const message = error instanceof Error ? error.message : 'Unable to save workspace details.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
