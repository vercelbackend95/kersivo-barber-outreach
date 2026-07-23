export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { storeAdminAvatar } from '@/lib/storage/storeAdminAvatar';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type WorkingHourInput = {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  breakStartMin?: number | null;
  breakEndMin?: number | null;
  active?: boolean;
};

type BookingProfileBody = {
  displayName?: string;
  serviceIds?: string[];
  workingHours?: WorkingHourInput[];
};

function parseJsonArray<T>(raw: FormDataEntryValue | null): T[] {
  if (!raw) return [];
  const text = String(raw).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function countActiveWorkingDays(hours: WorkingHourInput[]): number {
  return hours.filter((row) => {
    const start = Number(row.startMinutes);
    const end = Number(row.endMinutes);
    return row.active !== false && Number.isFinite(start) && Number.isFinite(end) && end > start;
  }).length;
}

async function parseRequest(request: Request): Promise<
  | { ok: true; body: BookingProfileBody; avatar: File | null }
  | { ok: false; response: Response }
> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false, response: json({ error: 'Invalid form data.' }, 400) };
    }

    const avatarField = form.get('avatar');
    const avatar = avatarField instanceof File && avatarField.size > 0 ? avatarField : null;

    return {
      ok: true,
      body: {
        displayName: String(form.get('displayName') ?? ''),
        serviceIds: parseJsonArray<string>(form.get('serviceIds')).map(String).filter(Boolean),
        workingHours: parseJsonArray<WorkingHourInput>(form.get('workingHours')),
      },
      avatar,
    };
  }

  try {
    const body = (await request.json()) as BookingProfileBody;
    return { ok: true, body, avatar: null };
  } catch {
    return { ok: false, response: json({ error: 'Invalid JSON.' }, 400) };
  }
}

/**
 * Create a standalone booking profile (Barber) with no dashboard account / invite.
 * Used when Online bookings On and Dashboard access Off.
 */
export const POST: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  // Barber role cannot add team members (permissions already block, belt-and-braces).
  if (access.role === 'BARBER') {
    return json({ error: 'Forbidden.' }, 403);
  }

  const parsed = await parseRequest(context.request);
  if (!parsed.ok) return parsed.response;

  const { body, avatar } = parsed;

  const displayName = String(body.displayName || '')
    .trim()
    .slice(0, 80);
  if (!displayName) {
    return json({ error: 'Display name is required.' }, 400);
  }

  const serviceIds = Array.isArray(body.serviceIds)
    ? body.serviceIds.map(String).filter(Boolean)
    : [];
  if (serviceIds.length === 0) {
    return json({ error: 'Select at least one service for online bookings.' }, 400);
  }

  const hours = Array.isArray(body.workingHours) ? body.workingHours : [];
  if (countActiveWorkingDays(hours) === 0) {
    return json({ error: 'Add at least one working day for online bookings.' }, 400);
  }

  const validServices = await prisma.service.findMany({
    where: { shopId: access.shopId, id: { in: serviceIds }, isActive: true },
    select: { id: true },
  });
  if (validServices.length === 0) {
    return json({ error: 'Select at least one service for online bookings.' }, 400);
  }

  const maxSort = await prisma.barber.aggregate({
    where: { shopId: access.shopId },
    _max: { sortOrder: true },
  });

  let avatarUrl: string | undefined;
  if (avatar) {
    try {
      avatarUrl = await storeAdminAvatar(avatar, 'barbers');
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Could not upload avatar.' },
        400,
      );
    }
  }

  const created = await prisma.barber.create({
    data: {
      shopId: access.shopId,
      name: displayName,
      active: true,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
    select: {
      id: true,
      name: true,
      active: true,
      avatarUrl: true,
      email: true,
      userId: true,
    },
  });

  await prisma.barberService.createMany({
    data: validServices.map((s) => ({ barberId: created.id, serviceId: s.id })),
    skipDuplicates: true,
  });

  await prisma.availabilityRule.createMany({
    data: hours.map((row) => ({
      barberId: created.id,
      dayOfWeek: Number(row.dayOfWeek),
      startMinutes: Number(row.startMinutes),
      endMinutes: Number(row.endMinutes),
      breakStartMin: row.breakStartMin ?? null,
      breakEndMin: row.breakEndMin ?? null,
      active: row.active !== false,
    })),
  });

  return json(
    {
      ok: true,
      barber: {
        id: created.id,
        name: created.name,
        active: created.active,
        avatarUrl: created.avatarUrl,
        email: created.email,
        userId: created.userId,
      },
    },
    201,
  );
};
