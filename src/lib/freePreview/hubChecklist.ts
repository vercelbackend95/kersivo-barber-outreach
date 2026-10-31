import type { PreviewHubAssetKind } from '@prisma/client';
import {
  HUB_CHECKLIST_ABOUT,
  HUB_CHECKLIST_HOURS,
  HUB_CHECKLIST_LOGO,
  HUB_CHECKLIST_ON_PREVIEW,
  HUB_CHECKLIST_OPTIONAL,
  HUB_CHECKLIST_PHOTOS,
  HUB_CHECKLIST_PRICE,
  HUB_CHECKLIST_SERVICES,
  HUB_CHECKLIST_TEAM,
} from './hubCopy';
import type { HubStage } from './hubStage';

export type HubChecklistStatus = 'done' | 'todo' | 'optional' | 'on_preview';

export type HubChecklistItem = {
  id: 'logo' | 'photos' | 'services' | 'team' | 'hours' | 'about' | 'price';
  label: string;
  status: HubChecklistStatus;
  hint?: string;
};

export function buildHubChecklist(input: {
  stage: HubStage;
  hasLogo: boolean;
  hasPhotos: boolean;
  hasPriceList: boolean;
  hasAbout: boolean;
}): { items: HubChecklistItem[]; done: number; total: number } {
  const items: HubChecklistItem[] = [
    { id: 'logo', label: HUB_CHECKLIST_LOGO, status: input.hasLogo ? 'done' : 'todo' },
    { id: 'photos', label: HUB_CHECKLIST_PHOTOS, status: input.hasPhotos ? 'done' : 'todo' },
    { id: 'services', label: HUB_CHECKLIST_SERVICES, status: 'on_preview', hint: HUB_CHECKLIST_ON_PREVIEW },
    { id: 'team', label: HUB_CHECKLIST_TEAM, status: 'on_preview', hint: HUB_CHECKLIST_ON_PREVIEW },
    { id: 'hours', label: HUB_CHECKLIST_HOURS, status: 'on_preview', hint: HUB_CHECKLIST_ON_PREVIEW },
    {
      id: 'about',
      label: HUB_CHECKLIST_ABOUT,
      status: input.hasAbout ? 'done' : 'optional',
      hint: input.hasAbout ? undefined : HUB_CHECKLIST_OPTIONAL,
    },
    {
      id: 'price',
      label: HUB_CHECKLIST_PRICE,
      status: input.hasPriceList ? 'done' : 'optional',
      hint: input.hasPriceList ? undefined : HUB_CHECKLIST_OPTIONAL,
    },
  ];
  const done = items.filter((item) => item.status === 'done').length;
  return { items, done, total: items.length };
}

export function checklistFlagsFromAssets(
  assets: Array<{ kind: PreviewHubAssetKind }>,
  aboutText: string | null | undefined,
) {
  return {
    hasLogo: assets.some((asset) => asset.kind === 'LOGO'),
    hasPhotos: assets.some((asset) => asset.kind === 'SHOP_PHOTO'),
    hasPriceList: assets.some((asset) => asset.kind === 'PRICE_LIST'),
    hasAbout: Boolean(aboutText?.trim()),
  };
}
