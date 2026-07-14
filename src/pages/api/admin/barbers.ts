export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../lib/admin/auth';
import { ensureBarberHasAvailabilityRules } from '../../../lib/admin/defaultAvailability';
import { getTodayInLondon, getTodayScheduleForBarber, getTodayShiftWindowForBarber } from '../../../lib/admin/todayWorkingHours';
import { prisma } from '../../../lib/db/client';
import { getBlobReadWriteToken, makeBlobPath, uploadPublicImageToBlob } from '../../../lib/storage/vercelBlob';
import type { Prisma } from '@prisma/client';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const jsonSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required.').optional(),
  email: z.string().email().optional().or(z.literal('')),
  avatarUrl: z.string().trim().url().optional().or(z.literal('')),
  active: z.boolean().optional(),
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string()).optional()

});

function getExtensionForType(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return null;
}
function parseServiceIds(rawValue: FormDataEntryValue | null): string[] {
  if (!rawValue) return [];
  const rawText = String(rawValue).trim();
  if (!rawText) return [];

  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value).trim()).filter(Boolean);
    }
  } catch {
    return rawText.split(',').map((value) => value.trim()).filter(Boolean);
  }

  return [];
}

async function ensureSelectedServices(tx: Prisma.TransactionClient, selectedServiceIds: string[], shopId: string) {
  if (selectedServiceIds.length === 0) return [];

  const uniqueRequestedIds = Array.from(new Set(selectedServiceIds));
  const existingServices = await tx.service.findMany({
    where: { id: { in: uniqueRequestedIds }, shopId },
    select: { id: true }
  });
  const existingIds = new Set(existingServices.map((service) => service.id));
  return uniqueRequestedIds.filter((serviceId) => existingIds.has(serviceId));
}
async function storeAvatar(file: File, barberId?: string) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error('Avatar must be a JPG, PNG, or WEBP image.');
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error('Avatar is too large. Maximum size is 5MB.');
  }

  const extension = getExtensionForType(file.type);
  if (!extension) {
    throw new Error('Unsupported avatar format.');
  }
  if (!getBlobReadWriteToken()) {
    throw new Error('Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN before uploading barber avatars.');
  }


  const pathname = makeBlobPath('barbers', file, barberId);
  return uploadPublicImageToBlob(file, pathname);

}


