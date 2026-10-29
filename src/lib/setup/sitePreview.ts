import { prisma } from '@/lib/db/client';
import { SITE_LAUNCH_ACTIONS, recordSiteLaunchEvent } from '@/lib/setup/siteLaunch';

/** Returns the canonical https URL, or null when the input is not a valid https:// URL. */
export function normalizeSitePreviewUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
    // Avoid forcing a trailing slash on bare origins (URL.toString does).
    return parsed.pathname === '/' && !parsed.search && !parsed.hash
      ? `https://${parsed.host}`
      : parsed.toString();
  } catch {
    return null;
  }
}

export const SITE_VERSION_MAX = 80;

/**
 * Points a shop at its externally built website preview. Any change clears a previous launch approval,
 * so the owner always approves the exact version that goes live. Shared by the machine endpoint
 * (/api/ops/site-preview) and the operator action on free preview requests.
 */
export async function applySitePreview(input: {
  shopId: string;
  previewUrl: string;
  siteVersion: string;
  request?: Request | null;
  email?: string | null;
}): Promise<{ ok: true; action: 'ready' | 'updated' } | { ok: false; error: 'SHOP_NOT_FOUND' }> {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: input.shopId },
    select: { sitePreviewUrl: true },
  });
  if (!shop) return { ok: false, error: 'SHOP_NOT_FOUND' };

  const isUpdate = !!shop.sitePreviewUrl;

  await prisma.shopSettings.update({
    where: { id: input.shopId },
    data: {
      sitePreviewUrl: input.previewUrl,
      sitePreviewVersion: input.siteVersion,
      sitePreviewReadyAt: isUpdate ? undefined : new Date(),
      // Clear approval on preview update so status resets to ready_for_review
      launchApprovedAt: null,
      launchApprovedByUserId: null,
      launchApprovedByEmail: null,
      launchApprovedVersion: null,
      goLiveAt: null,
    },
  });

  await recordSiteLaunchEvent({
    shopId: input.shopId,
    action: isUpdate ? SITE_LAUNCH_ACTIONS.PREVIEW_UPDATED : SITE_LAUNCH_ACTIONS.PREVIEW_READY,
    siteVersion: input.siteVersion,
    previewUrl: input.previewUrl,
    email: input.email ?? null,
    request: input.request ?? null,
  });

  return { ok: true, action: isUpdate ? 'updated' : 'ready' };
}
