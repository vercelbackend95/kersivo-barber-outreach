import type { HubStage } from '@/lib/freePreview/hubStage';
import { adminHubMaterialsHref } from './addMenu';
import { adminHubAppHref, type AdminHubAppId } from './apps';
import {
  ADMIN_HUB_SHOP_PRODUCTS_COUNT,
  ADMIN_HUB_SHOP_SERVICES_COUNT,
  ADMIN_HUB_SHOP_TEAM_COUNT,
} from './copy';
import { PREVIEW_HUB_PATHS } from './previewHubPaths';

/** Red setup card (docs/admin-hub/ADMIN_HUB_SPEC.md §5). Client-safe. */

export const SETUP_PHASE1_TITLE = 'Help us build your site';
export const SETUP_PHASE2_TITLE = "Let's put you live";
export const SETUP_PHASE3_TITLE = 'Get the most from KERSIVO';
export const SETUP_OPTIONAL_TAG = 'Optional';
export const SETUP_LAUNCH_SIGN_IN = 'Sign in to finish these steps.';
export const SETUP_PHASE3_DISMISS = 'Dismiss';
export const SETUP_PHASE3_RETAIL_HREF = '/admin/retail-onboarding';
export const SETUP_PHASE3_TEST_BOOK_HREF = '/admin/test-book';

/** Compact sidebar/drawer card (preview hub). Phase titles stay on the model for apps. */
export const SETUP_CARD_TITLE = 'Set up your website';
export const SETUP_LAUNCH_BAR_OPEN = 'Open setup';
export const SETUP_COMPLETE_LABEL = 'Setup complete';
export const SETUP_SHOW_ALL_STEPS = 'Show all steps';
export const SETUP_HIDE_STEPS = 'Hide steps';
export const SETUP_EXPAND_STORAGE_KEY = 'ks_admin_hub_setup_expanded';
export const SETUP_COMPLETE_STORAGE_KEY = 'ks_admin_hub_setup_complete_at';
export const SETUP_COMPLETE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;
export const SETUP_EXPAND_EVENT = 'ks-admin-hub-setup-expand';

export function setupDoneStatus(done: number, total: number): string {
  return `${done} of ${total} done`;
}

export function setupCardAllDone(card: { done: number; total: number }): boolean {
  return card.total > 0 && card.done >= card.total;
}

export type SetupCardChrome = 'checklist' | 'complete' | 'hidden';

/** All-done with no stored date hides immediately (private mode / blocked storage). */
export function resolveSetupCardChrome(
  allDone: boolean,
  nowMs: number,
  storedCompleteAtMs: number | null,
): SetupCardChrome {
  if (!allDone) return 'checklist';
  if (storedCompleteAtMs == null || !Number.isFinite(storedCompleteAtMs)) return 'hidden';
  if (nowMs - storedCompleteAtMs < SETUP_COMPLETE_VISIBLE_MS) return 'complete';
  return 'hidden';
}

export function setupStorageKey(base: string, scope?: string | null): string {
  const suffix = (scope ?? '').trim().toLowerCase();
  return suffix ? `${base}:${suffix}` : base;
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readSetupExpanded(scope?: string | null): boolean {
  return storageGet(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope)) === '1';
}

export function writeSetupExpanded(expanded: boolean, scope?: string | null): void {
  storageSet(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope), expanded ? '1' : '0');
}

