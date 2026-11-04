/**
 * Hub "Add to your website" writes for the draft shop's canonical records
 * (docs/site-data-contract.md §6): opening hours → ShopOpeningHours, business details →
 * ShopPublicProfile, barbershop name / town → ShopSettings. Same writers and the same shared schema as
 * the paid dashboard, so the data is already in place when the shop upgrades (the draft shop row becomes
 * the live shop).
 *
 * Renaming never changes a URL: ShopSettings.bookingSlug is allocated once and never re-derived from the
 * name (src/lib/booking/bookingSlug.ts), and hub/preview links use the request token, not the name.
 *
 * Services, team and products are not here: they have their own hub tabs, which call the dashboard's
 * /api/admin/* handlers (HUB_ADMIN_API_ALLOWLIST).
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { hubCanAddShopItems } from '@/lib/adminHub/addMenu';
import { recordDebouncedPreviewRequestEvent } from '@/lib/adminHub/ownerEditEvents';
import { replaceShopOpeningHours } from '@/lib/admin/shopOpeningHours';
import { minutesToTimeString } from '@/lib/admin/timeStrings';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  enforceHubDetailsRate,
  hubJson,
  hubLogRef,
  requireEditDetailsCapability,
  resolveHubApiContext,
  type HubSourceOf,
} from '@/lib/freePreview/hubApi';
import type { HubPageContext } from '@/lib/freePreview/hubPage';
import { writeShopPublicProfile } from '@/lib/shopData/profile';
import { businessProfilePatchSchema, openingHoursWeekSchema } from '@/lib/shopData/schema';
import { OPENING_HOURS_NONE_OPEN, openingRowsFromWeek, type OpeningDay } from '@/lib/shopData/openingHours';

export const HUB_SHOP_NOT_READY = 'Set up your shop first.';

export const HUB_SHOP_NAME_MAX = 120;
export const HUB_TOWN_CITY_MAX = 120;

/**
 * Business details the hub edits directly: the profile fields plus the barbershop name and town, which
 * live on the draft ShopSettings row. Description and Instagram go through /details (legacy mirror).
 */
export const hubProfilePatchSchema = businessProfilePatchSchema
  .pick({
    tagline: true,
    addressLine1: true,
    addressLine2: true,
    postcode: true,
    phone: true,
    email: true,
    facebookUrl: true,
    tiktokUrl: true,
  })
  .extend({
    shopName: z
      .string()
      .trim()
      .min(1, 'Enter your barbershop name.')
      .max(HUB_SHOP_NAME_MAX, `Keep the barbershop name to ${HUB_SHOP_NAME_MAX} characters or fewer.`)
      .optional(),
    townCity: z
      .union([z.string().trim().max(HUB_TOWN_CITY_MAX, `Keep the town or city to ${HUB_TOWN_CITY_MAX} characters or fewer.`), z.null()])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === null ? null : v || null)),
  })
  .strict();

export type HubProfilePatch = z.infer<typeof hubProfilePatchSchema>;

export const hubOpeningHoursBodySchema = z.object({ days: openingHoursWeekSchema }).strict();

export type HubProfilePublic = {
  shopName: string;
  townCity: string | null;
  tagline: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
};

function requestNames(ctx: HubPageContext): HubRequestNames {
  return { shopName: ctx.request.shopName, townCity: ctx.request.townCity };
}

function editableShopId(ctx: HubPageContext): string | null {
  if (!ctx.request.draftShopId) return null;
  if (!hubCanAddShopItems(ctx.state.stage)) return null;
  return ctx.request.draftShopId;
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

export async function loadHubOpeningWeek(shopId: string): Promise<{ saved: boolean; days: OpeningDay[] }> {
  const rows = await prisma.shopOpeningHours.findMany({
    where: { shopId },
    orderBy: [{ dayOfWeek: 'asc' }],
    select: { dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
  });
  const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]));
  const days = ([1, 2, 3, 4, 5, 6, 7] as const).map((dayOfWeek) => {
    const row = byDay.get(dayOfWeek);
    return row
      ? {
          dayOfWeek,
          isOpen: row.active,
          opens: minutesToTimeString(row.startMinutes),
          closes: minutesToTimeString(row.endMinutes),
        }
      : { dayOfWeek, isOpen: false, opens: '09:00', closes: '18:00' };
  });
  return { saved: rows.some((row) => row.active), days };
}

/** What the owner typed in the preview form: the prefill before the draft shop has its own name. */
type HubRequestNames = { shopName?: string | null; townCity?: string | null };

export function emptyHubProfile(fallback: HubRequestNames = {}): HubProfilePublic {
  return {
    shopName: fallback.shopName?.trim() ?? '',
    townCity: fallback.townCity?.trim() || null,
    tagline: null,
    addressLine1: null,
    addressLine2: null,
    postcode: null,
    phone: null,
    email: null,
    facebookUrl: null,
    tiktokUrl: null,
  };
}

export async function loadHubProfile(shopId: string, fallback: HubRequestNames = {}): Promise<HubProfilePublic> {
  const [shop, profile] = await Promise.all([
    prisma.shopSettings.findUnique({ where: { id: shopId }, select: { name: true, townCity: true } }),
    prisma.shopPublicProfile.findUnique({ where: { shopId } }),
  ]);
  const shopName = shop?.name?.trim() ?? '';
  return {
    // A draft shop with no name yet falls back to the owner's own preview request (both together, so the
    // town always belongs to the name it came with).
    shopName: shopName || fallback.shopName?.trim() || '',
    townCity: shopName ? (shop?.townCity ?? null) : fallback.townCity?.trim() || shop?.townCity || null,
    tagline: profile?.tagline ?? null,
    addressLine1: profile?.addressLine1 ?? null,
    addressLine2: profile?.addressLine2 ?? null,
    postcode: profile?.postcode ?? null,
    phone: profile?.phone ?? null,
    email: profile?.email ?? null,
    facebookUrl: profile?.facebookUrl ?? null,
    tiktokUrl: profile?.tiktokUrl ?? null,
  };
}

