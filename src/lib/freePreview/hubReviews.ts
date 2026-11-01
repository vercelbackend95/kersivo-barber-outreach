import { z } from 'zod';
import { Prisma, type PreviewContentReviewState, type PreviewContentSection } from '@prisma/client';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { prisma } from '@/lib/db/client';
import { DEFAULT_ONBOARDING_HOURS, type OnboardingWeeklyRule } from '@/lib/admin/shopOpeningHours';
import { minutesToTimeString, timeStringToMinutes } from '@/lib/admin/timeStrings';
import { ALL_WEEKDAYS } from '@/lib/booking/weekdays';
import {
  HUB_REVIEW_INVALID_BIO,
  HUB_REVIEW_INVALID_DURATION,
  HUB_REVIEW_INVALID_HOURS,
  HUB_REVIEW_INVALID_PHOTO,
  HUB_REVIEW_INVALID_PRICE,
  HUB_REVIEW_INVALID_SERVICE_NAME,
  HUB_REVIEW_INVALID_TEAM_NAME,
  HUB_NOW_REVIEW_NEED_ALL,
  HUB_NOW_REVIEW_NEED_DONE,
} from './hubCopy';

export {
  HUB_REVIEW_SECTIONS,
  cardStateFromReview,
  formatGbpPence,
  hoursFingerprint,
  hoursToWeeklyRules,
  servicesFingerprint,
  teamFingerprint,
  type HubReviewCardState,
  type HubReviewPublic,
  type HubReviewSection,
  type HubReviewShopBarber,
  type HubReviewShopData,
  type HubReviewShopHours,
  type HubReviewShopService,
} from './hubReviews.shared';
import {
  HUB_REVIEW_SECTIONS,
  cardStateFromReview,
  formatGbpPence,
  hoursFingerprint,
  hoursToWeeklyRules,
  servicesFingerprint,
  teamFingerprint,
  type HubReviewCardState,
  type HubReviewPublic,
  type HubReviewSection,
  type HubReviewShopBarber,
  type HubReviewShopData,
  type HubReviewShopHours,
  type HubReviewShopService,
} from './hubReviews.shared';

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const hubServiceRowSchema = z.object({
  id: z.string().trim().min(1).max(64).optional().nullable(),
  clientId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1, HUB_REVIEW_INVALID_SERVICE_NAME).max(80, HUB_REVIEW_INVALID_SERVICE_NAME),
  durationMinutes: z.number().int().min(5, HUB_REVIEW_INVALID_DURATION).max(480, HUB_REVIEW_INVALID_DURATION),
  pricePence: z.number().int().min(0, HUB_REVIEW_INVALID_PRICE).max(99999, HUB_REVIEW_INVALID_PRICE),
  removed: z.boolean().optional(),
});

export const hubServicesProposalSchema = z.object({
  services: z.array(hubServiceRowSchema).min(1).max(80),
  baseline: z.string().min(1).max(20_000),
});

export const hubTeamRowSchema = z.object({
  id: z.string().trim().min(1).max(64).optional().nullable(),
  clientId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1, HUB_REVIEW_INVALID_TEAM_NAME).max(60, HUB_REVIEW_INVALID_TEAM_NAME),
  bio: z.string().trim().max(280, HUB_REVIEW_INVALID_BIO).optional().default(''),
  showOnWebsite: z.boolean(),
  photoAssetId: z.string().trim().min(1).max(64).optional().nullable(),
  removed: z.boolean().optional(),
});

export const hubTeamProposalSchema = z.object({
  barbers: z.array(hubTeamRowSchema).min(1).max(40),
  baseline: z.string().min(1).max(20_000),
});

export const hubHoursDaySchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  open: z.boolean(),
  start: z.string().regex(timeRe, HUB_REVIEW_INVALID_HOURS),
  end: z.string().regex(timeRe, HUB_REVIEW_INVALID_HOURS),
});

export const hubHoursProposalSchema = z
  .object({
    days: z.array(hubHoursDaySchema).length(7, HUB_REVIEW_INVALID_HOURS),
    baseline: z.string().min(1).max(20_000),
  })
  .superRefine((value, ctx) => {
    const days = new Set(value.days.map((day) => day.dayOfWeek));
    if (days.size !== 7) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: HUB_REVIEW_INVALID_HOURS });
      return;
    }
    for (const day of value.days) {
      if (day.open && timeStringToMinutes(day.start) >= timeStringToMinutes(day.end)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: HUB_REVIEW_INVALID_HOURS });
        return;
      }
    }
  });

