export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../lib/admin/auth';
import {
  ensureCustomServiceCategory,
  loadMergedServiceCategories,
  normalizeServiceCategory
} from '../../../lib/admin/serviceCategories';
import { prisma } from '../../../lib/db/client';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(280).optional().nullable(),
  pricePence: z.number().int().min(0),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(120).default(0),
  displayOrder: z.number().int().min(0).default(0),
  category: z.string().trim().min(1, 'Category is required').max(80),
  isActive: z.boolean().default(true),
  barberIds: z.array(z.string().trim().min(1)).optional().default([])
});

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const [services, categories] = await Promise.all([
      prisma.service.findMany({
        where: { shopId },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
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
      }),
      loadMergedServiceCategories(shopId)
    ]);

    return new Response(JSON.stringify({ services, categories }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load services.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  const parsed = createSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const payload = parsed.data;
  const category = normalizeServiceCategory(payload.category);
  if (!category) {
    return new Response(JSON.stringify({ error: 'Category is required.' }), { status: 400 });
  }

  const uniqueBarberIds = Array.from(new Set(payload.barberIds));
  const { service, categories } = await prisma.$transaction(async (tx) => {
    const validBarbers =
      uniqueBarberIds.length > 0
        ? await tx.barber.findMany({ where: { id: { in: uniqueBarberIds }, shopId }, select: { id: true } })
        : [];
    const validBarberIds = validBarbers.map((barber) => barber.id);

    const created = await tx.service.create({
      data: {
        shopId,
        name: payload.name,
        description: payload.description?.trim() || null,
        pricePence: payload.pricePence,
        durationMinutes: payload.durationMinutes,
        bufferMinutes: payload.bufferMinutes,
        displayOrder: payload.displayOrder,
        category,
        isActive: payload.isActive,
        barberServices:
          validBarberIds.length > 0
            ? {
                createMany: {
                  data: validBarberIds.map((barberId) => ({ barberId })),
                  skipDuplicates: true
                }
              }
            : undefined
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

    const nextCategories = await ensureCustomServiceCategory(shopId, category, tx);
    return { service: created, categories: nextCategories };
  });

  return new Response(JSON.stringify({ service, categories }), { status: 201 });
};
