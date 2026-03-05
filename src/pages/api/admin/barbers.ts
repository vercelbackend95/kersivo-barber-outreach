export const prerender = false;

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import { ensureBarberHasAvailabilityRules } from '../../../lib/admin/defaultAvailability';
import { getTodayInLondon, getTodayScheduleForBarber } from '../../../lib/admin/todayWorkingHours';
import { prisma } from '../../../lib/db/client';
import type { Prisma } from '@prisma/client';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const DEFAULT_SERVICE_DEFINITIONS = [
  { id: 'svc-haircut', name: 'Haircut', durationMinutes: 30 },
  { id: 'svc-skin-fade', name: 'Skin Fade', durationMinutes: 45 },
  { id: 'svc-beard-trim', name: 'Beard Trim', durationMinutes: 20 },
  { id: 'svc-haircut-beard', name: 'Haircut + Beard', durationMinutes: 50 }
] as const;


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

async function ensureSelectedServices(tx: Prisma.TransactionClient, selectedServiceIds: string[]) {
  const requestedIds = selectedServiceIds.length > 0 ? selectedServiceIds : DEFAULT_SERVICE_DEFINITIONS.map((service) => service.id);
  const uniqueRequestedIds = Array.from(new Set(requestedIds));

  const existingServices = await tx.service.findMany({ where: { id: { in: uniqueRequestedIds } }, select: { id: true } });
  const existingIds = new Set(existingServices.map((service) => service.id));

  for (const definition of DEFAULT_SERVICE_DEFINITIONS) {
    if (!uniqueRequestedIds.includes(definition.id) || existingIds.has(definition.id)) continue;
    await tx.service.create({
      data: {
        id: definition.id,
        name: definition.name,
        durationMinutes: definition.durationMinutes,
        bufferMinutes: 0,
        active: true
      }
    });
    existingIds.add(definition.id);
  }

  return uniqueRequestedIds.filter((serviceId) => existingIds.has(serviceId));
}


async function storeAvatar(file: File) {
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

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'barbers');
  await mkdir(uploadsDir, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const filePath = path.join(uploadsDir, fileName);
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  return `/uploads/barbers/${fileName}`;
}


export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

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
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, avatarUrl: true, active: true, createdAt: true }
    });

    barbers = fallbackBarbers.map((barber, index) => ({ ...barber, sortOrder: index }));
  }
  const links = await prisma.barberService.findMany({ select: { barberId: true, serviceId: true } });
    const todayInLondon = getTodayInLondon();
  const todayRules = todayInLondon == null
    ? []
    : await prisma.availabilityRule.findMany({
        where: {
          barberId: { in: barbers.map((barber) => barber.id) },
          dayOfWeek: todayInLondon
        },
        orderBy: [{ barberId: 'asc' }, { startMinutes: 'asc' }]
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
      const todaySchedule = getTodayScheduleForBarber(rulesByBarberId.get(barber.id));
      return {
        ...barber,
        serviceIds: serviceIdsByBarber.get(barber.id) ?? [],
        isActive: barber.active,
        todayLabel: todaySchedule.todayLabel,
        todayIsOnShift: todaySchedule.todayIsOnShift
      };
    })

  }));

};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

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
        avatarUrl = await storeAvatar(avatar);
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
          const updatedBarber = await tx.barber.update({ where: { id }, data: payload });
          const validServiceIds = await ensureSelectedServices(tx, selectedServiceIds);
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
          const maxSort = await tx.barber.aggregate({ _max: { sortOrder: true } });
          const createdBarber = await tx.barber.create({ data: { ...payload, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 } });
          const validServiceIds = await ensureSelectedServices(tx, selectedServiceIds);
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
        const updatedBarber = await tx.barber.update({ where: { id }, data });
        if (serviceIds.length > 0) {
          const validServiceIds = await ensureSelectedServices(tx, serviceIds);
          await tx.barberService.deleteMany({ where: { barberId: updatedBarber.id } });
          await tx.barberService.createMany({
            data: validServiceIds.map((serviceId) => ({ barberId: updatedBarber.id, serviceId })),
            skipDuplicates: true
          });
        }
        return updatedBarber;
      })

    : await prisma.$transaction(async (tx) => {
        const maxSort = await tx.barber.aggregate({ _max: { sortOrder: true } });
        const createdBarber = await tx.barber.create({
          data: {
            name: name ?? 'Barber',
            email: email || null,
            avatarUrl: avatarUrl || null,
            active: typeof isActive === 'boolean' ? isActive : true,
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1
          }
        });
        const validServiceIds = await ensureSelectedServices(tx, serviceIds);
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
