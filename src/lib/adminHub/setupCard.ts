import type { HubStage } from '@/lib/freePreview/hubStage';

/** Phase 1 of the red setup card (docs/admin-hub/ADMIN_HUB_SPEC.md §5). Client-safe. */
export const SETUP_PHASE1_TITLE = 'Help us build your site';
export const SETUP_FROM_LINKS_TAG = 'From your links';
export const SETUP_OPTIONAL_TAG = 'Optional';

export function setupPhase1Status(done: number, total: number): string {
  return `Your shop · ${done} of ${total}`;
}

export type SetupItemId = 'logo' | 'photos' | 'services' | 'team' | 'hours' | 'about';

export type SetupItem = {
  id: SetupItemId;
  label: string;
  href: string;
  done: boolean;
  optional: boolean;
  fromLinks: boolean;
};

const LABELS: Record<SetupItemId, string> = {
  logo: 'Logo',
  photos: 'Shop photos',
  services: 'Services & prices',
  team: 'Team',
  hours: 'Opening hours',
  about: 'About your shop',
};

type ReviewState = 'CONFIRMED' | 'CORRECTIONS_SENT' | 'APPLIED' | 'DISMISSED' | null;

function reviewDone(state: ReviewState | undefined): boolean {
  return state === 'CONFIRMED' || state === 'CORRECTIONS_SENT' || state === 'APPLIED';
}

export function isSetupPhase1Stage(stage: HubStage): boolean {
  return stage === 'requested' || stage === 'designing' || stage === 'review';
}

export function setupPhase1Items(input: {
  stage: HubStage;
  assetKinds: readonly string[];
  aboutText: string | null | undefined;
  reviewStates: { SERVICES?: ReviewState; TEAM?: ReviewState; HOURS?: ReviewState };
}): { items: SetupItem[]; done: number; total: number; nextId: SetupItemId | null } {
  const beforeReview = input.stage === 'requested' || input.stage === 'designing';
  const has = (kind: string) => input.assetKinds.includes(kind);
  const items: SetupItem[] = (
    [
      ['logo', has('LOGO'), false, false],
      ['photos', has('SHOP_PHOTO'), false, false],
      ['services', reviewDone(input.reviewStates.SERVICES), false, beforeReview],
      ['team', reviewDone(input.reviewStates.TEAM), false, beforeReview],
      ['hours', reviewDone(input.reviewStates.HOURS), false, beforeReview],
      ['about', Boolean(input.aboutText?.trim()), true, false],
    ] as const
  ).map(([id, done, optional, fromLinks]) => ({
    id,
    label: LABELS[id],
    href: `/admin?app=${id}`,
    done,
    optional,
    fromLinks,
  }));
  const next =
    items.find((item) => !item.done && !item.optional && !item.fromLinks) ??
    items.find((item) => !item.done && !item.fromLinks) ??
    null;
  return {
    items,
    done: items.filter((item) => item.done).length,
    total: items.length,
    nextId: next?.id ?? null,
  };
}
