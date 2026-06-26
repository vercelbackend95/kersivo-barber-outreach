export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
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
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  try {
    const [services, categories] = await Promise.all([
      prisma.service.findMany({
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
      loadMergedServiceCategories()
    ]);

    // #region agent log
    fetch('http://127.0.0.1:7636/ingest/cd40da78-1e4e-4e73-9293-9e83626fa943', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '27ceaf' },
      body: JSON.stringify({
        sessionId: '27ceaf',
        hypothesisId: 'H4',
        location: 'services.ts:GET',
        message: 'admin services loaded',
        data: { serviceCount: services.length, categoryCount: categories.length },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    return new Response(JSON.stringify({ services, categories }));
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7636/ingest/cd40da78-1e4e-4e73-9293-9e83626fa943', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '27ceaf' },
      body: JSON.stringify({
        sessionId: '27ceaf',
        hypothesisId: 'H1-H4',
        location: 'services.ts:GET:catch',
        message: 'admin services failed',
        data: {
          name: error instanceof Error ? error.name : typeof error,
          snippet: error instanceof Error ? error.message.slice(0, 320) : String(error)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    const message = error instanceof Error ? error.message : 'Unable to load services.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

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
        ? await tx.barber.findMany({ where: { id: { in: uniqueBarberIds } }, select: { id: true } })
        : [];
    const validBarberIds = validBarbers.map((barber) => barber.id);

    const created = await tx.service.create({
      data: {
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

    const nextCategories = await ensureCustomServiceCategory(category, tx);
    return { service: created, categories: nextCategories };
  });

  return new Response(JSON.stringify({ service, categories }), { status: 201 });
};
