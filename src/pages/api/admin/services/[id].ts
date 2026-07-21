export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermission } from '../../../../lib/admin/auth';
import {
  ensureCustomServiceCategory,
  loadMergedServiceCategories,
  normalizeServiceCategory
} from '../../../../lib/admin/serviceCategories';
import { unfeatureOtherServicesInCategory } from '../../../../lib/admin/serviceFeatured';
import { prisma } from '../../../../lib/db/client';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(280).optional().nullable(),
  imageUrl: z.string().trim().url().max(2048).optional().nullable(),
  pricePence: z.number().int().min(0).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  displayOrder: z.number().int().min(0).optional(),
  category: z.string().trim().min(1, 'Category is required').max(80).optional(),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  barberIds: z.array(z.string().trim().min(1)).optional()
});

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'catalog.manage');
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  const id = ctx.params.id;
  if (!id) return new Response(JSON.stringify({ error: 'Missing service id.' }), { status: 400 });

  const parsed = updateSchema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const data = parsed.data;
  const uniqueBarberIds = data.barberIds ? Array.from(new Set(data.barberIds)) : null;
  const normalizedCategory =
    data.category !== undefined ? normalizeServiceCategory(data.category) : undefined;

  if (normalizedCategory === null) {
    return new Response(JSON.stringify({ error: 'Category is required.' }), { status: 400 });
  }

  const owned = await prisma.service.findFirst({
    where: { id, shopId },
    select: { id: true, category: true, featured: true }
  });
  if (!owned) return new Response(JSON.stringify({ error: 'Service not found.' }), { status: 404 });

  const nextFeatured = data.featured ?? owned.featured;
  const effectiveCategory = normalizedCategory ?? owned.category;

  const { service, categories } = await prisma.$transaction(async (tx) => {
    const validBarberIds =
      uniqueBarberIds && uniqueBarberIds.length > 0
        ? (await tx.barber.findMany({ where: { id: { in: uniqueBarberIds }, shopId }, select: { id: true } })).map(
            (barber) => barber.id
          )
        : [];

    if (uniqueBarberIds !== null) {
      await tx.barberService.deleteMany({ where: { serviceId: id } });
      if (validBarberIds.length > 0) {
        await tx.barberService.createMany({
          data: validBarberIds.map((barberId) => ({ barberId, serviceId: id })),
          skipDuplicates: true
        });
      }
    }

    if (nextFeatured) {
      await unfeatureOtherServicesInCategory(tx, shopId, effectiveCategory, id);
    }

    const updated = await tx.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl?.trim() || null } : {}),
        ...(data.pricePence !== undefined ? { pricePence: data.pricePence } : {}),
        ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
        ...(data.bufferMinutes !== undefined ? { bufferMinutes: data.bufferMinutes } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
        ...(normalizedCategory !== undefined ? { category: normalizedCategory } : {}),
        ...(data.featured !== undefined ? { featured: data.featured } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      },
      include: {
        barberServices: {
          orderBy: {
            barber: {
              sortOrder: 'asc'
            }
          },
          select: {
            barber: {
              select: {
                id: true,
                name: true,
                active: true
              }
            }
          }
        }
      }
    });

    const nextCategories =
      normalizedCategory !== undefined
        ? await ensureCustomServiceCategory(shopId, normalizedCategory, tx)
        : await loadMergedServiceCategories(shopId, tx);

    return { service: updated, categories: nextCategories };
  });

  return new Response(JSON.stringify({ service, categories }));
};
