import type { APIContext } from 'astro';
import type { AdminHubAppContext } from '@/components/adminHub/apps/types';
import { adminHubAppMeta } from './apps';
import { parseBrandPalette } from './brandColours';
import {
  ADMIN_PRIVATE_HEADERS,
  adminSessionShopFor,
  resolveAdminPageMode,
  type AdminPageMode,
} from './adminMode';
import { loadAdminHubView, parseAdminHubLocation, type AdminHubView } from './hubView';
import { ADMIN_HUB_API_BASE, ADMIN_HUB_LINKS } from './links';
import { previewHubLegacyRedirect, type PreviewHubSection } from './previewHubPaths';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { HUB_DRAFT_DECLINED, HUB_DRAFT_REOPEN, HUB_NAV } from '@/lib/freePreview/hubCopy';
import { hubNotFound, recordHubOwnerView, type HubPageContext } from '@/lib/freePreview/hubPage';
import { recordPreviewView, shouldRecordOwnerView } from '@/lib/freePreview/previewAccess';
import { EXTRA_FRAME_SRC_HEADER } from '@/lib/security/headers';

export type PreviewHubPageData = {
  ctx: HubPageContext;
  view: AdminHubView;
  location: ReturnType<typeof parseAdminHubLocation>;
  appCtx: AdminHubAppContext;
  shopName: string;
  logoSrc: string | null;
  sitePreviewUrl: string | null;
  showPreview: boolean;
  websiteView: 'website' | 'booking';
  brandColoursSource: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandPaletteExtracted: ReturnType<typeof parseBrandPalette>;
  title: string;
  underConstruction: boolean;
};

export type PreviewHubPrepareResult =
  | { kind: 'response'; response: Response }
  | { kind: 'page'; data: PreviewHubPageData };

/** Astro page context: APIContext plus the page `response` used to set headers. */
type PreviewHubAstroContext = Pick<APIContext, 'request' | 'url' | 'locals'> & {
  response: { headers: Pick<Headers, 'set' | 'append'> };
};

function redirectTo(location: string, setCookie: string | null): Response {
  const headers = new Headers({ Location: location, ...ADMIN_PRIVATE_HEADERS });
  if (setCookie) headers.append('Set-Cookie', setCookie);
  return new Response(null, { status: 303, headers });
}

