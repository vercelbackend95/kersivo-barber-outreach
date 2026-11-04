/**
 * Live hub data shared by the Overview tiles and the app windows (client-safe: no Prisma).
 * Built on the server by `liveState.server.ts`, seeded into the page as JSON and kept fresh by `hubStore.ts`.
 */
import type { HubUploadedAsset } from '@/components/previewHub/HubUploader';
import type { HubShopDetails } from '@/components/previewHub/HubYourShop';
import type { AdminHubAppContext } from '@/components/adminHub/apps/types';
import type { SetupCardModel } from './setupCard';
import { ADMIN_HUB_API_BASE } from './links';

export type AdminHubLiveLogo = { id: string; src: string | null };

export type AdminHubLiveState = {
  assets: HubUploadedAsset[];
  details: HubShopDetails;
  currentLogo: AdminHubLiveLogo | null;
  /** Sidebar setup card. Undefined = not sent (the page's server-rendered card stays). */
  setup?: SetupCardModel | null;
};

export const ADMIN_HUB_STATE_SCRIPT_ID = 'admin-hub-state';
export const ADMIN_HUB_STATE_URL = `${ADMIN_HUB_API_BASE}/state`;
export const ADMIN_HUB_DATA_CHANGED_EVENT = 'admin-hub:data-changed';

export type AdminHubDataChangedReason =
  | 'asset-added'
  | 'asset-deleted'
  | 'asset-reordered'
  | 'asset-updated'
  | 'details-saved'
  | 'colours-saved'
  | 'colours-sent'
  | 'change-updated';

export function emitHubDataChanged(reason: AdminHubDataChangedReason): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_HUB_DATA_CHANGED_EVENT, { detail: { reason } }));
}

/** Sidebar, preview phone and colours tile all show this src (thumb only, like before). */
export function hubLogoSrc(logo: { id: string; hasThumb: boolean } | null | undefined): string | null {
  return logo?.hasThumb ? `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(logo.id)}?size=thumb` : null;
}

/** JSON for a `<script type="application/json">` block: `<` is escaped so text can never close the tag. */
export function liveStateScriptJson(state: AdminHubLiveState): string {
  return JSON.stringify(state).replace(/</g, '\\u003c');
}

export function mergeLiveStateIntoAppCtx(
  ctx: AdminHubAppContext,
  live: AdminHubLiveState | null | undefined,
): AdminHubAppContext {
  if (!live) return ctx;
  return { ...ctx, assets: live.assets, details: { ...ctx.details, ...live.details } };
}
