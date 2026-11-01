/**
 * Overview header Add menu (website materials + shop catalogue).
 * Client-safe. Stage gates match hub capabilities and H1 draft-shop access.
 */
import {
  ADMIN_HUB_ADD_GROUP_SHOP,
  ADMIN_HUB_ADD_GROUP_WEBSITE,
  ADMIN_HUB_ADD_LOGO,
  ADMIN_HUB_ADD_LOGO_HINT,
  ADMIN_HUB_ADD_OTHER,
  ADMIN_HUB_ADD_OTHER_HINT,
  ADMIN_HUB_ADD_PHOTOS,
  ADMIN_HUB_ADD_PHOTOS_HINT,
  ADMIN_HUB_ADD_PRICE,
  ADMIN_HUB_ADD_PRICE_HINT,
  ADMIN_HUB_ADD_PRODUCT,
  ADMIN_HUB_ADD_PRODUCT_HINT,
  ADMIN_HUB_ADD_SERVICE,
  ADMIN_HUB_ADD_SERVICE_HINT,
  ADMIN_HUB_ADD_TEAM,
  ADMIN_HUB_ADD_TEAM_HINT,
  ADMIN_HUB_ADD_TEAM_PHOTOS,
  ADMIN_HUB_ADD_TEAM_PHOTOS_HINT,
  ADMIN_HUB_ADD_TEXT,
  ADMIN_HUB_ADD_TEXT_HINT,
} from './copy';
import { adminHubAppHref } from './apps';
import { PREVIEW_HUB_PATHS } from './previewHubPaths';
import type { HubCapabilities, HubStage } from '@/lib/freePreview/hubStage';

/** Same stages H1 uses for draft-shop admin (requested / designing / review). */
const HUB_ADD_SHOP_STAGES = new Set<HubStage>(['requested', 'designing', 'review']);

export const ADMIN_HUB_LOCATION_EVENT = 'admin-hub:location';

export const ADMIN_HUB_ADD_WEBSITE_ITEMS = [
  'photos',
  'logo',
  'text',
  'team-photos',
  'price-list',
  'other',
] as const;

export const ADMIN_HUB_ADD_SHOP_ITEMS = ['team', 'service', 'product'] as const;

export type AdminHubAddWebsiteItem = (typeof ADMIN_HUB_ADD_WEBSITE_ITEMS)[number];
export type AdminHubAddShopItem = (typeof ADMIN_HUB_ADD_SHOP_ITEMS)[number];
export type AdminHubAddItemId = AdminHubAddWebsiteItem | AdminHubAddShopItem;

const WEBSITE_ITEM_SET = new Set<string>(ADMIN_HUB_ADD_WEBSITE_ITEMS);
const SHOP_ITEM_SET = new Set<string>(ADMIN_HUB_ADD_SHOP_ITEMS);
const ITEM_SET = new Set<string>([...ADMIN_HUB_ADD_WEBSITE_ITEMS, ...ADMIN_HUB_ADD_SHOP_ITEMS]);

export function parseAdminHubAddItem(raw: string | null | undefined): AdminHubAddItemId | null {
  const id = (raw ?? '').trim();
  return ITEM_SET.has(id) ? (id as AdminHubAddItemId) : null;
}

export function parseAdminHubAddWebsiteItem(
  raw: string | null | undefined,
): AdminHubAddWebsiteItem | null {
  const id = (raw ?? '').trim();
  return WEBSITE_ITEM_SET.has(id) ? (id as AdminHubAddWebsiteItem) : null;
}

export function isAdminHubAddShopItem(id: AdminHubAddItemId): id is AdminHubAddShopItem {
  return SHOP_ITEM_SET.has(id);
}

export function adminHubMaterialsHref(item: AdminHubAddWebsiteItem): string {
  return `${adminHubAppHref('materials')}&item=${item}`;
}

export function adminHubAddShopHref(item: AdminHubAddShopItem): string {
  const path =
    item === 'team'
      ? PREVIEW_HUB_PATHS.team
      : item === 'service'
        ? PREVIEW_HUB_PATHS.services
        : PREVIEW_HUB_PATHS.products;
  return `${path}?add=1`;
}

