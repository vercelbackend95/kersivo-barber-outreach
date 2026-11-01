import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_HUB_ADD_LOGO_HINT,
  ADMIN_HUB_ADD_PHOTOS,
  ADMIN_HUB_ADD_PRODUCT,
  ADMIN_HUB_ADD_SERVICE,
  ADMIN_HUB_ADD_TEAM,
  ADMIN_HUB_ADD_TEAM_PHOTOS_HINT,
  ADMIN_HUB_ADD_TEXT,
} from './copy';
import {
  adminHubAddShopHref,
  adminHubMaterialsHref,
  hubCanAddShopItems,
  overviewAddMenu,
  overviewAddMenuFromHub,
  overviewAddMenuTone,
  parseAdminHubAddItem,
  parseAdminHubAddWebsiteItem,
} from './addMenu';
import type { HubCapabilities, HubStage } from '@/lib/freePreview/hubStage';

function caps(overrides: Partial<HubCapabilities> = {}): HubCapabilities {
  return {
    canUpload: true,
    canEditDetails: true,
    canReview: false,
    canDraftChanges: false,
    canSendChanges: false,
    canMessage: true,
    canCheckout: false,
    showPreview: false,
    ...overrides,
  };
}

describe('add menu view-model', () => {
  it('does not import Prisma or the database client', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/adminHub/addMenu.ts'), 'utf8');
    const island = readFileSync(
      resolve(process.cwd(), 'src/components/adminHub/AdminHubAddMenu.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/prisma|@\/lib\/db/);
    expect(island).not.toMatch(/prisma|@\/lib\/db/);
  });

  it('parses allowlisted item ids only', () => {
    expect(parseAdminHubAddItem('photos')).toBe('photos');
    expect(parseAdminHubAddItem('team-photos')).toBe('team-photos');
    expect(parseAdminHubAddItem('service')).toBe('service');
    expect(parseAdminHubAddWebsiteItem('service')).toBeNull();
    expect(parseAdminHubAddItem('email')).toBeNull();
    expect(parseAdminHubAddItem('<script>')).toBeNull();
  });

  it('uses in-place materials hrefs and shop ?add=1 links', () => {
    expect(adminHubMaterialsHref('photos')).toBe('/admin?app=materials&item=photos');
    expect(adminHubMaterialsHref('logo')).toBe('/admin?app=materials&item=logo');
    expect(adminHubMaterialsHref('text')).toBe('/admin?app=materials&item=text');
    expect(adminHubAddShopHref('team')).toBe('/admin/team?add=1');
    expect(adminHubAddShopHref('service')).toBe('/admin/services?add=1');
    expect(adminHubAddShopHref('product')).toBe('/admin/products?add=1');
  });

  it('uses the real logo types and team-photo website hint', () => {
    const { groups } = overviewAddMenu({ canUpload: true, canEditDetails: true, canAddShop: true });
    const website = groups.find((group) => group.id === 'website')!.items;
    expect(website.map((item) => item.id)).toEqual([
      'photos',
      'logo',
      'text',
      'team-photos',
      'price-list',
      'other',
    ]);
    expect(website.find((item) => item.id === 'logo')?.hint).toBe(ADMIN_HUB_ADD_LOGO_HINT);
    expect(ADMIN_HUB_ADD_LOGO_HINT).toBe('JPG, PNG, WEBP, SVG or PDF');
    expect(website.find((item) => item.id === 'team-photos')?.hint).toBe(ADMIN_HUB_ADD_TEAM_PHOTOS_HINT);
    expect(ADMIN_HUB_ADD_TEAM_PHOTOS_HINT).toBe('Shown with each barber');
    expect(website.find((item) => item.id === 'photos')?.title).toBe(ADMIN_HUB_ADD_PHOTOS);
    expect(website.find((item) => item.id === 'text')?.title).toBe(ADMIN_HUB_ADD_TEXT);
  });

  it('hides website items by capability and shop items without draft-shop admin', () => {
    const uploadOnly = overviewAddMenu({ canUpload: true, canEditDetails: false, canAddShop: false });
    expect(uploadOnly.groups).toHaveLength(1);
    expect(uploadOnly.groups[0]!.items.map((item) => item.id)).toEqual([
      'photos',
      'logo',
      'team-photos',
      'price-list',
      'other',
    ]);

    const detailsOnly = overviewAddMenu({ canUpload: false, canEditDetails: true, canAddShop: false });
    expect(detailsOnly.groups[0]!.items.map((item) => item.id)).toEqual(['text']);

    const shopOnly = overviewAddMenu({ canUpload: false, canEditDetails: false, canAddShop: true });
    expect(shopOnly.groups).toHaveLength(1);
    expect(shopOnly.groups[0]!.heading).toBe('Your shop');
    expect(shopOnly.groups[0]!.items.map((item) => item.id)).toEqual(['team', 'service', 'product']);
    expect(shopOnly.groups[0]!.items.map((item) => item.title)).toEqual([
      ADMIN_HUB_ADD_TEAM,
      ADMIN_HUB_ADD_SERVICE,
      ADMIN_HUB_ADD_PRODUCT,
    ]);

    expect(overviewAddMenu({ canUpload: false, canEditDetails: false, canAddShop: false }).empty).toBe(true);
  });

  it('follows H1 stages for shop items and requested/designing as the primary Add', () => {
    expect(hubCanAddShopItems('requested')).toBe(true);
    expect(hubCanAddShopItems('designing')).toBe(true);
    expect(hubCanAddShopItems('review')).toBe(true);
    expect(hubCanAddShopItems('launch')).toBe(false);
    expect(hubCanAddShopItems('live')).toBe(false);
    expect(hubCanAddShopItems('expired')).toBe(false);
    expect(overviewAddMenuTone('requested')).toBe('primary');
    expect(overviewAddMenuTone('designing')).toBe('primary');
    expect(overviewAddMenuTone('review')).toBe('outline');
    expect(overviewAddMenuTone('launch')).toBe('outline');

    const requested = overviewAddMenuFromHub({ stage: 'requested', capabilities: caps() });
    expect(requested.empty).toBe(false);
    expect(requested.tone).toBe('primary');
    expect(requested.groups.map((group) => group.id)).toEqual(['website', 'shop']);

    const launch = overviewAddMenuFromHub({
      stage: 'launch',
      capabilities: caps({ canUpload: true, canEditDetails: false }),
    });
    expect(launch.groups.map((group) => group.id)).toEqual(['website']);
    expect(launch.groups[0]!.items.some((item) => item.id === 'text')).toBe(false);

    const live = overviewAddMenuFromHub({
      stage: 'live' satisfies HubStage,
      capabilities: caps({ canUpload: false, canEditDetails: false }),
    });
    expect(live.empty).toBe(true);
  });
});
