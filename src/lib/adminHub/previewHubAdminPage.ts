import type { APIContext } from 'astro';
import {
  ADMIN_PRIVATE_HEADERS,
  adminSessionShopFor,
  resolveAdminPageMode,
} from './adminMode';
import type { AdminHubChrome } from './hubChrome';
import { preparePreviewHubPage, type PreviewHubPageData, type PreviewHubPrepareResult } from './previewHubPage';
import { paidAdminRedirectForHubPath, type PreviewHubSection } from './previewHubPaths';

export type PreviewHubRealAdminSection = 'team' | 'services' | 'products';

/** Astro page context: APIContext plus the page `response` used to set headers. */
type PreviewHubAstroContext = Pick<APIContext, 'request' | 'url' | 'locals'> & {
  response: { headers: Pick<Headers, 'set' | 'append'> };
};

function redirectTo(location: string, setCookie: string | null): Response {
  const headers = new Headers({ Location: location, ...ADMIN_PRIVATE_HEADERS });
  if (setCookie) headers.append('Set-Cookie', setCookie);
  return new Response(null, { status: 302, headers });
}

/**
 * Hub real-admin pages (Team / Services / Products).
 * Paid visitors keep the SPA bookmark: 302 to /admin?section=…
 */
export async function preparePreviewHubRealAdminPage(input: {
  context: PreviewHubAstroContext;
  section: PreviewHubRealAdminSection;
}): Promise<PreviewHubPrepareResult> {
  const { context, section } = input;
  const now = new Date();
  const mode =
    context.locals.adminHubMode ??
    (await resolveAdminPageMode({
      request: context.request,
      now,
      sessionShop: () => adminSessionShopFor(context as unknown as APIContext),
    }));

  if (!mode || mode.kind === 'full') {
    return {
      kind: 'response',
      response: redirectTo(paidAdminRedirectForHubPath(section), mode?.setCookie ?? null),
    };
  }

  context.locals.adminHubMode = mode;
  return preparePreviewHubPage({
    context,
    section: section as PreviewHubSection,
  });
}

export function hubChromeFromPage(data: PreviewHubPageData, section: PreviewHubRealAdminSection): AdminHubChrome {
  return {
    section,
    setup: data.view.setup,
    unreadMessages: data.view.unreadMessages,
    isOperator: data.ctx.isOperator,
    shopName: data.shopName,
    shopLogoUrl: data.logoSrc,
    profileUser: {
      name: data.ctx.request.firstName || data.shopName,
      email: data.ctx.request.email,
      image: null,
    },
    underConstruction: data.underConstruction,
  };
}

export function pageHasDraftShop(data: PreviewHubPageData): boolean {
  return Boolean(data.ctx.request.draftShopId);
}
