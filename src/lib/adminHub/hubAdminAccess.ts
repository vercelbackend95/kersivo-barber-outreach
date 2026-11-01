import type { APIContext } from 'astro';
import type { Permission } from '@/lib/admin/rbac/permissions';
import { prisma } from '@/lib/db/client';
import { isAdminHubRouteEnabled, resolveHubContext } from '@/lib/freePreview/hubPage';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { resolveOperatorAccess } from '@/lib/ops/operatorAuth';
import { readHubCookie, verifyHubSession } from './hubSession';

/** Hub visitors manage catalogue, team seats and products — never bookings, billing, invites, settings or AI. */
export const HUB_ADMIN_PERMISSIONS: readonly Permission[] = [
  'catalog.manage',
  'team.read',
  'retail.manage',
];

export const HUB_ADMIN_UNAVAILABLE_MESSAGE = 'Not available in your preview.';
export const HUB_INVITE_FORBIDDEN_MESSAGE = 'Invites are available after your shop goes live.';

export const HUB_OWNER_EDIT_ACTIONS = {
  services: PREVIEW_REQUEST_ACTIONS.OWNER_EDITED_SERVICES,
  team: PREVIEW_REQUEST_ACTIONS.OWNER_EDITED_TEAM,
  products: PREVIEW_REQUEST_ACTIONS.OWNER_EDITED_PRODUCTS,
} as const;

export type HubOwnerEditSection = keyof typeof HUB_OWNER_EDIT_ACTIONS;

/** At most one owner-edit event per section per this window. */
export const HUB_OWNER_EDIT_DEBOUNCE_MS = 10 * 60 * 1000;

export type HubAdminAllowlistEntry = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Exact path or a tight `:param` pattern. Never a prefix wildcard. */
  path: string;
  permission: Permission | 'session';
  why: string;
};

/**
 * Method + path pairs the Team / Services / Products screens call. Built from the step-0 audit.
 * Static paths are matched exactly; `:param` matches one non-empty segment.
 */
export const HUB_ADMIN_API_ALLOWLIST: readonly HubAdminAllowlistEntry[] = [
  { method: 'GET', path: '/api/admin/session', permission: 'session', why: 'SPA boot; always allowed' },

  { method: 'GET', path: '/api/admin/services', permission: 'catalog.manage', why: 'Services list (also team.read)' },
  { method: 'POST', path: '/api/admin/services', permission: 'catalog.manage', why: 'Create service' },
  { method: 'PATCH', path: '/api/admin/services/:id', permission: 'catalog.manage', why: 'Edit / hide service' },
  { method: 'POST', path: '/api/admin/services/reorder', permission: 'catalog.manage', why: 'Reorder services' },
  { method: 'POST', path: '/api/admin/services/upload-image', permission: 'catalog.manage', why: 'Service image' },
  { method: 'GET', path: '/api/admin/service-categories', permission: 'catalog.manage', why: 'Category list' },
  { method: 'POST', path: '/api/admin/service-categories', permission: 'catalog.manage', why: 'Add category' },

  { method: 'GET', path: '/api/admin/barbers', permission: 'catalog.manage', why: 'Team / barber list (also team.read)' },
  { method: 'POST', path: '/api/admin/barbers', permission: 'catalog.manage', why: 'Create or edit barber' },
  { method: 'POST', path: '/api/admin/barbers/delete', permission: 'catalog.manage', why: 'Remove barber' },
  { method: 'POST', path: '/api/admin/barbers/reorder', permission: 'catalog.manage', why: 'Reorder team' },
  { method: 'GET', path: '/api/admin/barbers/:id/rules', permission: 'catalog.manage', why: 'Working hours (also team.read)' },
  { method: 'PUT', path: '/api/admin/barbers/:id/rules', permission: 'catalog.manage', why: 'Save working hours' },
  { method: 'GET', path: '/api/admin/barbers/:id/services', permission: 'catalog.manage', why: 'Barber services' },
  { method: 'PUT', path: '/api/admin/barbers/:id/services', permission: 'catalog.manage', why: 'Save barber services' },

  { method: 'GET', path: '/api/admin/team', permission: 'team.read', why: 'Team cards (also catalog.manage)' },
  {
    method: 'PATCH',
    path: '/api/admin/team/booking-profiles/:barberId/online-bookings',
    permission: 'catalog.manage',
    why: 'Toggle barber online bookings (shop stays paused)',
  },

  { method: 'GET', path: '/api/admin/timeblocks', permission: 'catalog.manage', why: 'Breaks and holidays list' },
  { method: 'POST', path: '/api/admin/timeblocks/create', permission: 'catalog.manage', why: 'Create break or holiday' },
  { method: 'POST', path: '/api/admin/timeblocks/delete', permission: 'catalog.manage', why: 'Remove time block' },

  { method: 'GET', path: '/api/admin/shop/products', permission: 'retail.manage', why: 'Products list' },
  { method: 'POST', path: '/api/admin/shop/products/create', permission: 'retail.manage', why: 'Create product (does not enable retail)' },
  { method: 'POST', path: '/api/admin/shop/products/update', permission: 'retail.manage', why: 'Edit product' },
  { method: 'POST', path: '/api/admin/shop/products/delete', permission: 'retail.manage', why: 'Delete product' },
  { method: 'POST', path: '/api/admin/shop/products/toggle', permission: 'retail.manage', why: 'Hide / feature product' },
  { method: 'POST', path: '/api/admin/shop/products/reorder', permission: 'retail.manage', why: 'Reorder products' },
  { method: 'PATCH', path: '/api/admin/shop/products/:id', permission: 'retail.manage', why: 'Patch product flags' },
  { method: 'POST', path: '/api/admin/products/upload-image', permission: 'retail.manage', why: 'Product image' },
];

