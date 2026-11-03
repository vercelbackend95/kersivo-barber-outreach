/**
 * One client-side source of truth for live hub data (Overview tiles, sidebar logo, app windows).
 * Seeded once from `<script type="application/json" id="admin-hub-state">`, refreshed from
 * GET /api/admin-hub/state after a mutation — never polled.
 */
import { useSyncExternalStore } from 'react';
import {
  ADMIN_HUB_DATA_CHANGED_EVENT,
  ADMIN_HUB_STATE_SCRIPT_ID,
  ADMIN_HUB_STATE_URL,
  type AdminHubDataChangedReason,
  type AdminHubLiveState,
} from './liveState';

export type HubStoreSnapshot = {
  state: AdminHubLiveState | null;
  /** Bumps each time a refresh changed something (drives the "Overview updated" announcement). */
  revision: number;
  /** A refresh is scheduled or in flight. */
  pending: boolean;
};

type Fetcher = (url: string) => Promise<Response>;

export const HUB_REFRESH_DEBOUNCE_MS = 150;
export const HUB_HIDDEN_REFRESH_MS = 30_000;

const defaultFetcher: Fetcher = (url) =>
  fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });

let snapshot: HubStoreSnapshot = { state: null, revision: 0, pending: false };
let stateJson = '';
let booted = false;
let fetcher: Fetcher = defaultFetcher;
const listeners = new Set<() => void>();

let dirty = false;
let lastReason: AdminHubDataChangedReason | null = null;
let markSeq = 0;
let requestSeq = 0;
let appliedSeq = 0;
let inFlight: { promise: Promise<AdminHubLiveState | null>; mark: number; seq: number } | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let appOpen = false;
let hiddenAt: number | null = null;
let removeListeners: (() => void) | null = null;

function emit(next: Partial<HubStoreSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function syncPending() {
  const pending = Boolean(inFlight || debounceTimer);
  if (pending !== snapshot.pending) emit({ pending });
}

function readSeed(): AdminHubLiveState | null {
  if (typeof document === 'undefined') return null;
  const node = document.getElementById(ADMIN_HUB_STATE_SCRIPT_ID);
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as AdminHubLiveState;
  } catch {
    return null;
  }
}

function setState(next: AdminHubLiveState): boolean {
  const json = JSON.stringify(next);
  if (json === stateJson) return false;
  const first = snapshot.state === null;
  stateJson = json;
  emit({ state: next, revision: first ? snapshot.revision : snapshot.revision + 1 });
  return true;
}

function installListeners() {
  if (typeof window === 'undefined' || removeListeners) return;
  const onChanged = (event: Event) => {
    const reason = (event as CustomEvent<{ reason?: AdminHubDataChangedReason }>).detail?.reason ?? 'details-saved';
    markHubDirty(reason);
    // While an app is open its own UI shows the change; the Overview refreshes once, on close.
    if (!appOpen) scheduleRefresh();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away > HUB_HIDDEN_REFRESH_MS) void refreshHubState();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) void refreshHubState();
  };
  window.addEventListener(ADMIN_HUB_DATA_CHANGED_EVENT, onChanged);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);
  removeListeners = () => {
    window.removeEventListener(ADMIN_HUB_DATA_CHANGED_EVENT, onChanged);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
  };
}

function boot() {
  if (booted || typeof window === 'undefined') return;
  booted = true;
  const seed = readSeed();
  if (seed) setState(seed);
  installListeners();
}

export function getHubState(): AdminHubLiveState | null {
  boot();
  return snapshot.state;
}

export function getHubSnapshot(): HubStoreSnapshot {
  boot();
  return snapshot;
}

export function subscribeHubState(listener: () => void): () => void {
  boot();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Seeds the store when the page has no JSON block (tests, or an island rendered outside the hub frame). */
export function seedHubState(state: AdminHubLiveState): void {
  boot();
  if (!snapshot.state) setState(state);
}

export function markHubDirty(reason: AdminHubDataChangedReason): void {
  dirty = true;
  lastReason = reason;
  markSeq += 1;
}

export function isHubDirty(): boolean {
  return dirty;
}

export function lastHubDirtyReason(): AdminHubDataChangedReason | null {
  return lastReason;
}

/**
 * Fetches fresh state. Concurrent calls share one request unless something changed after it started;
 * a response older than one already applied is dropped; on error the last good state stays.
 */
export function refreshHubState(): Promise<AdminHubLiveState | null> {
  boot();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (inFlight && inFlight.mark === markSeq) return inFlight.promise;
  const seq = ++requestSeq;
  const mark = markSeq;
  const run = async (): Promise<AdminHubLiveState | null> => {
    try {
      const response = await fetcher(ADMIN_HUB_STATE_URL);
      if (!response.ok) throw new Error(`state ${response.status}`);
      const body = (await response.json()) as { ok?: boolean; state?: AdminHubLiveState };
      if (!body.ok || !body.state) throw new Error('state payload');
      if (seq < appliedSeq) return snapshot.state;
      appliedSeq = seq;
      if (mark === markSeq) dirty = false;
      setState(body.state);
      return snapshot.state;
    } catch {
      return snapshot.state;
    } finally {
      if (inFlight?.seq === seq) inFlight = null;
      syncPending();
    }
  };
  const promise = run();
  inFlight = { promise, mark, seq };
  syncPending();
  return promise;
}

function scheduleRefresh() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void refreshHubState();
  }, HUB_REFRESH_DEBOUNCE_MS);
  syncPending();
}

/** AppHost reports whether an app window/sheet is open. */
export function setHubAppOpen(open: boolean): void {
  boot();
  appOpen = open;
}

/** An app closed (or switched): refresh once if something changed while it was open. */
export function flushHubDirty(): Promise<AdminHubLiveState | null> | null {
  boot();
  if (!dirty) return null;
  return refreshHubState();
}

export function useHubSnapshot(): HubStoreSnapshot {
  return useSyncExternalStore(subscribeHubState, getHubSnapshot, getServerSnapshot);
}

const serverSnapshot: HubStoreSnapshot = { state: null, revision: 0, pending: false };
function getServerSnapshot() {
  return serverSnapshot;
}

/** Live state, or `fallback` (the SSR props) until the store has data — keeps hydration identical. */
export function useHubState(fallback?: AdminHubLiveState | null): AdminHubLiveState | null {
  const state = useSyncExternalStore(
    subscribeHubState,
    () => getHubState(),
    () => null,
  );
  return state ?? fallback ?? null;
}

export function __resetHubStoreForTests(options: { fetcher?: Fetcher; seed?: AdminHubLiveState | null } = {}): void {
  removeListeners?.();
  removeListeners = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  snapshot = { state: null, revision: 0, pending: false };
  stateJson = '';
  booted = false;
  fetcher = options.fetcher ?? defaultFetcher;
  dirty = false;
  lastReason = null;
  markSeq = 0;
  requestSeq = 0;
  appliedSeq = 0;
  inFlight = null;
  appOpen = false;
  hiddenAt = null;
  listeners.clear();
  if (options.seed) {
    boot();
    setState(options.seed);
  }
}
