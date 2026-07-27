export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  assertValidShopServices,
  assertValidWorkingHours,
  createBookingProfileForMember,
  isTeamCreationDomainError,
  logOrphanedTeamAvatarRisk,
  type WorkingHourInput,
} from '@/lib/admin/teamCreation';
import { storeAdminAvatar } from '@/lib/storage/storeAdminAvatar';
import { assertWorkingHoursWithinShopHours } from '@/lib/admin/shopOpeningHours';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

async function parseMultipart(request: Request): Promise<
  | { ok: true; body: BookingProfileBody; avatar: File | null }
  | { ok: false; response: Response }
> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return { ok: false, response: json({ error: 'Expected multipart form data.' }, 400) };
  }

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

/**
 * Set up online bookings for an existing dashboard ShopMember (no invite / email).
 * Creates Barber + services + hours and links ShopMember.barberId atomically.
 */
export const POST: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  const memberId = context.params.memberId;
  if (!memberId) {
    return json(
      { code: 'TEAM_MEMBER_NOT_FOUND', error: 'Team member not found.' },
      404,
    );
  }

  const parsed = await parseMultipart(context.request);
  if (!parsed.ok) return parsed.response;

  const { body, avatar } = parsed;

  const displayName = String(body.displayName || '').trim();
  if (!displayName) {
    return json({ error: 'Display name is required.' }, 400);
  }
  if (displayName.length > 80) {
    return json(
      {
        code: 'INVALID_DISPLAY_NAME',
        error: 'Display name must be 80 characters or fewer.',
      },
      400,
    );
  }

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

  const hours = assertValidWorkingHours(rawHours, { requireActiveDay: true });
  if (!hours.ok) {
    return json({ error: hours.error, code: hours.code }, 422);
  }

  const withinShopError = await assertWorkingHoursWithinShopHours(access.shopId, hours.hours);
  if (withinShopError) {
    return json({ error: withinShopError, code: 'OUTSIDE_SHOP_HOURS' }, 422);
  }

  let uploadedAvatarUrl: string | undefined;
  if (avatar) {
    try {
      uploadedAvatarUrl = await storeAdminAvatar(avatar, 'barbers');
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Could not upload avatar.' },
        400,
      );
    }
  }

  try {
    const result = await createBookingProfileForMember({
      shopId: access.shopId,
      memberId,
      actorRole: access.role,
      displayName,
      serviceIds: services.serviceIds,
      hours: hours.hours,
      uploadedAvatarUrl,
    });

    return json(
      {
        ok: true,
        barber: {
          id: result.barber.id,
          name: result.barber.name,
          active: result.barber.active,
          avatarUrl: result.barber.avatarUrl,
          email: result.barber.email,
          userId: result.barber.userId,
          serviceIds: result.barber.serviceIds,
        },
      },
      201,
    );
  } catch (error) {
    if (uploadedAvatarUrl) {
      logOrphanedTeamAvatarRisk({
        route: 'POST /api/admin/team/members/[memberId]/booking-profile',
        avatarUrl: uploadedAvatarUrl,
        error,
      });
    }
    if (isTeamCreationDomainError(error)) {
      return json(
        {
          error: error.error,
          code: error.code,
          ...(error.barberId ? { barberId: error.barberId } : {}),
        },
        error.status,
      );
    }
    console.error('[team/members/booking-profile] create failed', error);
    return json({ error: 'Could not set up online bookings.' }, 500);
  }
};