const BETTER_AUTH_SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-|__Host-)?better-auth\.session_token=/i;
/** Same name as SHOP_PREVIEW_COOKIE — inlined so this module does not import Prisma. */
const PREVIEW_COOKIE = /(?:^|;\s*)kersivo_shop_preview=/;

const exactAllow = new Set(
  HUB_ADMIN_API_ALLOWLIST.filter((entry) => !entry.path.includes(':')).map(
    (entry) => `${entry.method} ${entry.path}`,
  ),
);

const patternedAllow = HUB_ADMIN_API_ALLOWLIST.filter((entry) => entry.path.includes(':')).map((entry) => ({
  method: entry.method,
  regex: new RegExp(
    `^${entry.path
      .split('/')
      .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/')}$`,
  ),
}));

function normalizeAdminPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export function isHubAdminApiAllowed(method: string, pathname: string): boolean {
  const path = normalizeAdminPath(pathname);
  const verb = method.toUpperCase();
  if (verb === 'GET' && path === '/api/admin/session') return true;
  if (exactAllow.has(`${verb} ${path}`)) return true;
  return patternedAllow.some((entry) => entry.method === verb && entry.regex.test(path));
}

export function hasBetterAuthSessionCookie(request: Request): boolean {
  return BETTER_AUTH_SESSION_COOKIE.test(request.headers.get('cookie') || '');
}

export function hasShopPreviewCookie(request: Request): boolean {
  return PREVIEW_COOKIE.test(request.headers.get('cookie') || '');
}

/** Valid `ks_hub` and no Better Auth / guest-preview session — the middleware allowlist applies. */
export function isHubOnlyAdminApiRequest(request: Request, now: Date = new Date()): boolean {
  if (hasBetterAuthSessionCookie(request) || hasShopPreviewCookie(request)) return false;
  return Boolean(verifyHubSession(readHubCookie(request), now));
}

