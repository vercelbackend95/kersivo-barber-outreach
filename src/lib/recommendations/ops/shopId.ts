import { DETAIL_MAX_SHOP_ID_LENGTH } from './types';

export type ParseOpsShopIdResult =
  | { ok: true; shopId: string }
  | { ok: false; code: 'INVALID_QUERY' };

/** Shared Ops shopId format check (API + SSR pages). */
export function parseOpsShopId(raw: string | undefined | null): ParseOpsShopIdResult {
  if (raw == null) return { ok: false, code: 'INVALID_QUERY' };
  const shopId = raw.trim();
  if (!shopId || shopId.length > DETAIL_MAX_SHOP_ID_LENGTH) {
    return { ok: false, code: 'INVALID_QUERY' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(shopId)) {
    return { ok: false, code: 'INVALID_QUERY' };
  }
  return { ok: true, shopId };
}
