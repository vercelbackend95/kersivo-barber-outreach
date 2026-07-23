export const prerender = false;

import type { APIRoute } from 'astro';
import type { ShopRole } from '@prisma/client';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  assertCanInviteRole,
  createInviteToken,
} from '@/lib/admin/rbac/members';
import {
  assertValidShopServices,
  assertValidWorkingHours,
  createTeamInviteWithOptionalProfile,
  findInviteCreationConflict,
  isTeamCreationDomainError,
  type WorkingHourInput,
} from '@/lib/admin/teamCreation';
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

  const bookable = Boolean(body.bookable);

  const earlyConflict = await findInviteCreationConflict({
    shopId: access.shopId,
    email,
    bookable,
  });
  if (earlyConflict) {
    return json(
      {
        error: earlyConflict.error,
        code: earlyConflict.code,
        ...(earlyConflict.inviteId ? { inviteId: earlyConflict.inviteId } : {}),
        ...(earlyConflict.barberId ? { barberId: earlyConflict.barberId } : {}),
      },
      409,
    );
  }

  let serviceIds: string[] | undefined;
  let hoursValidated: ReturnType<typeof assertValidWorkingHours> | undefined;

  if (bookable) {
    const rawServiceIds = Array.isArray(body.serviceIds) ? body.serviceIds : [];
    if (rawServiceIds.length === 0) {
      return json({ error: 'Select at least one service for online bookings.' }, 400);
    }

    const rawHours = Array.isArray(body.workingHours) ? body.workingHours : [];
    if (rawHours.length === 0) {
      return json({ error: 'Add at least one working day for online bookings.' }, 400);
    }

    const services = await assertValidShopServices({
      shopId: access.shopId,
      serviceIds: rawServiceIds,
    });
    if (!services.ok) {
      return json({ error: services.error, code: services.code }, 422);
    }
    serviceIds = services.serviceIds;

    hoursValidated = assertValidWorkingHours(rawHours, { requireActiveDay: true });
    if (!hoursValidated.ok) {
      return json({ error: hoursValidated.error, code: hoursValidated.code }, 422);
    }
  }

  // Dashboard-only: never store an avatar. Bookable: upload only after validation/conflicts.
  let avatarUrl: string | undefined;
  if (bookable && avatar) {
    try {
      avatarUrl = await storeAdminAvatar(avatar, 'barbers');
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Could not upload avatar.' },
        400,
      );
    }
  }

  const { token, tokenHash } = createInviteToken();

  let invite;
  try {
    const created = await createTeamInviteWithOptionalProfile({
      shopId: access.shopId,
      email,
      role: body.role,
      displayName,
      bookable,
      tokenHash,
      invitedByUserId: access.userId,
      serviceIds,
      hours: hoursValidated?.ok ? hoursValidated.hours : undefined,
      avatarUrl,
    });
    invite = created.invite;
  } catch (error) {
    if (isTeamCreationDomainError(error)) {
      return json(
        {
          error: error.error,
          code: error.code,
          ...(error.inviteId ? { inviteId: error.inviteId } : {}),
          ...(error.barberId ? { barberId: error.barberId } : {}),
        },
        error.status,
      );
    }
    if (avatarUrl) {
      console.error(
        '[team/invite] DB transaction failed after avatar upload; orphan blob may remain',
        { avatarUrl, error },
      );
    }
    console.error('[team/invite] create failed', error);
    return json({ error: 'Could not create invitation.' }, 500);
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: { name: true },
  });

  const acceptUrl = `${getPublicSiteUrl()}/admin/invite?token=${encodeURIComponent(token)}`;
  let emailSent = true;
  try {
    await sendShopTeamInviteEmail({
      to: email,
      shopName: shop?.name || 'your barbershop',
      role: body.role,
      acceptUrl,
    });
  } catch (error) {
    emailSent = false;
    console.error('[team/invite] email failed', error);
  }

  return json(
    {
      ok: true,
      invite,
      acceptPath: `/admin/invite?token=${encodeURIComponent(token)}`,
      emailSent,
      ...(emailSent
        ? {}
        : {
            warning: 'The invitation was created, but the email could not be sent.',
          }),
    },
    201,
  );
};