export type HubAddMenuItem = {
  id: AdminHubAddItemId;
  title: string;
  hint: string;
  href: string;
  inPlace: boolean;
};

export type HubAddMenuGroup = {
  id: 'website' | 'shop';
  heading: string;
  items: HubAddMenuItem[];
};

const WEBSITE_ITEMS: Array<{
  id: AdminHubAddWebsiteItem;
  title: string;
  hint: string;
  needs: 'upload' | 'details';
}> = [
  { id: 'photos', title: ADMIN_HUB_ADD_PHOTOS, hint: ADMIN_HUB_ADD_PHOTOS_HINT, needs: 'upload' },
  { id: 'logo', title: ADMIN_HUB_ADD_LOGO, hint: ADMIN_HUB_ADD_LOGO_HINT, needs: 'upload' },
  { id: 'text', title: ADMIN_HUB_ADD_TEXT, hint: ADMIN_HUB_ADD_TEXT_HINT, needs: 'details' },
  {
    id: 'team-photos',
    title: ADMIN_HUB_ADD_TEAM_PHOTOS,
    hint: ADMIN_HUB_ADD_TEAM_PHOTOS_HINT,
    needs: 'upload',
  },
  { id: 'price-list', title: ADMIN_HUB_ADD_PRICE, hint: ADMIN_HUB_ADD_PRICE_HINT, needs: 'upload' },
  { id: 'other', title: ADMIN_HUB_ADD_OTHER, hint: ADMIN_HUB_ADD_OTHER_HINT, needs: 'upload' },
];

const SHOP_ITEMS: Array<{ id: AdminHubAddShopItem; title: string; hint: string }> = [
  { id: 'team', title: ADMIN_HUB_ADD_TEAM, hint: ADMIN_HUB_ADD_TEAM_HINT },
  { id: 'service', title: ADMIN_HUB_ADD_SERVICE, hint: ADMIN_HUB_ADD_SERVICE_HINT },
  { id: 'product', title: ADMIN_HUB_ADD_PRODUCT, hint: ADMIN_HUB_ADD_PRODUCT_HINT },
];

export function hubCanAddShopItems(stage: HubStage): boolean {
  return HUB_ADD_SHOP_STAGES.has(stage);
}

export function overviewAddMenuTone(stage: HubStage): 'primary' | 'outline' {
  return stage === 'requested' || stage === 'designing' ? 'primary' : 'outline';
}

export function overviewAddMenu(input: {
  canUpload: boolean;
  canEditDetails: boolean;
  canAddShop: boolean;
}): { groups: HubAddMenuGroup[]; empty: boolean } {
  const website: HubAddMenuItem[] = WEBSITE_ITEMS.filter((item) =>
    item.needs === 'upload' ? input.canUpload : input.canEditDetails,
  ).map((item) => ({
    id: item.id,
    title: item.title,
    hint: item.hint,
    href: adminHubMaterialsHref(item.id),
    inPlace: true,
  }));

  const shop: HubAddMenuItem[] = input.canAddShop
    ? SHOP_ITEMS.map((item) => ({
        id: item.id,
        title: item.title,
        hint: item.hint,
        href: adminHubAddShopHref(item.id),
        inPlace: false,
      }))
    : [];

  const groups: HubAddMenuGroup[] = [];
  if (website.length) {
    groups.push({ id: 'website', heading: ADMIN_HUB_ADD_GROUP_WEBSITE, items: website });
  }
  if (shop.length) {
    groups.push({ id: 'shop', heading: ADMIN_HUB_ADD_GROUP_SHOP, items: shop });
  }
  return { groups, empty: groups.length === 0 };
}

export function overviewAddMenuFromHub(input: {
  stage: HubStage;
  capabilities: HubCapabilities;
}): { groups: HubAddMenuGroup[]; empty: boolean; tone: 'primary' | 'outline' } {
  const menu = overviewAddMenu({
    canUpload: input.capabilities.canUpload,
    canEditDetails: input.capabilities.canEditDetails,
    canAddShop: hubCanAddShopItems(input.stage),
  });
  return { ...menu, tone: overviewAddMenuTone(input.stage) };
}
