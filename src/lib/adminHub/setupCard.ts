import type { HubStage } from '@/lib/freePreview/hubStage';
import { adminHubAppHref, type AdminHubAppId } from './apps';

/** Red setup card (docs/admin-hub/ADMIN_HUB_SPEC.md §5). Client-safe. */

export const SETUP_PHASE1_TITLE = 'Help us build your site';
export const SETUP_PHASE2_TITLE = "Let's put you live";
export const SETUP_PHASE3_TITLE = 'Get the most from KERSIVO';
export const SETUP_FROM_LINKS_TAG = 'From your links';
export const SETUP_OPTIONAL_TAG = 'Optional';
export const SETUP_FROM_LINKS_BODY =
  "We'll fill these from your links — you'll check them when your preview is ready";
export const SETUP_LAUNCH_SIGN_IN = 'Sign in to finish these steps.';

export function setupPhase1Status(done: number, total: number): string {
  return `Your shop · ${done} of ${total}`;
}

export function setupPhase2Status(done: number, total: number): string {
  return `Launch · ${done} of ${total}`;
}

export function setupPhase3Status(done: number, total: number): string {
  return `You're live · ${done} of ${total}`;
}

export type SetupCardPhase = 1 | 2 | 3;
export type SetupItemId = 'logo' | 'photos' | 'services' | 'team' | 'hours' | 'about';
export type SetupPhase2ItemId = 'business' | 'domain' | 'payments' | 'approve';
export type SetupPhase3ItemId = 'view-site' | 'test-booking' | 'retail';
export type SetupCardItemId = SetupItemId | SetupPhase2ItemId | SetupPhase3ItemId;

export type SetupItem = {
  id: SetupCardItemId;
  label: string;
  href: string;
  done: boolean;
  optional: boolean;
  fromLinks: boolean;
};

export type SetupCardModel = {
  phase: SetupCardPhase;
  status: string;
  title: string;
  items: SetupItem[];
  done: number;
  total: number;
  nextId: SetupCardItemId | null;
};

const PHASE1_LABELS: Record<SetupItemId, string> = {
  logo: 'Logo',
  photos: 'Shop photos',
  services: 'Services & prices',
  team: 'Team',
  hours: 'Opening hours',
  about: 'About your shop',
};

const PHASE2_LABELS: Record<SetupPhase2ItemId, string> = {
  business: 'Business details',
  domain: 'Domain',
  payments: 'Payments',
  approve: 'Approve your website',
};

const PHASE3_LABELS: Record<SetupPhase3ItemId, string> = {
  'view-site': 'View your website',
  'test-booking': 'Make a test booking',
  retail: 'Set up retail',
};

export type ReviewState = 'CONFIRMED' | 'CORRECTIONS_SENT' | 'APPLIED' | 'DISMISSED' | null;

export function reviewStepDone(state: ReviewState | undefined): boolean {
  return state === 'CONFIRMED' || state === 'CORRECTIONS_SENT' || state === 'APPLIED';
}

export function isSetupPhase1Stage(stage: HubStage): boolean {
  return stage === 'requested' || stage === 'designing' || stage === 'review';
}

export function isSetupPhase2Stage(stage: HubStage): boolean {
  return stage === 'launch';
}

function pickNext(items: SetupItem[]): SetupCardItemId | null {
  const required = items.find((item) => !item.done && !item.optional && !item.fromLinks);
  if (required) return required.id;
  const rest = items.find((item) => !item.done && !item.fromLinks);
  return rest?.id ?? null;
}

function pack(phase: SetupCardPhase, title: string, status: (done: number, total: number) => string, items: SetupItem[]): SetupCardModel {
  const done = items.filter((item) => item.done).length;
  return { phase, title, status: status(done, items.length), items, done, total: items.length, nextId: pickNext(items) };
}

export function setupPhase1Items(input: {
  stage: HubStage;
  assetKinds: readonly string[];
  aboutText: string | null | undefined;
  reviewStates: { SERVICES?: ReviewState; TEAM?: ReviewState; HOURS?: ReviewState };
}): SetupCardModel {
  const beforeReview = input.stage === 'requested' || input.stage === 'designing';
  const has = (kind: string) => input.assetKinds.includes(kind);
  const items: SetupItem[] = (
    [
      ['logo', has('LOGO'), false, false],
      ['photos', has('SHOP_PHOTO'), false, false],
      ['services', reviewStepDone(input.reviewStates.SERVICES), false, beforeReview],
      ['team', reviewStepDone(input.reviewStates.TEAM), false, beforeReview],
      ['hours', reviewStepDone(input.reviewStates.HOURS), false, beforeReview],
      ['about', Boolean(input.aboutText?.trim()), true, false],
    ] as const
  ).map(([id, done, optional, fromLinks]) => ({
    id,
    label: PHASE1_LABELS[id],
    href: adminHubAppHref(id),
    done,
    optional,
    fromLinks,
  }));
  return pack(1, SETUP_PHASE1_TITLE, setupPhase1Status, items);
}

export function setupPhase2Items(input: {
  businessDone: boolean;
  domainDone: boolean;
  paymentsDone: boolean;
  approveDone: boolean;
}): SetupCardModel {
  const rows: Array<[SetupPhase2ItemId, boolean, boolean]> = [
    ['business', input.businessDone, false],
    ['domain', input.domainDone, false],
    ['payments', input.paymentsDone, true],
    ['approve', input.approveDone, false],
  ];
  const items: SetupItem[] = rows.map(([id, done, optional]) => ({
    id,
    label: PHASE2_LABELS[id],
    href: adminHubAppHref(id satisfies AdminHubAppId),
    done,
    optional,
    fromLinks: false,
  }));
  return pack(2, SETUP_PHASE2_TITLE, setupPhase2Status, items);
}

/** Batch 6 renders this. Typed now so the live card cannot invent a fourth shape. */
export function setupPhase3Items(input: {
  viewedSite: boolean;
  testBookingDone: boolean;
  retailDone: boolean;
}): SetupCardModel {
  const rows: Array<[SetupPhase3ItemId, boolean, boolean, string]> = [
    ['view-site', input.viewedSite, false, '#'] ,
    ['test-booking', input.testBookingDone, false, '/admin/test-book'],
    ['retail', input.retailDone, true, '/admin?section=retail'],
  ];
  const items: SetupItem[] = rows.map(([id, done, optional, href]) => ({
    id,
    label: PHASE3_LABELS[id],
    href,
    done,
    optional,
    fromLinks: false,
  }));
  return pack(3, SETUP_PHASE3_TITLE, setupPhase3Status, items);
}

export function setupCardForStage(input: {
  stage: HubStage;
  assetKinds: readonly string[];
  aboutText: string | null | undefined;
  reviewStates: { SERVICES?: ReviewState; TEAM?: ReviewState; HOURS?: ReviewState };
  launch?: {
    businessDone: boolean;
    domainDone: boolean;
    paymentsDone: boolean;
    approveDone: boolean;
  } | null;
}): SetupCardModel | null {
  if (isSetupPhase1Stage(input.stage)) return setupPhase1Items(input);
  if (isSetupPhase2Stage(input.stage) && input.launch) return setupPhase2Items(input.launch);
  return null;
}
