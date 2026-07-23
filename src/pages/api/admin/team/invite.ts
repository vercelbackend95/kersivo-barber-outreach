export const prerender = false;

import type { APIRoute } from 'astro';
import type { ShopRole } from '@prisma/client';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  assertCanInviteRole,
  createInviteToken,
  inviteExpiresAt,
} from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { sendShopTeamInviteEmail } from '@/lib/email/sender';
import { storeAdminAvatar } from '@/lib/storage/storeAdminAvatar';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isInviteRole(value: unknown): value is 'MANAGER' | 'BARBER' {
  return value === 'MANAGER' || value === 'BARBER';
}

type WorkingHourInput = {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  breakStartMin?: number | null;
  breakEndMin?: number | null;
  active?: boolean;
};

type InviteBody = {
  email?: string;
  role?: string;
  displayName?: string;
  bookable?: boolean;
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

function parseBookableFlag(raw: FormDataEntryValue | null | undefined): boolean {
  if (typeof raw === 'boolean') return raw;
  if (raw == null) return false;
  const text = String(raw).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'on';
}

function countActiveWorkingDays(hours: WorkingHourInput[]): number {
  return hours.filter((row) => {
    const start = Number(row.startMinutes);
    const end = Number(row.endMinutes);
    return row.active !== false && Number.isFinite(start) && Number.isFinite(end) && end > start;
  }).length;
}

async function parseInviteRequest(request: Request): Promise<
  | { ok: true; body: InviteBody; avatar: File | null }
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
        email: String(form.get('email') ?? ''),
        role: String(form.get('role') ?? ''),
        displayName: String(form.get('displayName') ?? ''),
        bookable: parseBookableFlag(form.get('bookable')),
        serviceIds: parseJsonArray<string>(form.get('serviceIds')).map(String).filter(Boolean),
        workingHours: parseJsonArray<WorkingHourInput>(form.get('workingHours')),
      },
      avatar,
    };
  }

  try {
    const body = (await request.json()) as InviteBody;
    return {
      ok: true,
      body: {
        ...body,
        bookable: Boolean(body.bookable),
      },
      avatar: null,
    };
  } catch {
    return { ok: false, response: json({ error: 'Invalid JSON.' }, 400) };
  }
}

export const POST: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  const parsed = await parseInviteRequest(context.request);
  if (!parsed.ok) return parsed.response;

  const { body, avatar } = parsed;

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    return json({ error: 'Enter a valid email address to send an invitation.' }, 400);
  }

  if (!isInviteRole(body.role)) {
    return json({ error: 'role must be MANAGER or BARBER.' }, 400);
  }

  const roleDenied = await assertCanInviteRole(access.role, body.role as ShopRole);
  if (roleDenied) return roleDenied;

  const displayName = String(body.displayName || '')
    .trim()
    .slice(0, 80);
  if (!displayName) {
    return json({ error: 'Display name is required.' }, 400);
  }

  // Dashboard invitation always; respect submitted online-booking choice (no Barber force).
  const bookable = Boolean(body.bookable);

  const existingMember = await prisma.shopMember.findFirst({
    where: { shopId: access.shopId, user: { email } },
    select: { id: true },
  });
  if (existingMember) {
    return json({ error: 'This email already belongs to a member of this shop.' }, 409);
  }

  const openInvite = await prisma.shopInvite.findFirst({
    where: {
      shopId: access.shopId,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (openInvite) {
    return json({ error: 'An invitation is already pending for this email.' }, 409);
  }

  let barberId: string | null = null;

  if (bookable) {
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
        email,
        active: true,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
      select: { id: true },
    });
    barberId = created.id;

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
  }
  // bookable false: invite only — never create a Barber for avatar/name storage

  const { token, tokenHash } = createInviteToken();
  const invite = await prisma.shopInvite.create({
    data: {
      shopId: access.shopId,
      email,
      role: body.role,
      tokenHash,
      barberId,
      displayName,
      bookable,
      invitedByUserId: access.userId,
      expiresAt: inviteExpiresAt(),
    },
    select: {
      id: true,
      email: true,
      role: true,
      barberId: true,
      displayName: true,
      bookable: true,
      expiresAt: true,
    },
  });

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: { name: true },
  });

  const acceptUrl = `${getPublicSiteUrl()}/admin/invite?token=${encodeURIComponent(token)}`;
  try {
    await sendShopTeamInviteEmail({
      to: email,
      shopName: shop?.name || 'your barbershop',
      role: body.role,
      acceptUrl,
    });
  } catch (error) {
    console.error('[team/invite] email failed', error);
  }

  return json(
    {
      ok: true,
      invite,
      acceptPath: `/admin/invite?token=${encodeURIComponent(token)}`,
    },
    201,
  );
};
