import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  currentHubLogo,
  currentHubLogoOptionsFromDetails,
  parseBrandSnapshotLogoAssetId,
} from './currentLogo';

function logo(
  id: string,
  createdAt: string,
  extra: { kind?: string; deletedAt?: string | null; sortOrder?: number } = {},
) {
  return {
    id,
    kind: extra.kind ?? 'LOGO',
    createdAt,
    deletedAt: extra.deletedAt ?? null,
    sortOrder: extra.sortOrder ?? 0,
  };
}

describe('currentHubLogo', () => {
  it('returns the newest non-deleted LOGO by createdAt', () => {
    const assets = [
      logo('logo_a', '2026-11-01T10:00:00.000Z', { sortOrder: 0 }),
      logo('photo_1', '2026-11-02T12:00:00.000Z', { kind: 'SHOP_PHOTO' }),
      logo('logo_b', '2026-11-01T12:00:00.000Z', { sortOrder: 1 }),
    ];
    expect(currentHubLogo(assets)?.id).toBe('logo_b');
  });

  it('ignores deleted logos even when they are newest or last by sortOrder', () => {
    const assets = [
      logo('logo_a', '2026-11-01T10:00:00.000Z', { sortOrder: 0 }),
      logo('logo_b', '2026-11-01T12:00:00.000Z', { sortOrder: 1, deletedAt: '2026-11-01T13:00:00.000Z' }),
    ];
    expect(currentHubLogo(assets)?.id).toBe('logo_a');
  });

  it('does not use sortOrder when it collides after a deletion', () => {
    const assets = [
      logo('logo_a', '2026-11-01T10:00:00.000Z', { sortOrder: 0 }),
      logo('logo_c', '2026-11-01T11:00:00.000Z', { sortOrder: 2 }),
      logo('logo_b', '2026-11-01T12:00:00.000Z', { sortOrder: 2 }),
    ];
    expect(currentHubLogo(assets)?.id).toBe('logo_b');
  });

  it('picks last-in-list when sortOrder says otherwise (legacy last-by-order bug)', () => {
    const assets = [
      logo('logo_new', '2026-11-01T18:00:00.000Z', { sortOrder: 0 }),
      logo('logo_old', '2026-11-01T10:00:00.000Z', { sortOrder: 1 }),
    ];
    expect(currentHubLogo(assets)?.id).toBe('logo_new');
  });

  it('tie-breaks equal createdAt by id', () => {
    const stamp = '2026-11-01T12:00:00.000Z';
    expect(currentHubLogo([logo('logo_a', stamp), logo('logo_b', stamp)])?.id).toBe('logo_b');
    expect(currentHubLogo([logo('logo_b', stamp), logo('logo_a', stamp)])?.id).toBe('logo_b');
  });

  it('accepts Date createdAt from Prisma rows', () => {
    const assets = [
      { id: 'logo_a', kind: 'LOGO', createdAt: new Date('2026-11-01T10:00:00.000Z'), deletedAt: null },
      { id: 'logo_b', kind: 'LOGO', createdAt: new Date('2026-11-01T12:00:00.000Z'), deletedAt: null },
    ];
    expect(currentHubLogo(assets)?.id).toBe('logo_b');
  });

  it('returns null when there is no live logo', () => {
    expect(currentHubLogo([])).toBeNull();
    expect(currentHubLogo([logo('logo_a', '2026-11-01T10:00:00.000Z', { deletedAt: '2026-11-01T11:00:00.000Z' })])).toBeNull();
    expect(currentHubLogo([logo('photo', '2026-11-01T10:00:00.000Z', { kind: 'SHOP_PHOTO' })])).toBeNull();
  });

  it('uses the brand-lock snapshot logo when locked, even if a newer file exists', () => {
    const assets = [
      logo('logo_a', '2026-11-01T10:00:00.000Z'),
      logo('logo_b', '2026-11-01T12:00:00.000Z'),
    ];
    expect(
      currentHubLogo(assets, { brandLocked: true, snapshotLogoAssetId: 'logo_a' })?.id,
    ).toBe('logo_a');
  });

  it('falls back to newest when locked but the snapshot asset is gone', () => {
    const assets = [logo('logo_b', '2026-11-01T12:00:00.000Z')];
    expect(
      currentHubLogo(assets, { brandLocked: true, snapshotLogoAssetId: 'logo_a' })?.id,
    ).toBe('logo_b');
  });

  it('ignores the snapshot while the brand is unlocked', () => {
    const assets = [
      logo('logo_a', '2026-11-01T10:00:00.000Z'),
      logo('logo_b', '2026-11-01T12:00:00.000Z'),
    ];
    expect(
      currentHubLogo(assets, { brandLocked: false, snapshotLogoAssetId: 'logo_a' })?.id,
    ).toBe('logo_b');
  });
});