export const hubReviewPostSchema = z.union([
  z.object({
    action: z.literal('confirmed'),
    section: z.enum(HUB_REVIEW_SECTIONS),
  }),
  z.object({
    action: z.literal('corrections'),
    section: z.literal('SERVICES'),
    proposal: hubServicesProposalSchema,
  }),
  z.object({
    action: z.literal('corrections'),
    section: z.literal('TEAM'),
    proposal: hubTeamProposalSchema,
  }),
  z.object({
    action: z.literal('corrections'),
    section: z.literal('HOURS'),
    proposal: hubHoursProposalSchema,
  }),
]);

export type HubReviewPost = z.infer<typeof hubReviewPostSchema>;
export type HubServicesProposal = z.infer<typeof hubServicesProposalSchema>;
export type HubTeamProposal = z.infer<typeof hubTeamProposalSchema>;
export type HubHoursProposal = z.infer<typeof hubHoursProposalSchema>;


export function defaultHubHours(): HubReviewShopHours[] {
  return DEFAULT_ONBOARDING_HOURS.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    open: row.active,
    start: row.startTime,
    end: row.endTime,
  }));
}

type ReviewDb = {
  service: Pick<typeof prisma.service, 'findMany'>;
  barber: Pick<typeof prisma.barber, 'findMany'>;
  shopOpeningHours: Pick<typeof prisma.shopOpeningHours, 'findMany'>;
  previewHubAsset: Pick<typeof prisma.previewHubAsset, 'findMany'>;
};