export async function preparePreviewHubPage(input: {
  context: PreviewHubAstroContext;
  section: PreviewHubSection;
  /** When true, a full-admin visitor is sent to /admin instead of 404. */
  fallbackFullToAdmin?: boolean;
}): Promise<PreviewHubPrepareResult> {
  const { context } = input;
  const now = new Date();
  const mode: AdminPageMode | null =
    context.locals.adminHubMode ??
    (await resolveAdminPageMode({
      request: context.request,
      now,
      sessionShop: () => adminSessionShopFor(context as unknown as APIContext),
    }));

  if (!mode) {
    return input.fallbackFullToAdmin
      ? { kind: 'response', response: redirectTo('/admin', null) }
      : { kind: 'response', response: hubNotFound() };
  }
  if (mode.kind !== 'hub') {
    return { kind: 'response', response: redirectTo('/admin', mode.setCookie) };
  }

  const legacy = previewHubLegacyRedirect(context.url);
  if (legacy && context.url.pathname === '/admin') {
    return { kind: 'response', response: redirectTo(legacy, mode.setCookie) };
  }

  for (const [name, value] of Object.entries(ADMIN_PRIVATE_HEADERS)) {
    context.response.headers.set(name, value);
  }
  context.response.headers.set('Vary', 'Cookie');
  if (mode.setCookie) context.response.headers.append('Set-Cookie', mode.setCookie);

  const { ctx } = mode;
  const caps = ctx.state.capabilities;
  const location = parseAdminHubLocation(context.url);
  location.section = input.section;
  const clientId = analyticsClientIdFromRequest(context.request);

  await recordHubOwnerView({
    requestId: ctx.request.id,
    stage: ctx.state.stage,
    isOperator: ctx.isOperator,
    now,
    clientId,
  }).catch((error) => {
    console.error('[admin-hub] view tracking failed', error instanceof Error ? error.message : error);
  });

  const showPreview = Boolean(caps.showPreview && ctx.draft);
  const sitePreviewUrl = ctx.draft?.shop.sitePreviewUrl ?? null;
  const websiteView: 'website' | 'booking' =
    location.view === 'booking' || !sitePreviewUrl ? 'booking' : 'website';

  if (input.section === 'website' && showPreview) {
    if (websiteView === 'website' && sitePreviewUrl) {
      context.response.headers.set(EXTRA_FRAME_SRC_HEADER, sitePreviewUrl);
    }
    if (
      shouldRecordOwnerView({
        kind: 'preview',
        request: ctx.request,
        draftShopId: ctx.request.draftShopId ?? '',
        isOperator: ctx.isOperator,
      })
    ) {
      const firstView = await recordPreviewView(ctx.request.id, now).catch((error) => {
        console.error('[admin-hub] preview view tracking failed', error instanceof Error ? error.message : error);
        return false;
      });
      if (firstView) await sendServerAnalyticsEvent({ name: FUNNEL_EVENTS.preview_viewed, clientId });
    }
  }

  const view = await loadAdminHubView(ctx, location, now);
  const shopName = ctx.draft?.shop.name ?? ctx.request.shopName;
  const logoSrc = view.logo?.hasThumb
    ? `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(view.logo.id)}?size=thumb`
    : null;
  const sessionShop = await adminSessionShopFor(context as unknown as APIContext);
  const canEditLaunch = Boolean(
    !ctx.isOperator &&
      ctx.state.stage === 'launch' &&
      sessionShop?.via === 'session' &&
      sessionShop.role === 'OWNER' &&
      sessionShop.shopId &&
      sessionShop.shopId === ctx.request.draftShopId,
  );
  const title = location.app
    ? adminHubAppMeta(location.app).title
    : input.section === 'changes'
      ? HUB_NAV.changes
      : input.section === 'website'
        ? HUB_NAV.website
        : input.section === 'messages'
          ? HUB_NAV.messages
          : HUB_NAV.overview;
  const initialDraft =
    location.draft === 'reopen' ? HUB_DRAFT_REOPEN : location.draft === 'message' ? HUB_DRAFT_DECLINED : '';
  const rawTone = ctx.request.brandBackgroundTone;
  const brandBackgroundTone: 'DARK' | 'LIGHT' | null =
    rawTone === 'DARK' || rawTone === 'LIGHT' ? rawTone : null;
  const rawSource = ctx.request.brandColoursSource;
  const brandColoursSource: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null =
    rawSource === 'LOGO' || rawSource === 'MANUAL' || rawSource === 'KERSIVO_CHOOSES' ? rawSource : null;
  const brandPaletteExtracted = parseBrandPalette(ctx.request.brandPaletteExtracted);
  const appCtx: AdminHubAppContext = {
    apiBase: ADMIN_HUB_API_BASE,
    canUpload: caps.canUpload,
    canEditDetails: caps.canEditDetails,
    canReview: caps.canReview,
    canEditLaunch,
    stage: ctx.state.stage,
    details: {
      brandPrimaryColour: ctx.request.brandPrimaryColour,
      brandSecondaryColour: ctx.request.brandSecondaryColour,
      styleNotes: ctx.request.styleNotes,
      aboutText: ctx.request.aboutText,
      brandBackgroundTone,
      brandColoursSource,
      brandPaletteExtracted,
      brandColoursSentAt: ctx.request.brandColoursSentAt ? ctx.request.brandColoursSentAt.toISOString() : null,
    },
    assets: view.assets,
    reviews: view.reviews,
    reviewShop: view.reviewShop,
    activity: view.activity.map((item) => ({
      id: item.id,
      label: item.label,
      relative: item.relative,
      absolute: item.absolute,
      at: item.at.toISOString(),
    })),
    setupItems: view.setup?.items ?? [],
    messages: view.messages,
    initialDraft,
    viewer: ctx.isOperator ? ('ops' as const) : ('owner' as const),
    requestId: ctx.isOperator ? ctx.request.id : undefined,
    canAttach: caps.canMessage,
    shopName,
    websiteHref: ADMIN_HUB_LINKS.website,
    bookingHref: ADMIN_HUB_LINKS.booking,
    launch: view.launchFlags,
  };

  return {
    kind: 'page',
    data: {
      ctx,
      view,
      location,
      appCtx,
      shopName,
      logoSrc,
      sitePreviewUrl,
      showPreview,
      websiteView,
      brandColoursSource,
      brandPaletteExtracted,
      title,
      underConstruction: ctx.state.stage !== 'live',
    },
  };
}
