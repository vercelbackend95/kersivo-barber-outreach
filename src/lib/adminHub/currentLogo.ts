export type CurrentHubLogoAsset = {
  id: string;
  kind: string;
  createdAt: string | Date;
  deletedAt?: string | Date | null;
};

export type CurrentHubLogoOptions = {
  brandLocked?: boolean;
  snapshotLogoAssetId?: string | null;
};

export function parseBrandSnapshotLogoAssetId(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const id = (snapshot as { logoAssetId?: unknown }).logoAssetId;
  return typeof id === 'string' && id.trim() ? id : null;
}

export function currentHubLogoOptionsFromDetails(details: {
  brandLocked?: boolean | null;
  brandColoursSentAt?: string | Date | null;
  snapshotLogoAssetId?: string | null;
}): CurrentHubLogoOptions {
  return {
    brandLocked: Boolean(details.brandLocked || details.brandColoursSentAt),
    snapshotLogoAssetId: details.snapshotLogoAssetId ?? null,
  };
}

function createdAtMs(value: string | Date): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function currentHubLogo<T extends CurrentHubLogoAsset>(
  assets: readonly T[],
  options: CurrentHubLogoOptions = {},
): T | null {
  const logos = assets.filter((asset) => asset.kind === 'LOGO' && asset.deletedAt == null);
  if (!logos.length) return null;
  if (options.brandLocked && options.snapshotLogoAssetId) {
    const snap = logos.find((asset) => asset.id === options.snapshotLogoAssetId);
    if (snap) return snap;
  }
  return logos.reduce((best, asset) => {
    const delta = createdAtMs(asset.createdAt) - createdAtMs(best.createdAt);
    if (delta > 0) return asset;
    if (delta < 0) return best;
    return asset.id > best.id ? asset : best;
  });
}
