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
import { parseAdminHubApp, type AdminHubAppId } from './apps';
import { loadDraftShopSetupCounts } from './draftShopSetupCounts';
import { previewHubSectionFromPath, type PreviewHubSection } from './previewHubPaths';
import { isSetupPhase2Stage, setupCardForStage, type SetupCardModel } from './setupCard';

export type AdminHubSection = PreviewHubSection;

/**
 * Path picks the nav item (`/admin`, `/admin/changes`, …). `?app=` opens an app window.
 */
export function parseAdminHubLocation(url: URL): {
  section: AdminHubSection;
  app: AdminHubAppId | null;
  view: 'website' | 'booking';
  draft: 'message' | 'reopen' | null;
} {
  const rawDraft = url.searchParams.get('draft');
  return {
    section: previewHubSectionFromPath(url.pathname),
    app: parseAdminHubApp(url.searchParams.get('app')),
    view: url.searchParams.get('view') === 'booking' ? 'booking' : 'website',
    draft: rawDraft === 'message' || rawDraft === 'reopen' ? rawDraft : null,
  };
}

export async function loadAdminHubView(
  ctx: HubPageContext,
  location: { section: AdminHubSection; app: AdminHubAppId | null },
  now: Date,
) {
  const id = ctx.request.id;
  const caps = ctx.state.capabilities;
  const stage = ctx.state.stage;
  const wantsOverview = location.section === 'overview';
  const wantsChanges =
    wantsOverview || ((location.section === 'changes' || location.section === 'website') && caps.canDraftChanges);
  const wantsActivity = wantsOverview || location.app === 'activity';
  const wantsMessages = location.section === 'messages' || location.app === 'messages';
  const wantsShop =
    location.app === 'setup' ||
    location.app === 'logo' ||
    location.app === 'photos' ||
    location.app === 'materials' ||
    location.app === 'hours' ||
    location.app === 'about' ||
    location.app === 'colours';
  const wantsLaunch = isSetupPhase2Stage(stage) || location.app === 'business' || location.app === 'domain' || location.app === 'payments' || location.app === 'approve';

  const [assets, reviews, unreadMessages, openChanges, events, reviewShop, launchProgress, changeItems, messages, shopCounts] =
    await Promise.all([
      loadActiveHubAssets(id),
      loadLatestHubReviews(id),
      ctx.isOperator || wantsMessages ? Promise.resolve(0) : countUnreadKersivoMessages(id),
      countOpenHubChanges(id),
      wantsActivity ? loadHubOverviewExtras(id) : Promise.resolve([]),
      (wantsOverview || wantsShop) && ctx.request.draftShopId
        ? loadHubReviewShopData(ctx.request.draftShopId, id)
        : Promise.resolve(null),
      wantsLaunch ? loadHubLaunchProgress(id) : Promise.resolve(null),
      wantsChanges ? loadHubChanges(id) : Promise.resolve([]),
      wantsMessages ? loadHubMessages(id) : Promise.resolve([]),
      loadDraftShopSetupCounts(ctx.request.draftShopId),
    ]);

  const serialized = assets.map(serializeHubAsset);
  const logo = [...serialized].reverse().find((asset) => asset.kind === 'LOGO') ?? null;
  const launchFlags = launchProgress
    ? {
        businessDone: Boolean(launchProgress.yourSteps.find((step) => step.id === 'business')?.done),
        domainDone: Boolean(launchProgress.yourSteps.find((step) => step.id === 'domain')?.done),
        paymentsDone: Boolean(launchProgress.yourSteps.find((step) => step.id === 'payments')?.done),
        approveDone: Boolean(launchProgress.launchApproved),
      }
    : null;

  const setup: SetupCardModel | null = setupCardForStage({
    stage,
    assetKinds: assets.map((asset) => asset.kind),
    aboutText: ctx.request.aboutText,
    reviewStates: {
      SERVICES: reviews.SERVICES?.state ?? null,
      TEAM: reviews.TEAM?.state ?? null,
      HOURS: reviews.HOURS?.state ?? null,
    },
    shopCounts,
    launch: launchFlags,
  });

  const overview = wantsOverview
    ? {
        steps: hubStepper({
          stage,
          createdAt: ctx.request.createdAt,
          designingAt: designingAtFromEvents(events),
          previewReadyAt: ctx.request.previewReadyAt,
          convertedAt: ctx.request.convertedAt,
          liveAt: ctx.request.liveAt,
        }),
        activity: hubActivityItems(events, now),
        checklist: buildHubChecklist({
          stage,
          ...checklistFlagsFromAssets(assets, ctx.request.aboutText),
        }),
        reviewNeed: reviewNowNeed({
          SERVICES: cardStateFromReview(reviews.SERVICES?.state ?? null),
          TEAM: cardStateFromReview(reviews.TEAM?.state ?? null),
          HOURS: cardStateFromReview(reviews.HOURS?.state ?? null),
        }),
        launchProgress,
        changeItems,
      }
    : null;

  const activity = wantsActivity ? hubActivityItems(events, now, 50) : [];

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
    activity,
    launchFlags,
  };
}

export type AdminHubView = Awaited<ReturnType<typeof loadAdminHubView>>;