export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  type BarberListItem = {
    id: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    active: boolean;
    sortOrder: number;
    createdAt: Date;
  };

  let barbers: BarberListItem[];




  try {
    barbers = await prisma.barber.findMany({
      where: { shopId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, avatarUrl: true, active: true, sortOrder: true, createdAt: true }
    });
  } catch (error) {
    const isMissingSortOrderColumn = error instanceof Error
      && 'code' in error
      && (error as { code?: string }).code === 'P2022'
      && 'meta' in error
      && String((error as { meta?: { column?: string } }).meta?.column ?? '').includes('Barber.sortOrder');


    if (!isMissingSortOrderColumn) {
      throw error;
    }

    const fallbackBarbers = await prisma.barber.findMany({
      where: { shopId },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, avatarUrl: true, active: true, createdAt: true }
    });

    barbers = fallbackBarbers.map((barber, index) => ({ ...barber, sortOrder: index }));
  }
  const links = await prisma.barberService.findMany({
    where: { barberId: { in: barbers.map((b) => b.id) } },
    select: { barberId: true, serviceId: true }
  });
    const todayInLondon = getTodayInLondon();
  const todayRules = todayInLondon == null
    ? []
    : await prisma.availabilityRule.findMany({
        where: {
          barberId: { in: barbers.map((barber) => barber.id) },
          dayOfWeek: todayInLondon
        },
        orderBy: [{ barberId: 'asc' }, { startMinutes: 'asc' }],
        select: {
          barberId: true,
          active: true,
          startMinutes: true,
          endMinutes: true,
          breakStartMin: true,
          breakEndMin: true
        }
      });


  const serviceIdsByBarber = new Map<string, string[]>();

  for (const link of links) {
    const existing = serviceIdsByBarber.get(link.barberId);
    if (existing) {
      existing.push(link.serviceId);
    } else {
      serviceIdsByBarber.set(link.barberId, [link.serviceId]);
    }
  }
  const rulesByBarberId = new Map<string, typeof todayRules>();
  for (const rule of todayRules) {
    const existingRules = rulesByBarberId.get(rule.barberId);
    if (existingRules) {
      existingRules.push(rule);
    } else {
      rulesByBarberId.set(rule.barberId, [rule]);
    }
  }


  return new Response(JSON.stringify({
    barbers: barbers.map((barber) => {
      const rules = rulesByBarberId.get(barber.id);
      const todaySchedule = getTodayScheduleForBarber(rules);
      const todayShiftWindow = getTodayShiftWindowForBarber(rules);
      return {
        ...barber,
        serviceIds: serviceIdsByBarber.get(barber.id) ?? [],
        isActive: barber.active,
        todayLabel: todaySchedule.todayLabel,
        todayIsOnShift: todaySchedule.todayIsOnShift,
        todayShiftWindow
      };
    })

  }));

};

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  const contentType = ctx.request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await ctx.request.formData();
    const id = String(form.get('id') ?? '').trim() || undefined;
    const name = String(form.get('name') ?? '').trim();
    const isActiveRaw = String(form.get('isActive') ?? 'true').trim().toLowerCase();
    const isActive = isActiveRaw !== 'false';
        const selectedServiceIds = parseServiceIds(form.get('serviceIds'));
    const avatar = form.get('avatar');

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required.' }), { status: 400 });
    }
    if (selectedServiceIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Select at least one service.' }), { status: 400 });
    }


    let avatarUrl: string | undefined;
    if (avatar instanceof File && avatar.size > 0) {
      try {
        avatarUrl = await storeAvatar(avatar, id);
      } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Could not upload avatar.' }), { status: 400 });
      }
    }

    const payload = {
      name,
      active: isActive,
      ...(avatarUrl ? { avatarUrl } : {})
    };

    const barber = id
      ? await prisma.$transaction(async (tx) => {
          const existing = await tx.barber.findFirst({ where: { id, shopId }, select: { id: true } });
          if (!existing) throw new Error('Barber not found.');
          const updatedBarber = await tx.barber.update({ where: { id }, data: payload });
          const validServiceIds = await ensureSelectedServices(tx, selectedServiceIds, shopId);
          await tx.barberService.deleteMany({ where: { barberId: updatedBarber.id } });
          if (validServiceIds.length > 0) {
            await tx.barberService.createMany({
              data: validServiceIds.map((serviceId) => ({ barberId: updatedBarber.id, serviceId })),
              skipDuplicates: true
            });
          }
          return updatedBarber;
        })

      : await prisma.$transaction(async (tx) => {
          const maxSort = await tx.barber.aggregate({ where: { shopId }, _max: { sortOrder: true } });
          const createdBarber = await tx.barber.create({
            data: { ...payload, shopId, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 }
          });
          const validServiceIds = await ensureSelectedServices(tx, selectedServiceIds, shopId);
          if (validServiceIds.length > 0) {

            await tx.barberService.createMany({
              data: validServiceIds.map((serviceId) => ({ barberId: createdBarber.id, serviceId })),
              skipDuplicates: true
            });
          }

          return createdBarber;

        });

    if (barber.active) {
      await ensureBarberHasAvailabilityRules(barber.id);
    }


    return new Response(JSON.stringify({ barber: { ...barber, isActive: barber.active } }));
  }

  const parsed = jsonSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const { id, email, name, avatarUrl, active, isActive, serviceIds = [] } = parsed.data;
  const data = {
    ...(name ? { name } : {}),
    ...(typeof active === 'boolean' ? { active } : {}),
    ...(typeof isActive === 'boolean' ? { active: isActive } : {}),
    ...(typeof avatarUrl === 'string' ? { avatarUrl: avatarUrl || null } : {}),
    email: email || null
  };

  const barber = id
    ? await prisma.$transaction(async (tx) => {
        const existing = await tx.barber.findFirst({ where: { id, shopId }, select: { id: true } });
        if (!existing) throw new Error('Barber not found.');
        const updatedBarber = await tx.barber.update({ where: { id }, data });
        if (serviceIds.length > 0) {
          const validServiceIds = await ensureSelectedServices(tx, serviceIds, shopId);
          await tx.barberService.deleteMany({ where: { barberId: updatedBarber.id } });
          await tx.barberService.createMany({
            data: validServiceIds.map((serviceId) => ({ barberId: updatedBarber.id, serviceId })),
            skipDuplicates: true
          });
        }
        return updatedBarber;
      })

    : await prisma.$transaction(async (tx) => {
        const maxSort = await tx.barber.aggregate({ where: { shopId }, _max: { sortOrder: true } });
        const createdBarber = await tx.barber.create({
          data: {
            shopId,
            name: name ?? 'Barber',
            email: email || null,
            avatarUrl: avatarUrl || null,
            active: typeof isActive === 'boolean' ? isActive : true,
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1
          }
        });
        const validServiceIds = await ensureSelectedServices(tx, serviceIds, shopId);
        if (validServiceIds.length > 0) {

          await tx.barberService.createMany({
            data: validServiceIds.map((serviceId) => ({ barberId: createdBarber.id, serviceId })),
            skipDuplicates: true
          });
        }

        return createdBarber;

      });

  if (barber.active) {
    await ensureBarberHasAvailabilityRules(barber.id);

  }


  return new Response(JSON.stringify({ barber: { ...barber, isActive: barber.active } }));

};
