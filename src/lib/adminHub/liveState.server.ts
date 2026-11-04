import type { HubShopDetails } from '@/components/previewHub/HubYourShop';
import type { HubUploadedAsset } from '@/components/previewHub/HubUploader';
import { loadActiveHubAssets, serializeHubAsset } from '@/lib/freePreview/hubAssets';
import type { HubPageContext } from '@/lib/freePreview/hubPage';
import { parseBrandPalette } from './brandColours';
import { brandLockState } from './brandLock';
import { currentHubLogo, currentHubLogoOptionsFromDetails, parseBrandSnapshotLogoAssetId } from './currentLogo';
import { loadAdminHubSetupCard } from './hubView';
import { hubLogoSrc, type AdminHubLiveState } from './liveState';
import type { SetupCardModel } from './setupCard';

export type HubLiveRequestFields = {
  id: string;
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  styleNotes: string | null;
  aboutText: string | null;
  instagramUrl: string | null;
  websiteExtraText: string | null;
  brandBackgroundTone?: string | null;
  brandColoursSource?: string | null;
  brandPaletteExtracted?: unknown;
  brandPaletteLogoAssetId?: string | null;
  brandColoursSentAt?: Date | string | null;
  brandSubmittedSnapshot?: unknown;
};

/** The details every hub app and Overview tile reads. One builder for the page ctx and GET /state. */
export function hubAppDetails(request: HubLiveRequestFields): HubShopDetails {
  const rawTone = request.brandBackgroundTone;
  const rawSource = request.brandColoursSource;
  const brandLock = brandLockState(request.brandColoursSentAt ?? null);
  return {
    brandPrimaryColour: request.brandPrimaryColour,
    brandSecondaryColour: request.brandSecondaryColour,
    styleNotes: request.styleNotes,
    aboutText: request.aboutText,
    instagramUrl: request.instagramUrl,
    websiteExtraText: request.websiteExtraText,
    brandBackgroundTone: rawTone === 'DARK' || rawTone === 'LIGHT' ? rawTone : null,
    brandColoursSource:
      rawSource === 'LOGO' || rawSource === 'MANUAL' || rawSource === 'KERSIVO_CHOOSES' ? rawSource : null,
    brandPaletteExtracted: parseBrandPalette(request.brandPaletteExtracted),
    brandPaletteLogoAssetId: request.brandPaletteLogoAssetId ?? null,
    brandColoursSentAt: brandLock.submittedAt,
    brandLocked: brandLock.locked,
    snapshotLogoAssetId: parseBrandSnapshotLogoAssetId(request.brandSubmittedSnapshot),
  };
}

export function buildAdminHubLiveState(input: {
  request: HubLiveRequestFields;
  assets: HubUploadedAsset[];
  setup: SetupCardModel | null;
}): AdminHubLiveState {
  const details = hubAppDetails(input.request);
  const logo = currentHubLogo(input.assets, currentHubLogoOptionsFromDetails(details));
  return {
    assets: input.assets,
    details,
    currentLogo: logo ? { id: logo.id, src: hubLogoSrc(logo) } : null,
    setup: input.setup,
  };
}

export async function loadAdminHubLiveState(ctx: HubPageContext): Promise<AdminHubLiveState> {
  const rows = await loadActiveHubAssets(ctx.request.id);
  const setup = await loadAdminHubSetupCard(
    ctx,
    rows.map((row) => row.kind),
  );
  return buildAdminHubLiveState({ request: ctx.request, assets: rows.map(serializeHubAsset), setup });
}
