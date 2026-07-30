import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SITE_LAUNCH_ACTIONS = {
  PREVIEW_READY: 'PREVIEW_READY',
  PREVIEW_UPDATED: 'PREVIEW_UPDATED',
  APPROVED: 'APPROVED',
} as const;

export type SiteLaunchAction = (typeof SITE_LAUNCH_ACTIONS)[keyof typeof SITE_LAUNCH_ACTIONS];

export type SiteLaunchStatus = 'not_ready' | 'ready_for_review' | 'approved';

// ---------------------------------------------------------------------------
// Status helper
// ---------------------------------------------------------------------------

export function getSiteLaunchStatus(shop: {
  sitePreviewUrl?: string | null;
  sitePreviewVersion?: string | null;
  launchApprovedAt?: Date | null;
  launchApprovedVersion?: string | null;
}): SiteLaunchStatus {
  if (!shop.sitePreviewUrl) return 'not_ready';
  if (
    shop.launchApprovedAt &&
    shop.launchApprovedVersion &&
    shop.launchApprovedVersion === shop.sitePreviewVersion
  ) {
    return 'approved';
  }
  return 'ready_for_review';
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 120);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp ? realIp.slice(0, 120) : null;
}

export async function recordSiteLaunchEvent(input: {
  shopId: string;
  action: SiteLaunchAction | string;
  siteVersion?: string | null;
  previewUrl?: string | null;
  userId?: string | null;
  email?: string | null;
  request?: Request | null;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.siteLaunchEvent.create({
      data: {
        shopId: input.shopId,
        action: input.action,
        siteVersion: input.siteVersion ?? null,
        previewUrl: input.previewUrl ?? null,
        userId: input.userId ?? null,
        email: input.email?.trim().toLowerCase() || null,
        ip: input.request ? clientIp(input.request) : null,
        userAgent: input.request
          ? (input.request.headers.get('user-agent') ?? '').trim().slice(0, 500) || null
          : null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (error) {
    console.error('[site-launch-event] failed to record', { action: input.action, error });
  }
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

export async function approveSiteLaunch(input: {
  shopId: string;
  userId: string;
  email: string;
  request: Request;
}): Promise<{ ok: true; alreadyApproved?: boolean } | { ok: false; error: string; status: number }> {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: input.shopId },
    select: {
      sitePreviewUrl: true,
      sitePreviewVersion: true,
      launchApprovedAt: true,
      launchApprovedVersion: true,
    },
  });

  if (!shop?.sitePreviewUrl || !shop.sitePreviewVersion) {
    return { ok: false, error: 'Preview is not ready yet.', status: 400 };
  }

  // Idempotent for same version
  if (shop.launchApprovedAt && shop.launchApprovedVersion === shop.sitePreviewVersion) {
    return { ok: true, alreadyApproved: true };
  }

  const now = new Date();

  await prisma.shopSettings.update({
    where: { id: input.shopId },
    data: {
      launchApprovedAt: now,
      launchApprovedByUserId: input.userId,
      launchApprovedByEmail: input.email.trim().toLowerCase(),
      launchApprovedVersion: shop.sitePreviewVersion,
      goLiveAt: now,
    },
  });

  await recordSiteLaunchEvent({
    shopId: input.shopId,
    action: SITE_LAUNCH_ACTIONS.APPROVED,
    siteVersion: shop.sitePreviewVersion,
    previewUrl: shop.sitePreviewUrl,
    userId: input.userId,
    email: input.email,
    request: input.request,
  });

  return { ok: true };
}