export function readSetupCompleteAtMs(scope?: string | null): number | null {
  const raw = storageGet(setupStorageKey(SETUP_COMPLETE_STORAGE_KEY, scope));
  if (!raw) return null;
  const ms = Number(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function writeSetupCompleteAtMs(ms: number, scope?: string | null): boolean {
  return storageSet(setupStorageKey(SETUP_COMPLETE_STORAGE_KEY, scope), String(ms));
}

/** Persist the first time every step is done so the 7-day complete line can show. */
export function rememberSetupCompleteAt(nowMs: number, scope?: string | null): number | null {
  const existing = readSetupCompleteAtMs(scope);
  if (existing != null) return existing;
  return writeSetupCompleteAtMs(nowMs, scope) ? nowMs : null;
}

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
export type SetupItemId = 'logo' | 'photos' | 'services' | 'team' | 'hours' | 'about' | 'products';
export type SetupPhase2ItemId = 'business' | 'domain' | 'payments' | 'approve';
export type SetupPhase3ItemId = 'view-site' | 'test-booking' | 'retail';
export type SetupCardItemId = SetupItemId | SetupPhase2ItemId | SetupPhase3ItemId;

/** Draft-shop counts for phase-1 done rules. Null = no draft shop = not done. */
export type SetupShopCounts = {
  activeServices: number;
  activeBarbers: number;
  products: number;
  /** Saved opening hours on the draft shop meet `openingHoursComplete`. */
  openingHoursSaved: boolean;
};

/** Saved opening-hours rows (minutes from midnight), as stored in ShopOpeningHours. */
export type SavedOpeningHoursRow = { active: boolean; startMinutes: number; endMinutes: number };

/**
 * Opening hours count as set up once at least one open day has a closing time after its opening time.
 * Closed days are fine; a week with no open day is not set up.
 */
export function openingHoursComplete(rows: readonly SavedOpeningHoursRow[]): boolean {
  return rows.some((row) => row.active && row.endMinutes > row.startMinutes);
}

export type SetupItem = {
  id: SetupCardItemId;
  label: string;
  href: string;
  done: boolean;
  optional: boolean;
  /** Shop counts moved off the retired Overview "Your shop" tile. */
  detail?: string;
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
  products: 'Products',
};

function phase1Href(id: SetupItemId, addFirst = false): string {
  if (id === 'services') return addFirst ? `${PREVIEW_HUB_PATHS.services}?add=1` : PREVIEW_HUB_PATHS.services;
  if (id === 'team') return addFirst ? `${PREVIEW_HUB_PATHS.team}?add=1` : PREVIEW_HUB_PATHS.team;
  if (id === 'products') return addFirst ? `${PREVIEW_HUB_PATHS.products}?add=1` : PREVIEW_HUB_PATHS.products;
  if (id === 'logo') return adminHubMaterialsHref('logo');
  if (id === 'photos') return adminHubMaterialsHref('photos');
  if (id === 'about') return adminHubMaterialsHref('text');
  return adminHubMaterialsHref('hours');
}

function shopCountDetail(id: SetupItemId, counts: SetupShopCounts): string | undefined {
  if (id === 'services' && counts.activeServices > 0) return ADMIN_HUB_SHOP_SERVICES_COUNT(counts.activeServices);
  if (id === 'team' && counts.activeBarbers > 0) return ADMIN_HUB_SHOP_TEAM_COUNT(counts.activeBarbers);
  if (id === 'products' && counts.products > 0) return ADMIN_HUB_SHOP_PRODUCTS_COUNT(counts.products);
  return undefined;
}

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

export function isSetupPhase1Stage(stage: HubStage): boolean {
  return stage === 'requested' || stage === 'designing' || stage === 'review';
}

export function isSetupPhase2Stage(stage: HubStage): boolean {
  return stage === 'launch';
}

function pickNext(items: SetupItem[]): SetupCardItemId | null {
  const required = items.find((item) => !item.done && !item.optional);
  if (required) return required.id;
  const rest = items.find((item) => !item.done);
  return rest?.id ?? null;
}

/**
 * `requiredOnly`: optional rows stay on the list but do not count towards progress, so the card completes once
 * every required row is done (phase 1: About and Products). Launch keeps counting Payments (done = connected or skipped).
 */
function pack(
  phase: SetupCardPhase,
  title: string,
  status: (done: number, total: number) => string,
  items: SetupItem[],
  options: { requiredOnly?: boolean } = {},
): SetupCardModel {
  const counted = options.requiredOnly ? items.filter((item) => !item.optional) : items;
  const done = counted.filter((item) => item.done).length;
  const total = counted.length;
  return { phase, title, status: status(done, total), items, done, total, nextId: pickNext(items) };
}

export function setupPhase1Items(input: {
  stage: HubStage;
  assetKinds: readonly string[];
  aboutText: string | null | undefined;
  shopCounts?: SetupShopCounts | null;
}): SetupCardModel {
  const has = (kind: string) => input.assetKinds.includes(kind);
  const counts = input.shopCounts ?? { activeServices: 0, activeBarbers: 0, products: 0, openingHoursSaved: false };
  const items: SetupItem[] = (
    [
      ['logo', has('LOGO'), false],
      ['photos', has('SHOP_PHOTO'), false],
      ['services', counts.activeServices > 0, false],
      ['team', counts.activeBarbers > 0, false],
      ['hours', counts.openingHoursSaved, false],
      ['about', Boolean(input.aboutText?.trim()), true],
      ['products', counts.products > 0, true],
    ] as const
  ).map(([id, done, optional]) => ({
    id,
    label: PHASE1_LABELS[id],
    href: phase1Href(id, !done && (id === 'services' || id === 'team' || id === 'products')),
    done,
    optional,
    detail: shopCountDetail(id, counts),
  }));
  return pack(1, SETUP_PHASE1_TITLE, setupPhase1Status, items, { requiredOnly: true });
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
  }));
  return pack(2, SETUP_PHASE2_TITLE, setupPhase2Status, items);
}

export function setupPhase3Items(input: {
  viewedSite: boolean;
  testBookingDone: boolean;
  retailDone: boolean;
  liveUrl?: string | null;
}): SetupCardModel {
  const liveUrl = (input.liveUrl ?? '').trim();
  const rows: Array<[SetupPhase3ItemId, boolean, boolean, string]> = [
    ['view-site', input.viewedSite, false, liveUrl || '#'],
    ['test-booking', input.testBookingDone, false, SETUP_PHASE3_TEST_BOOK_HREF],
    ['retail', input.retailDone, true, SETUP_PHASE3_RETAIL_HREF],
  ];
  const items: SetupItem[] = rows.map(([id, done, optional, href]) => ({
    id,
    label: PHASE3_LABELS[id],
    href,
    done,
    optional,
  }));
  return pack(3, SETUP_PHASE3_TITLE, setupPhase3Status, items);
}

export function setupCardForStage(input: {
  stage: HubStage;
  assetKinds: readonly string[];
  aboutText: string | null | undefined;
  shopCounts?: SetupShopCounts | null;
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
