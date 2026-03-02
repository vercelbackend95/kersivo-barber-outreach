export const prerender = false;

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import { ensureBarberHasAllServices, ensureBarberHasAvailabilityRules } from '../../../lib/admin/defaultAvailability';
import { prisma } from '../../../lib/db/client';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const jsonSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required.').optional(),
  email: z.string().email().optional().or(z.literal('')),
  avatarUrl: z.string().trim().url().optional().or(z.literal('')),
  active: z.boolean().optional(),
  isActive: z.boolean().optional()
});

function getExtensionForType(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return null;
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
    barberServices: { serviceId: string }[];
  };

  let barbers: BarberListItem[];




  try {
    barbers = await prisma.barber.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, avatarUrl: true, active: true, sortOrder: true, createdAt: true, barberServices: { select: { serviceId: true } } }
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
      select: { id: true, name: true, email: true, avatarUrl: true, active: true, createdAt: true, barberServices: { select: { serviceId: true } } }
    });

    barbers = fallbackBarbers.map((barber, index) => ({ ...barber, sortOrder: index }));
  }

  return new Response(JSON.stringify({
    barbers: barbers.map((barber) => ({
      ...barber,
            serviceIds: barber.barberServices.map((item) => item.serviceId),
      isActive: barber.active
    }))
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
    const avatar = form.get('avatar');

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required.' }), { status: 400 });
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
      ? await prisma.barber.update({ where: { id }, data: payload })
      : await prisma.$transaction(async (tx) => {
          const maxSort = await tx.barber.aggregate({ _max: { sortOrder: true } });
          const createdBarber = await tx.barber.create({ data: { ...payload, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 } });
          const services = await tx.service.findMany({ where: { active: true }, select: { id: true } });

          if (services.length > 0) {
            await tx.barberService.createMany({
              data: services.map((service) => ({ barberId: createdBarber.id, serviceId: service.id })),
              skipDuplicates: true
            });
          }

          return createdBarber;

        });

    if (barber.active) {
      await ensureBarberHasAvailabilityRules(barber.id);
      await ensureBarberHasAllServices(barber.id);
    }


    return new Response(JSON.stringify({ barber: { ...barber, isActive: barber.active } }));
  }

  const parsed = jsonSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const { id, email, name, avatarUrl, active, isActive } = parsed.data;
  const data = {
    ...(name ? { name } : {}),
    ...(typeof active === 'boolean' ? { active } : {}),
    ...(typeof isActive === 'boolean' ? { active: isActive } : {}),
    ...(typeof avatarUrl === 'string' ? { avatarUrl: avatarUrl || null } : {}),
    email: email || null
  };

  const barber = id
    ? await prisma.barber.update({ where: { id }, data })
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
                const services = await tx.service.findMany({ where: { active: true }, select: { id: true } });

        if (services.length > 0) {
          await tx.barberService.createMany({
            data: services.map((service) => ({ barberId: createdBarber.id, serviceId: service.id })),
            skipDuplicates: true
          });
        }

        return createdBarber;

      });

  if (barber.active) {
    await ensureBarberHasAvailabilityRules(barber.id);
    await ensureBarberHasAllServices(barber.id);
  }


  return new Response(JSON.stringify({ barber: { ...barber, isActive: barber.active } }));

};