export async function loadHubReviewShopData(
  shopId: string,
  previewRequestId: string,
  db: ReviewDb = prisma,
): Promise<HubReviewShopData> {
  const [services, barbers, hourRows, teamPhotos] = await Promise.all([
    db.service.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, durationMinutes: true, pricePence: true },
    }),
    db.barber.findMany({
      where: { shopId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    db.shopOpeningHours.findMany({
      where: { shopId },
      select: { dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
    }),
    db.previewHubAsset.findMany({
      where: { previewRequestId, kind: 'TEAM_PHOTO', deletedAt: null, barberId: { not: null } },
      select: { id: true, barberId: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const photoByBarber = new Map<string, string>();
  for (const photo of teamPhotos) {
    if (photo.barberId && !photoByBarber.has(photo.barberId)) photoByBarber.set(photo.barberId, photo.id);
  }

  const hoursByDay = new Map(hourRows.map((row) => [row.dayOfWeek, row]));
  const defaults = defaultHubHours();
  const hours = ALL_WEEKDAYS.map((dayOfWeek) => {
    const row = hoursByDay.get(dayOfWeek);
    const fallback = defaults.find((day) => day.dayOfWeek === dayOfWeek)!;
    if (!row) {
      return hourRows.length === 0
        ? fallback
        : { dayOfWeek, open: false, start: fallback.start, end: fallback.end };
    }
    return {
      dayOfWeek,
      open: row.active,
      start: minutesToTimeString(row.startMinutes),
      end: minutesToTimeString(row.endMinutes),
    };
  });

  return {
    shopId,
    services,
    barbers: barbers.map((barber) => ({
      id: barber.id,
      name: barber.name,
      photoAssetId: photoByBarber.get(barber.id) ?? null,
    })),
    hours,
  };
}

export async function loadLatestHubReviews(previewRequestId: string): Promise<Record<HubReviewSection, HubReviewPublic | null>> {
  const rows = await prisma.previewContentReview.findMany({
    where: { previewRequestId },
    orderBy: { createdAt: 'desc' },
  });
  const latest = {
    SERVICES: null as HubReviewPublic | null,
    TEAM: null as HubReviewPublic | null,
    HOURS: null as HubReviewPublic | null,
  };
  for (const row of rows) {
    const section = row.section as HubReviewSection;
    if (latest[section]) continue;
    latest[section] = serializeHubReview(row);
  }
  return latest;
}

export function serializeHubReview(row: {
  id: string;
  section: PreviewContentSection;
  state: PreviewContentReviewState;
  proposal: Prisma.JsonValue | null;
  opsNote: string | null;
  createdAt: Date;
  appliedAt: Date | null;
}): HubReviewPublic {
  return {
    id: row.id,
    section: row.section,
    state: row.state,
    cardState: cardStateFromReview(row.state),
    proposal: row.proposal,
    opsNote: row.opsNote,
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
  };
}

export function reviewNowNeed(states: Record<HubReviewSection, HubReviewCardState>): string {
  const hours = states.HOURS;
  if (hours === 'not_checked' || hours === 'dismissed') return HUB_NOW_REVIEW_NEED_ALL;
  return HUB_NOW_REVIEW_NEED_DONE;
}

export async function assertTeamPhotoAsset(input: {
  previewRequestId: string;
  assetId: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.assetId) return { ok: true };
  const asset = await prisma.previewHubAsset.findFirst({
    where: {
      id: input.assetId,
      previewRequestId: input.previewRequestId,
      kind: 'TEAM_PHOTO',
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!asset) return { ok: false, error: HUB_REVIEW_INVALID_PHOTO };
  return { ok: true };
}

export async function createHubContentReview(input: {
  previewRequestId: string;
  body: HubReviewPost;
}): Promise<HubReviewPublic> {
  const proposal =
    input.body.action === 'corrections' ? (input.body.proposal as Prisma.InputJsonValue) : Prisma.JsonNull;
  const row = await prisma.previewContentReview.create({
    data: {
      previewRequestId: input.previewRequestId,
      section: input.body.section,
      state: input.body.action === 'confirmed' ? 'CONFIRMED' : 'CORRECTIONS_SENT',
      proposal,
    },
  });
  return serializeHubReview(row);
}

function proposalBaseline(proposal: unknown): string | null {
  if (!proposal || typeof proposal !== 'object' || !('baseline' in proposal)) return null;
  return typeof proposal.baseline === 'string' ? proposal.baseline : null;
}

export async function applyHubContentReview(input: {
  previewRequestId: string;
  reviewId: string;
  shopId: string;
  actorEmail: string;
  now?: Date;
}): Promise<{ ok: true; review: HubReviewPublic } | { ok: false; code: 'NOT_FOUND' | 'INCOMPATIBLE' | 'NO_PROPOSAL' | 'ALREADY_APPLIED' }> {
  const now = input.now ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const review = await tx.previewContentReview.findFirst({
        where: { id: input.reviewId, previewRequestId: input.previewRequestId },
      });
      if (!review) return { ok: false as const, code: 'NOT_FOUND' as const };
      if (review.state === 'APPLIED') return { ok: true as const, review: serializeHubReview(review) };
      if (review.state !== 'CORRECTIONS_SENT') return { ok: false as const, code: 'NO_PROPOSAL' as const };
      if (!review.proposal || typeof review.proposal !== 'object') return { ok: false as const, code: 'NO_PROPOSAL' as const };

      const shop = await loadHubReviewShopData(input.shopId, input.previewRequestId, tx);
      const baseline = proposalBaseline(review.proposal);
      if (!baseline) return { ok: false as const, code: 'NO_PROPOSAL' as const };

      if (review.section === 'SERVICES') {
        const parsed = hubServicesProposalSchema.safeParse(review.proposal);
        if (!parsed.success) return { ok: false as const, code: 'NO_PROPOSAL' as const };
        if (baseline !== servicesFingerprint(shop.services)) return { ok: false as const, code: 'INCOMPATIBLE' as const };
        await applyServicesProposal(tx, input.shopId, parsed.data);
      } else if (review.section === 'TEAM') {
        const parsed = hubTeamProposalSchema.safeParse(review.proposal);
        if (!parsed.success) return { ok: false as const, code: 'NO_PROPOSAL' as const };
        if (baseline !== teamFingerprint(shop.barbers)) return { ok: false as const, code: 'INCOMPATIBLE' as const };
        await applyTeamProposal(tx, input.shopId, input.previewRequestId, parsed.data);
      } else {
        const parsed = hubHoursProposalSchema.safeParse(review.proposal);
        if (!parsed.success) return { ok: false as const, code: 'NO_PROPOSAL' as const };
        if (baseline !== hoursFingerprint(shop.hours)) return { ok: false as const, code: 'INCOMPATIBLE' as const };
        await applyHoursProposal(tx, input.shopId, parsed.data);
      }

      if (hubApplyTestHooks.throwAfterSectionWrite) {
        throw new Error(hubApplyTestHooks.throwAfterSectionWrite);
      }

      const updated = await tx.previewContentReview.update({
        where: { id: review.id },
        data: { state: 'APPLIED', appliedAt: now, appliedBy: input.actorEmail },
      });
      await tx.previewRequestEvent.create({
        data: {
          previewRequestId: input.previewRequestId,
          action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_REVIEW_APPLIED,
          actorEmail: input.actorEmail,
          meta: { reviewId: updated.id, section: updated.section },
        },
      });
      return { ok: true as const, review: serializeHubReview(updated) };
    });
  } catch (error) {
    if (error instanceof HubApplyIncompatibleError) return { ok: false, code: 'INCOMPATIBLE' };
    throw error;
  }
}

/** Test-only hook so a mid-apply throw can prove the transaction rolls back. */
export const hubApplyTestHooks = {
  throwAfterSectionWrite: '' as string,
};

export async function dismissHubContentReview(input: {
  previewRequestId: string;
  reviewId: string;
  opsNote: string;
}): Promise<{ ok: true; review: HubReviewPublic } | { ok: false; code: 'NOT_FOUND' | 'NO_PROPOSAL' }> {
  const review = await prisma.previewContentReview.findFirst({
    where: { id: input.reviewId, previewRequestId: input.previewRequestId },
  });
  if (!review) return { ok: false, code: 'NOT_FOUND' };
  if (review.state === 'DISMISSED') return { ok: true, review: serializeHubReview(review) };
  if (review.state !== 'CORRECTIONS_SENT') return { ok: false, code: 'NO_PROPOSAL' };
  const updated = await prisma.previewContentReview.update({
    where: { id: review.id },
    data: { state: 'DISMISSED', opsNote: input.opsNote.trim() },
  });
  return { ok: true, review: serializeHubReview(updated) };
}

async function applyServicesProposal(tx: Prisma.TransactionClient, shopId: string, proposal: HubServicesProposal) {
    const existing = await tx.service.findMany({
      where: { shopId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    for (const row of proposal.services) {
      if (row.id && !existingIds.has(row.id)) {
        throw new HubApplyIncompatibleError();
      }
    }
    let order = 0;
    for (const row of proposal.services) {
      if (row.id) {
        await tx.service.update({
          where: { id: row.id },
          data: {
            name: row.name,
            durationMinutes: row.durationMinutes,
            pricePence: row.pricePence,
            isActive: !row.removed,
            displayOrder: order,
          },
        });
      } else if (!row.removed) {
        await tx.service.create({
          data: {
            shopId,
            name: row.name,
            durationMinutes: row.durationMinutes,
            pricePence: row.pricePence,
            isActive: true,
            displayOrder: order,
          },
        });
      }
      if (!row.removed) order += 1;
    }
    await linkServicesInTx(tx, shopId);
}

async function applyTeamProposal(
  tx: Prisma.TransactionClient,
  shopId: string,
  previewRequestId: string,
  proposal: HubTeamProposal,
) {
    const existing = await tx.barber.findMany({
      where: { shopId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    for (const row of proposal.barbers) {
      if (row.id && !existingIds.has(row.id)) {
        throw new HubApplyIncompatibleError();
      }
    }
    let order = 0;
    for (const row of proposal.barbers) {
      if (row.id) {
        await tx.barber.update({
          where: { id: row.id },
          data: {
            name: row.name,
            active: !row.removed,
            sortOrder: order,
          },
        });
        if (row.photoAssetId) {
          await tx.previewHubAsset.updateMany({
            where: { id: row.photoAssetId, previewRequestId, kind: 'TEAM_PHOTO', deletedAt: null },
            data: { barberId: row.id },
          });
        }
      } else if (!row.removed) {
        const created = await tx.barber.create({
          data: {
            shopId,
            name: row.name,
            active: true,
            sortOrder: order,
          },
        });
        if (row.photoAssetId) {
          await tx.previewHubAsset.updateMany({
            where: { id: row.photoAssetId, previewRequestId, kind: 'TEAM_PHOTO', deletedAt: null },
            data: { barberId: created.id },
          });
        }
      }
      if (!row.removed) order += 1;
    }
    await linkServicesInTx(tx, shopId);
}

async function applyHoursProposal(
  tx: Prisma.TransactionClient,
  shopId: string,
  proposal: HubHoursProposal,
) {
  const { replaceShopOpeningHours } = await import('@/lib/admin/shopOpeningHours');
  await replaceShopOpeningHours(shopId, hoursToWeeklyRules(proposal.days), tx);
}

async function linkServicesInTx(
  tx: Prisma.TransactionClient,
  shopId: string,
) {
  const [barbers, services] = await Promise.all([
    tx.barber.findMany({ where: { shopId, active: true }, select: { id: true } }),
    tx.service.findMany({ where: { shopId, isActive: true }, select: { id: true } }),
  ]);
  if (barbers.length === 0 || services.length === 0) return;
  await tx.barberService.createMany({
    data: barbers.flatMap((barber) =>
      services.map((service) => ({
        barberId: barber.id,
        serviceId: service.id,
      })),
    ),
    skipDuplicates: true,
  });
}

export class HubApplyIncompatibleError extends Error {
  constructor() {
    super('INCOMPATIBLE');
    this.name = 'HubApplyIncompatibleError';
  }
}

export async function clearHubReviewProposals(
  db: { previewContentReview: { updateMany: typeof prisma.previewContentReview.updateMany } },
  previewRequestId: string,
): Promise<number> {
  const result = await db.previewContentReview.updateMany({
    where: { previewRequestId },
    data: { proposal: Prisma.JsonNull, opsNote: null, appliedBy: null },
  });
  return result.count;
}

export async function deleteHubReviewRows(
  db: { previewContentReview: { deleteMany: typeof prisma.previewContentReview.deleteMany } },
  previewRequestId: string,
): Promise<number> {
  const result = await db.previewContentReview.deleteMany({ where: { previewRequestId } });
  return result.count;
}

export function reviewDiff(input: {
  section: HubReviewSection;
  current: HubReviewShopData;
  proposal: unknown;
}): Array<{ label: string; from: string; to: string }> {
  if (input.section === 'SERVICES') {
    const parsed = hubServicesProposalSchema.safeParse(input.proposal);
    if (!parsed.success) return [];
    const currentById = new Map(input.current.services.map((row) => [row.id, row]));
    const rows: Array<{ label: string; from: string; to: string }> = [];
    for (const row of parsed.data.services) {
      const current = row.id ? currentById.get(row.id) : undefined;
      const to = row.removed
        ? 'Removed'
        : `${row.name} · ${row.durationMinutes} min · ${formatGbpPence(row.pricePence)}`;
      const from = current
        ? `${current.name} · ${current.durationMinutes} min · ${formatGbpPence(current.pricePence)}`
        : 'New';
      if (from !== to) rows.push({ label: row.name, from, to });
    }
    return rows;
  }
  if (input.section === 'TEAM') {
    const parsed = hubTeamProposalSchema.safeParse(input.proposal);
    if (!parsed.success) return [];
    const currentById = new Map(input.current.barbers.map((row) => [row.id, row]));
    const rows: Array<{ label: string; from: string; to: string }> = [];
    for (const row of parsed.data.barbers) {
      const current = row.id ? currentById.get(row.id) : undefined;
      const to = row.removed ? 'Removed' : `${row.name}${row.showOnWebsite ? '' : ' (hidden on website)'}`;
      const from = current ? current.name : 'New';
      if (from !== to || row.bio || row.photoAssetId) {
        rows.push({
          label: row.name,
          from,
          to: row.removed ? 'Removed' : `${row.name}${row.bio ? ` — ${row.bio}` : ''}${row.showOnWebsite ? '' : ' (hidden on website)'}`,
        });
      }
    }
    return rows;
  }
  const parsed = hubHoursProposalSchema.safeParse(input.proposal);
  if (!parsed.success) return [];
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const currentByDay = new Map(input.current.hours.map((row) => [row.dayOfWeek, row]));
  return parsed.data.days.flatMap((day) => {
    const current = currentByDay.get(day.dayOfWeek);
    const from = current ? (current.open ? `${current.start}–${current.end}` : 'Closed') : '—';
    const to = day.open ? `${day.start}–${day.end}` : 'Closed';
    return from === to ? [] : [{ label: labels[day.dayOfWeek - 1] ?? `Day ${day.dayOfWeek}`, from, to }];
  });
}
