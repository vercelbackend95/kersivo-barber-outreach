import type { HubPageContext } from '@/lib/freePreview/hubPage';
import {
  designingAtFromEvents,
  hubActivityItems,
  hubStepper,
  loadHubOverviewExtras,
} from '@/lib/freePreview/hubPage';
import { loadActiveHubAssets, serializeHubAsset } from '@/lib/freePreview/hubAssets';
import { countOpenHubChanges, loadHubChanges } from '@/lib/freePreview/hubChanges';
import { countUnreadKersivoMessages, loadHubMessages } from '@/lib/freePreview/hubMessages';
import {
  cardStateFromReview,
  loadHubReviewShopData,
  loadLatestHubReviews,
  reviewNowNeed,
} from '@/lib/freePreview/hubReviews';
import { loadHubLaunchProgress } from '@/lib/freePreview/hubLaunch';
import { buildHubChecklist, checklistFlagsFromAssets } from '@/lib/freePreview/hubChecklist';
import { isSetupPhase1Stage, setupPhase1Items } from './setupCard';

export type AdminHubSection = 'overview' | 'changes' | 'website';
export type AdminHubBody = AdminHubSection | 'setup' | 'messages';

const SETUP_APPS = new Set(['setup', 'logo', 'photos', 'services', 'team', 'hours', 'about', 'colours']);

/**
 * `?section=` picks the nav item; `?app=` opens an app. Until the app windows land (Batch 3+), setup-style apps
 * render the existing "Your shop" screen and `activity` falls back to Overview.
 */
export function parseAdminHubLocation(search: URLSearchParams): {
  section: AdminHubSection;
  body: AdminHubBody;
  view: 'website' | 'booking';
  draft: 'message' | 'reopen' | null;
} {
  const rawSection = search.get('section');
  const section: AdminHubSection =
    rawSection === 'changes' || rawSection === 'website' ? rawSection : 'overview';
  const app = (search.get('app') ?? '').trim();
  const body: AdminHubBody = app === 'messages' ? 'messages' : SETUP_APPS.has(app) ? 'setup' : section;
  const rawDraft = search.get('draft');
  return {
    section,
    body,
    view: search.get('view') === 'booking' ? 'booking' : 'website',
    draft: rawDraft === 'message' || rawDraft === 'reopen' ? rawDraft : null,
  };
}

export async function loadAdminHubView(ctx: HubPageContext, body: AdminHubBody, now: Date) {
  const id = ctx.request.id;
  const caps = ctx.state.capabilities;
  const wantsOverview = body === 'overview';
  const wantsChanges = (body === 'changes' || body === 'website') && caps.canDraftChanges;

  const [assets, reviews, unreadMessages, openChanges, events, reviewShop, launchProgress, changeItems, messages] =
    await Promise.all([
      loadActiveHubAssets(id),
      loadLatestHubReviews(id),
      ctx.isOperator || body === 'messages' ? Promise.resolve(0) : countUnreadKersivoMessages(id),
      countOpenHubChanges(id),
      wantsOverview ? loadHubOverviewExtras(id) : Promise.resolve([]),
      (wantsOverview || body === 'setup') && ctx.request.draftShopId
        ? loadHubReviewShopData(ctx.request.draftShopId, id)
        : Promise.resolve(null),
      wantsOverview && (ctx.state.stage === 'launch' || ctx.state.stage === 'live')
        ? loadHubLaunchProgress(id)
        : Promise.resolve(null),
      wantsChanges ? loadHubChanges(id) : Promise.resolve([]),
      body === 'messages' ? loadHubMessages(id) : Promise.resolve([]),
    ]);

  const serialized = assets.map(serializeHubAsset);
  const logo = [...serialized].reverse().find((asset) => asset.kind === 'LOGO') ?? null;
  const setup = isSetupPhase1Stage(ctx.state.stage)
    ? setupPhase1Items({
        stage: ctx.state.stage,
        assetKinds: assets.map((asset) => asset.kind),
        aboutText: ctx.request.aboutText,
        reviewStates: {
          SERVICES: reviews.SERVICES?.state ?? null,
          TEAM: reviews.TEAM?.state ?? null,
          HOURS: reviews.HOURS?.state ?? null,
        },
      })
    : null;

  const overview = wantsOverview
    ? {
        steps: hubStepper({
          stage: ctx.state.stage,
          createdAt: ctx.request.createdAt,
          designingAt: designingAtFromEvents(events),
          previewReadyAt: ctx.request.previewReadyAt,
          convertedAt: ctx.request.convertedAt,
          liveAt: ctx.request.liveAt,
        }),
        activity: hubActivityItems(events, now),
        checklist: buildHubChecklist({
          stage: ctx.state.stage,
          ...checklistFlagsFromAssets(assets, ctx.request.aboutText),
        }),
        reviewNeed: reviewNowNeed({
          SERVICES: cardStateFromReview(reviews.SERVICES?.state ?? null),
          TEAM: cardStateFromReview(reviews.TEAM?.state ?? null),
          HOURS: cardStateFromReview(reviews.HOURS?.state ?? null),
        }),
        launchProgress,
      }
    : null;

  return {
    assets: serialized,
    logo,
    reviews,
    reviewShop,
    unreadMessages,
    openChanges,
    changeItems,
    messages,
    setup,
    overview,
  };
}

export type AdminHubView = Awaited<ReturnType<typeof loadAdminHubView>>;
