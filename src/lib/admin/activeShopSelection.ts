/**
 * `ks_active_shop`: which shop a signed-in user who belongs to more than one shop is working in.
 *
 * It holds only a shop id and is never trusted on its own: `resolveActiveMembershipForUser` honours it only
 * when the signed-in user is a member of that shop, so a forged value can at most pick one of the user's own
 * shops. Set when an invite is accepted; cleared on admin logout.
 */
export const ACTIVE_SHOP_COOKIE_NAME = 'ks_active_shop';
export const ACTIVE_SHOP_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
const SHOP_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';

export function readActiveShopSelection(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== ACTIVE_SHOP_COOKIE_NAME) continue;
    const value = part.slice(index + 1).trim();
    return SHOP_ID_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function serializeActiveShopSelection(shopId: string): string | null {
  if (!SHOP_ID_PATTERN.test(shopId)) return null;
  return `${ACTIVE_SHOP_COOKIE_NAME}=${shopId}; Max-Age=${ACTIVE_SHOP_COOKIE_MAX_AGE_SECONDS}; ${COOKIE_ATTRIBUTES}`;
}

export function clearActiveShopSelection(): string {
  return `${ACTIVE_SHOP_COOKIE_NAME}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;
}