describe('parseBrandSnapshotLogoAssetId', () => {
  it('reads logoAssetId from a snapshot object', () => {
    expect(parseBrandSnapshotLogoAssetId({ logoAssetId: 'logo_1' })).toBe('logo_1');
    expect(parseBrandSnapshotLogoAssetId({ logoAssetId: '  ' })).toBeNull();
    expect(parseBrandSnapshotLogoAssetId(null)).toBeNull();
    expect(parseBrandSnapshotLogoAssetId(['logo_1'])).toBeNull();
  });
});

describe('currentHubLogoOptionsFromDetails', () => {
  it('treats a sent-at stamp as locked', () => {
    expect(
      currentHubLogoOptionsFromDetails({
        brandLocked: false,
        brandColoursSentAt: '2026-11-02T12:00:00.000Z',
        snapshotLogoAssetId: 'logo_1',
      }),
    ).toEqual({ brandLocked: true, snapshotLogoAssetId: 'logo_1' });
  });
});

describe('call sites share currentHubLogo', () => {
  it('is used by the hub view, Colours app, Logo app, brand lock and legacy overview', () => {
    const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
    expect(read('src/lib/adminHub/hubView.ts')).toContain('currentHubLogo(serialized');
    expect(read('src/components/adminHub/apps/ColoursApp.tsx')).toContain(
      'currentHubLogo(ctx.assets, currentHubLogoOptionsFromDetails(ctx.details))',
    );
    expect(read('src/components/previewHub/HubYourShop.tsx')).toContain(
      'currentHubLogo(assets, currentHubLogoOptionsFromDetails(details))',
    );
    expect(read('src/lib/adminHub/brandLock.ts')).toContain('currentHubLogo(logos)');
    expect(read('src/pages/preview/[token]/overview.astro')).toContain('currentHubLogo(assets');
    expect(read('src/lib/freePreview/hubAssets.ts')).toContain('_max: { sortOrder: true }');
    expect(read('src/lib/freePreview/hubAssets.ts')).not.toMatch(
      /previewHubAsset\.count\(\{\s*where: \{ previewRequestId: input\.requestId, kind: input\.file\.kind/,
    );
  });
});

describe('logo display CSS', () => {
  const booking = readFileSync(resolve(process.cwd(), 'src/styles/components/booking.css'), 'utf8');
  const hub = readFileSync(resolve(process.cwd(), 'src/styles/components/admin-hub.css'), 'utf8');

  it('scales custom sidebar logos with contain, including mobile header and drawer', () => {
    expect(booking).toMatch(/\.admin-sidebar-logo-img \{[^}]*object-fit: contain;/);
    expect(booking).not.toMatch(
      /\.admin-sidebar-monogram--custom \.admin-sidebar-logo-img \{[^}]*object-fit: cover/,
    );
    expect(booking).toContain('.admin-mobile-header .admin-sidebar-monogram');
    expect(booking).toContain('.admin-mobile-drawer-head .admin-sidebar-monogram');
  });

  it('shows the hub logo as itself: contained, no box, plate only as the transparent-logo exception (O7)', () => {
    expect(hub).toMatch(/\.hub-logo-mark \{[^}]*max-width: 100%;[^}]*max-height: var\(--hub-logo-max-h, 64px\);[^}]*object-fit: contain;/);
    expect(hub).toMatch(/\.hub-logo-mark--opaque \{\s*border-radius: 8px;\s*\}/);
    expect(hub).toMatch(/\.hub-logo-mark--plate \{\s*padding: 8px;\s*border-radius: 10px;\s*background: #f4f4f2;\s*\}/);
    expect(hub).not.toContain('.admin-hub-colours-plate');
    expect(hub).not.toContain('.admin-hub-logo-pair');
    expect(hub).not.toContain('.admin-hub-content-logo__box');
  });
});
