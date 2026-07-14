export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_SERVICES,
  requireOnboardingAccess,
} from '@/lib/admin/onboarding';
import { prisma } from '@/lib/db/client';
import { getBlobReadWriteToken, makeBlobPath, uploadPublicImageToBlob } from '@/lib/storage/vercelBlob';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const barberSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'Barber name is required.').max(120),
  avatarUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
});

const payloadSchema = z.object({
  barbers: z.array(barberSchema).min(1, 'Add at least one barber.'),
});

function getExtensionForType(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return null;
}

async function storeAvatar(file: File, barberId?: string) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error('Avatar must be a JPG, PNG, or WEBP image.');
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error('Avatar is too large. Maximum size is 5MB.');
  }
  if (!getExtensionForType(file.type)) {
    throw new Error('Unsupported avatar format.');
  }
  if (!getBlobReadWriteToken()) {
    throw new Error('Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN before uploading avatars.');
  }

  const pathname = makeBlobPath('barbers', file, barberId);
  return uploadPublicImageToBlob(file, pathname);
}

export const PUT: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const contentType = ctx.request.headers.get('content-type') ?? '';
    let items: Array<{ id?: string; name: string; avatarUrl?: string | null }> = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await ctx.request.formData();
      const raw = String(form.get('barbers') ?? '[]');
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid barbers payload.' }), { status: 400 });
      }
      const parsed = payloadSchema.safeParse({ barbers: parsedJson });
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
      }
      items = parsed.data.barbers.map((barber) => ({
        id: barber.id,
        name: barber.name,
        avatarUrl: barber.avatarUrl === '' ? null : barber.avatarUrl ?? undefined,
      }));

      for (let index = 0; index < items.length; index += 1) {
        const file = form.get(`avatar_${index}`);
        if (file instanceof File && file.size > 0) {
          items[index]!.avatarUrl = await storeAvatar(file, items[index]!.id);
        }
      }
    } else {
      const parsed = payloadSchema.safeParse(await ctx.request.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
      }
      items = parsed.data.barbers.map((barber) => ({
        id: barber.id,
        name: barber.name,
        avatarUrl: barber.avatarUrl === '' ? null : barber.avatarUrl ?? undefined,
      }));
    }

    const existing = await prisma.barber.findMany({
      where: { shopId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((barber) => barber.id));
    const keptIds = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        if (item.id && existingIds.has(item.id)) {
          await tx.barber.update({
            where: { id: item.id },
            data: {
              name: item.name,
              ...(item.avatarUrl !== undefined ? { avatarUrl: item.avatarUrl } : {}),
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
              avatarUrl: item.avatarUrl || null,
              active: true,
              sortOrder: index,
            },
            select: { id: true },
          });
          keptIds.add(created.id);
        }
      }

      // Soft-deactivate barbers removed during onboarding (avoid deleting booked history).
      const toDeactivate = existing.filter((barber) => !keptIds.has(barber.id)).map((b) => b.id);
      if (toDeactivate.length > 0) {
        await tx.barber.updateMany({
          where: { id: { in: toDeactivate }, shopId },
          data: { active: false },
        });
      }
    });

    await advanceOnboardingStep(shopId, ONBOARDING_STEP_SERVICES);
    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save barbers.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
