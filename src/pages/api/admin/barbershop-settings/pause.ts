export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  isoDateToStoredPauseDate,
  isPauseActiveNow,
  SHOP_PAUSE_REASON_MIN_LENGTH,
  storedPauseDateToIso,
} from '@/lib/admin/shopPublicActivity';
import { normalizeToIsoDate } from '@/lib/booking/time';
import {
  isPreviewPublicActivityLocked,
  PREVIEW_PAUSE_LOCKED_MESSAGE,
} from '@/lib/preview/guestPreviewConstruction';
import { prisma } from '@/lib/db/client';

const armSchema = z.object({
  paused: z.literal(true),
  from: z.string().min(1),
  until: z.string().min(1),
  reason: z.string().min(1),
});

const disarmSchema = z.object({
  paused: z.literal(false),
});

const payloadSchema = z.union([armSchema, disarmSchema]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serializePause(shop: {
  publicActivityPaused: boolean;
  publicActivityPausedAt: Date | null;
  publicActivityPauseFrom: Date | null;
  publicActivityPauseUntil: Date | null;
  publicActivityPauseReason: string | null;
  timezone: string;
}) {
  return {
    paused: shop.publicActivityPaused,
    pausedNow: isPauseActiveNow(shop),
    pausedAt: shop.publicActivityPausedAt?.toISOString() ?? null,
    from: shop.publicActivityPauseFrom ? storedPauseDateToIso(shop.publicActivityPauseFrom) : null,
    until: shop.publicActivityPauseUntil ? storedPauseDateToIso(shop.publicActivityPauseUntil) : null,
    reason: shop.publicActivityPauseReason,
  };
}

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['shop.settings']);
  if (denied) return denied;

  try {
    const existing = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: { publicActivityPauseReason: true },
    });
    if (
      isPreviewPublicActivityLocked({
        via: access.via,
        pauseReason: existing?.publicActivityPauseReason,
      })
    ) {
      return json({ error: PREVIEW_PAUSE_LOCKED_MESSAGE, code: 'PREVIEW_PAUSE_LOCKED' }, 403);
    }

    const parsed = payloadSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 400);
    }

    const select = {
      publicActivityPaused: true,
      publicActivityPausedAt: true,
      publicActivityPauseFrom: true,
      publicActivityPauseUntil: true,
      publicActivityPauseReason: true,
      timezone: true,
    } as const;

    if (parsed.data.paused === false) {
      const updated = await prisma.shopSettings.update({
        where: { id: access.shopId },
        data: {
          publicActivityPaused: false,
          publicActivityPausedAt: null,
          publicActivityPauseFrom: null,
          publicActivityPauseUntil: null,
          publicActivityPauseReason: null,
        },
        select,
      });
      return json({ pause: serializePause(updated) });
    }

    const from = normalizeToIsoDate(parsed.data.from);
    const until = normalizeToIsoDate(parsed.data.until);
    const reason = parsed.data.reason.trim();

    if (!from || !until) {
      return json({ error: 'Pause dates must be valid calendar dates (YYYY-MM-DD).' }, 400);
    }
    if (from > until) {
      return json({ error: 'Pause start date must be on or before the end date.' }, 400);
    }
    if (reason.length < SHOP_PAUSE_REASON_MIN_LENGTH) {
      return json(
        {
          error: `Pause reason must be at least ${SHOP_PAUSE_REASON_MIN_LENGTH} characters. Customers see this on the booking form.`,
        },
        400,
      );
    }

    const updated = await prisma.shopSettings.update({
      where: { id: access.shopId },
      data: {
        publicActivityPaused: true,
        publicActivityPausedAt: new Date(),
        publicActivityPauseFrom: isoDateToStoredPauseDate(from),
        publicActivityPauseUntil: isoDateToStoredPauseDate(until),
        publicActivityPauseReason: reason,
      },
      select,
    });

    return json({ pause: serializePause(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update pause state.';
    return json({ error: message }, 500);
  }
};
