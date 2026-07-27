export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_SERVICES,
  requireOnboardingAccess,
} from '@/lib/admin/onboarding';
import {
  linkMemberToBarber,
  unlinkMemberBarber,
} from '@/lib/admin/onboardingOwnerSeat';
import { prisma } from '@/lib/db/client';
import { getBlobReadWriteToken, makeBlobPath, uploadPublicImageToBlob } from '@/lib/storage/vercelBlob';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const barberSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'Barber name is required.').max(120),
  avatarUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  onlineBookings: z.boolean().optional(),
  intendedRole: z.enum(['MANAGER', 'BARBER']).optional(),
});

const payloadSchema = z.object({
  barbers: z.array(barberSchema).min(1, 'Add at least one barber.'),
});

type BarberItem = {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  onlineBookings: boolean;
  intendedRole: 'MANAGER' | 'BARBER';
};

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

function resolveOnlineBookings(
  solo: boolean,
  value: boolean | undefined,
): boolean {
  if (solo) return true;
  return value !== false;
}

function normalizeItems(
  barbers: Array<{
    id?: string;
    name: string;
    avatarUrl?: string | null;
    onlineBookings?: boolean;
    intendedRole?: 'MANAGER' | 'BARBER';
  }>,
): BarberItem[] {
  const solo = barbers.length === 1;
  return barbers.map((barber, index) => ({
    id: barber.id,
    name: barber.name,
    avatarUrl: barber.avatarUrl === '' ? null : barber.avatarUrl ?? undefined,
    onlineBookings: resolveOnlineBookings(solo, barber.onlineBookings),
    // Owner seat (index 0) never stores roster intent; extras default to BARBER.
    intendedRole: index === 0 ? 'BARBER' : barber.intendedRole === 'MANAGER' ? 'MANAGER' : 'BARBER',
  }));
}

export const PUT: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;
  const userId = access.userId!;

  try {
    const contentType = ctx.request.headers.get('content-type') ?? '';
    let items: BarberItem[] = [];

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
      items = normalizeItems(parsed.data.barbers);

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
      items = normalizeItems(parsed.data.barbers);
    }

    const owner = await prisma.shopMember.findFirst({
      where: { shopId, role: 'OWNER', userId },
      select: {
        id: true,
        userId: true,
        barberId: true,
        user: { select: { email: true } },
      },
    });
    if (!owner) {
      return new Response(JSON.stringify({ error: 'Owner membership not found.' }), { status: 404 });
    }

    const existing = await prisma.barber.findMany({
      where: { shopId },
      select: { id: true, userId: true },
    });
    const existingIds = new Set(existing.map((barber) => barber.id));

    // Prefer updating the owner's existing seat when card #0 omits id.
    if (!items[0]!.id) {
      if (owner.barberId && existingIds.has(owner.barberId)) {
        items[0]!.id = owner.barberId;
      } else if (items.length === 1) {
        const orphans = existing.filter((b) => !b.userId);
        if (orphans.length === 1) items[0]!.id = orphans[0]!.id;
      }
    }

    const keptIds = new Set<string>();

    await prisma.$transaction(async (tx) => {
      let ownerBarberId: string | null = null;

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        // Card #0 is always the Owner seat (linked), even when online bookings are off.
        const isOwnerSeat = index === 0;
        const active = item.onlineBookings;
        let barberId: string;

        if (item.id && existingIds.has(item.id)) {
          await tx.barber.update({
            where: { id: item.id },
            data: {
              name: item.name,
              ...(item.avatarUrl !== undefined ? { avatarUrl: item.avatarUrl } : {}),
              active,
              sortOrder: index,
              intendedRole: isOwnerSeat ? 'BARBER' : item.intendedRole,
              ...(isOwnerSeat
                ? { userId: owner.userId, email: owner.user.email }
                : { userId: null }),
            },
          });
          barberId = item.id;
        } else {
          const created = await tx.barber.create({
            data: {
              shopId,
              name: item.name,
              avatarUrl: item.avatarUrl || null,
              active,
              sortOrder: index,
              intendedRole: isOwnerSeat ? 'BARBER' : item.intendedRole,
              ...(isOwnerSeat
                ? { userId: owner.userId, email: owner.user.email }
                : {}),
            },
            select: { id: true },
          });
          barberId = created.id;
        }

        keptIds.add(barberId);
        if (isOwnerSeat) ownerBarberId = barberId;
      }

      // Soft-deactivate barbers removed during onboarding (avoid deleting booked history).
      const toDeactivate = existing.filter((barber) => !keptIds.has(barber.id)).map((b) => b.id);
      if (toDeactivate.length > 0) {
        await tx.barber.updateMany({
          where: { id: { in: toDeactivate }, shopId },
          data: { active: false, userId: null },
        });
      }

      if (ownerBarberId) {
        if (owner.barberId && owner.barberId !== ownerBarberId) {
          await unlinkMemberBarber(tx, { memberId: owner.id, barberId: owner.barberId });
        }
        await linkMemberToBarber(tx, {
          memberId: owner.id,
          barberId: ownerBarberId,
          userId: owner.userId,
          email: owner.user.email,
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