export function hubAdminUnavailableResponse(): Response {
  return new Response(JSON.stringify({ error: HUB_ADMIN_UNAVAILABLE_MESSAGE }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function hubInviteForbiddenResponse(): Response {
  return new Response(JSON.stringify({ error: HUB_INVITE_FORBIDDEN_MESSAGE }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function denyHubInvite(access: { via: string }): Response | null {
  return access.via === 'hub' ? hubInviteForbiddenResponse() : null;
}

export function denyHubRestricted(access: { via: string }): Response | null {
  return access.via === 'hub' ? hubAdminUnavailableResponse() : null;
}

const HUB_ADMIN_STAGES = new Set(['requested', 'designing', 'review']);

export type HubAdminAccess = {
  shopId: string;
  userId: null;
  userName: null;
  userEmail: null;
  emailVerified: true;
  userImage: null;
  via: 'hub';
  role: 'OWNER';
  memberId: null;
  barberId: null;
  permissions: readonly Permission[];
  previewRequestId: string;
};

/**
 * Tenant access to the ownerless draft shop for a live hub cookie.
 * Converted / launch owners keep Better Auth and never reach this path.
 */
export async function resolveHubAdminAccess(context: APIContext, now: Date = new Date()): Promise<HubAdminAccess | null> {
  if (!isAdminHubRouteEnabled()) return null;

  const cookie = readHubCookie(context.request);
  const session = verifyHubSession(cookie, now);
  if (!session) return null;

  let operatorOk = false;
  if (session.operator) {
    const operator = await resolveOperatorAccess(context.request);
    if (!operator.ok) return null;
    operatorOk = true;
  }

  const ctx = await resolveHubContext({ cookie }, { isOperator: operatorOk, now });
  if (!ctx || ctx.state.kind !== 'hub' || !HUB_ADMIN_STAGES.has(ctx.state.stage)) return null;

  const draftShopId = ctx.request.draftShopId;
  if (!draftShopId) return null;

  const [anonymised, shop] = await Promise.all([
    prisma.previewRequest.findUnique({
      where: { id: ctx.request.id },
      select: { anonymisedAt: true },
    }),
    prisma.shopSettings.findUnique({
      where: { id: draftShopId },
      select: { id: true, ownerUserId: true },
    }),
  ]);
  if (anonymised?.anonymisedAt) return null;
  if (!shop || shop.ownerUserId) return null;

  return {
    shopId: shop.id,
    userId: null,
    userName: null,
    userEmail: null,
    emailVerified: true,
    userImage: null,
    via: 'hub',
    role: 'OWNER',
    memberId: null,
    barberId: null,
    permissions: HUB_ADMIN_PERMISSIONS,
    previewRequestId: ctx.request.id,
  };
}

export function hubOwnerEditSectionForPath(pathname: string): HubOwnerEditSection | null {
  const path = normalizeAdminPath(pathname);
  if (path.startsWith('/api/admin/services') || path.startsWith('/api/admin/service-categories')) {
    return 'services';
  }
  if (
    path.startsWith('/api/admin/barbers') ||
    path.startsWith('/api/admin/team') ||
    path.startsWith('/api/admin/timeblocks')
  ) {
    return 'team';
  }
  if (path.startsWith('/api/admin/shop/products') || path.startsWith('/api/admin/products')) {
    return 'products';
  }
  return null;
}

/** Best-effort: at most one event per section per 10 minutes. Never throws to the caller. */
export async function recordHubOwnerAdminEdit(input: {
  request: Request;
  pathname: string;
  method: string;
  now?: Date;
}): Promise<void> {
  const method = input.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const section = hubOwnerEditSectionForPath(input.pathname);
  if (!section) return;

  const session = verifyHubSession(readHubCookie(input.request), input.now);
  if (!session || session.operator) return;

  const action = HUB_OWNER_EDIT_ACTIONS[section];
  const since = new Date((input.now ?? new Date()).getTime() - HUB_OWNER_EDIT_DEBOUNCE_MS);
  try {
    const recent = await prisma.previewRequestEvent.findFirst({
      where: {
        previewRequestId: session.previewRequestId,
        action,
        createdAt: { gt: since },
      },
      select: { id: true },
    });
    if (recent) return;
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: session.previewRequestId,
        action,
        meta: { section },
      },
    });
  } catch (error) {
    console.error('[admin-hub] owner edit event failed', {
      section,
      error: error instanceof Error ? error.message : error,
    });
  }
}
