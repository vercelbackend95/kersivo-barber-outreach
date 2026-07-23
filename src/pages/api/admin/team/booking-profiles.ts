export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  assertValidShopServices,
  assertValidWorkingHours,
  createStandaloneBookingProfile,
  type WorkingHourInput,
} from '@/lib/admin/teamCreation';
import { storeAdminAvatar } from '@/lib/storage/storeAdminAvatar';

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

  try {
    const created = await createStandaloneBookingProfile({
      shopId: access.shopId,
      name: displayName,
      serviceIds: services.serviceIds,
      hours: hours.hours,
      avatarUrl,
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
  } catch (error) {
    if (avatarUrl) {
      console.error(
        '[team/booking-profiles] DB transaction failed after avatar upload; orphan blob may remain',
        { avatarUrl, error },
      );
    }
    console.error('[team/booking-profiles] create failed', error);
    return json({ error: 'Could not create booking profile.' }, 500);
  }
};