export function createHubOpeningHoursHandlers(sourceOf: HubSourceOf): { GET: APIRoute; PUT: APIRoute } {
  const GET: APIRoute = async ({ request, params }) => {
    const resolved = await resolveHubApiContext({ request, source: sourceOf(params), mutation: false });
    if (!resolved.ok) return resolved.response;
    const shopId = resolved.ctx.request.draftShopId;
    if (!shopId) return hubJson({ ok: true, ready: false, saved: false, days: null });
    return hubJson({ ok: true, ready: true, ...(await loadHubOpeningWeek(shopId)) });
  };

  const PUT: APIRoute = async ({ request, params }) => {
    const source = sourceOf(params);
    const limited = await enforceHubDetailsRate(request);
    if (limited) return limited;
    const resolved = await resolveHubApiContext({ request, source, mutation: true });
    if (!resolved.ok) return resolved.response;
    const denied = requireEditDetailsCapability(resolved.ctx);
    if (denied) return denied;
    const shopId = editableShopId(resolved.ctx);
    if (!shopId) return hubJson({ ok: false, error: HUB_SHOP_NOT_READY }, 409);

    const json = await readJson(request);
    if (!json.ok) return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
    const parsed = hubOpeningHoursBodySchema.safeParse(json.body);
    if (!parsed.success) {
      return hubJson({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid request body.' }, 400);
    }
    if (!parsed.data.days.some((day) => day.isOpen)) {
      return hubJson({ ok: false, error: OPENING_HOURS_NONE_OPEN }, 400);
    }

    try {
      const days = parsed.data.days as OpeningDay[];
      await replaceShopOpeningHours(shopId, openingRowsFromWeek(days));
      if (!resolved.ctx.isOperator) {
        await recordDebouncedPreviewRequestEvent({
          previewRequestId: resolved.ctx.request.id,
          action: PREVIEW_REQUEST_ACTIONS.OWNER_EDITED_HOURS,
          meta: { section: 'hours' },
        });
      }
      return hubJson({ ok: true, ready: true, ...(await loadHubOpeningWeek(shopId)) });
    } catch (error) {
      console.error('[admin-hub] opening hours save failed', {
        token: hubLogRef(source),
        error: error instanceof Error ? error.message : error,
      });
      return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  };

  return { GET, PUT };
}

export function createHubProfileHandlers(sourceOf: HubSourceOf): { GET: APIRoute; PATCH: APIRoute } {
  const GET: APIRoute = async ({ request, params }) => {
    const resolved = await resolveHubApiContext({ request, source: sourceOf(params), mutation: false });
    if (!resolved.ok) return resolved.response;
    const shopId = resolved.ctx.request.draftShopId;
    const names = requestNames(resolved.ctx);
    // No draft shop yet: the form still opens, prefilled from the preview request only.
    if (!shopId) return hubJson({ ok: true, ready: false, profile: emptyHubProfile(names) });
    return hubJson({ ok: true, ready: true, profile: await loadHubProfile(shopId, names) });
  };

  const PATCH: APIRoute = async ({ request, params }) => {
    const source = sourceOf(params);
    const limited = await enforceHubDetailsRate(request);
    if (limited) return limited;
    const resolved = await resolveHubApiContext({ request, source, mutation: true });
    if (!resolved.ok) return resolved.response;
    const denied = requireEditDetailsCapability(resolved.ctx);
    if (denied) return denied;
    const shopId = editableShopId(resolved.ctx);
    if (!shopId) return hubJson({ ok: false, error: HUB_SHOP_NOT_READY }, 409);

    const json = await readJson(request);
    if (!json.ok) return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
    const parsed = hubProfilePatchSchema.safeParse(json.body);
    if (!parsed.success) {
      return hubJson({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid request body.' }, 400);
    }

    const { shopName, townCity, ...profileFields } = parsed.data;
    try {
      await prisma.$transaction(async (tx) => {
        if (shopName !== undefined || townCity !== undefined) {
          await tx.shopSettings.update({
            where: { id: shopId },
            data: {
              ...(shopName !== undefined ? { name: shopName } : {}),
              ...(townCity !== undefined ? { townCity } : {}),
            },
          });
          // Keep the preview request (hub header, ops queue, emails) on the name the owner now uses.
          // PreviewRequest.townCity is required, so a cleared town leaves the request's own value.
          const requestData = {
            ...(shopName !== undefined ? { shopName } : {}),
            ...(townCity ? { townCity } : {}),
          };
          if (Object.keys(requestData).length) {
            await tx.previewRequest.update({ where: { id: resolved.ctx.request.id }, data: requestData });
          }
        }
        await writeShopPublicProfile(tx, shopId, profileFields);
      });
      if (!resolved.ctx.isOperator) {
        await recordDebouncedPreviewRequestEvent({
          previewRequestId: resolved.ctx.request.id,
          action: PREVIEW_REQUEST_ACTIONS.OWNER_EDITED_BUSINESS,
          meta: { fields: Object.keys(parsed.data) },
        });
      }
      return hubJson({ ok: true, ready: true, profile: await loadHubProfile(shopId, requestNames(resolved.ctx)) });
    } catch (error) {
      console.error('[admin-hub] business details save failed', {
        token: hubLogRef(source),
        error: error instanceof Error ? error.message : error,
      });
      return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  };

  return { GET, PATCH };
}
