export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  advanceOnboardingStep,
  linkAllServicesToAllBarbers,
  loadOnboardingState,
  ONBOARDING_STEP_HOURS,
  requireOnboardingAccess,
} from '@/lib/admin/onboarding';
import { prisma } from '@/lib/db/client';

const serviceSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'Service name is required.').max(120),
  pricePence: z.number().int().min(0),
  durationMinutes: z.number().int().min(5).max(480),
  selected: z.boolean().default(true),
});

const payloadSchema = z.object({
  services: z.array(serviceSchema).min(1, 'Select at least one service.'),
});

export const PUT: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const parsed = payloadSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }

    const selected = parsed.data.services.filter((service) => service.selected !== false);
    if (selected.length === 0) {
      return new Response(JSON.stringify({ error: 'Select at least one service.' }), { status: 400 });
    }

    const existing = await prisma.service.findMany({
      where: { shopId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((service) => service.id));
    const keptIds = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < selected.length; index += 1) {
        const item = selected[index]!;
        if (item.id && existingIds.has(item.id)) {
          await tx.service.update({
            where: { id: item.id },
            data: {
              name: item.name,
              pricePence: item.pricePence,
              durationMinutes: item.durationMinutes,
              displayOrder: index,
              isActive: true,
              category: 'featured',
            },
          });
          keptIds.add(item.id);
        } else {
          const created = await tx.service.create({
            data: {
              shopId,
              name: item.name,
              pricePence: item.pricePence,
              durationMinutes: item.durationMinutes,
              displayOrder: index,
              bufferMinutes: 0,
              isActive: true,
              category: 'featured',
            },
            select: { id: true },
          });
          keptIds.add(created.id);
        }
      }

      const toDeactivate = existing.filter((service) => !keptIds.has(service.id)).map((s) => s.id);
      if (toDeactivate.length > 0) {
        await tx.service.updateMany({
          where: { id: { in: toDeactivate }, shopId },
          data: { isActive: false },
        });
      }
    });

    await linkAllServicesToAllBarbers(shopId);
    await advanceOnboardingStep(shopId, ONBOARDING_STEP_HOURS);

    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save services.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
