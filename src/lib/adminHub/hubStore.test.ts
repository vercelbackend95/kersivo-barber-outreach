/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetHubStoreForTests,
  flushHubDirty,
  getHubSnapshot,
  getHubState,
  HUB_HIDDEN_REFRESH_MS,
  HUB_REFRESH_DEBOUNCE_MS,
  isHubDirty,
  markHubDirty,
  refreshHubState,
  setHubAppOpen,
} from './hubStore';
import { ADMIN_HUB_STATE_SCRIPT_ID, ADMIN_HUB_STATE_URL, emitHubDataChanged, type AdminHubLiveState } from './liveState';

function liveState(about: string | null = null): AdminHubLiveState {
  return {
    assets: [],
    details: { brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: about },
    currentLogo: null,
  };
}

function ok(state: AdminHubLiveState) {
  return new Response(JSON.stringify({ ok: true, state }), { status: 200 });
}

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  __resetHubStoreForTests();
});
afterEach(() => {
  __resetHubStoreForTests();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('hubStore', () => {
  it('seeds once from the SSR JSON block', () => {
    document.body.innerHTML = `<script type="application/json" id="${ADMIN_HUB_STATE_SCRIPT_ID}">${JSON.stringify(liveState('Hello'))}</script>`;
    expect(getHubState()?.details.aboutText).toBe('Hello');
    expect(getHubSnapshot().revision).toBe(0);
  });

  it('dedupes concurrent refreshes into one request', async () => {
    const fetcher = vi.fn(async () => ok(liveState('A')));
    __resetHubStoreForTests({ fetcher, seed: liveState() });
    const a = refreshHubState();
    const b = refreshHubState();
    expect(a).toBe(b);
    await a;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(ADMIN_HUB_STATE_URL);
    expect(getHubState()?.details.aboutText).toBe('A');
    expect(getHubSnapshot().revision).toBe(1);
  });

  it('ignores an older response that arrives after a newer one', async () => {
    const first = deferred();
    const second = deferred();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    __resetHubStoreForTests({ fetcher, seed: liveState() });
    const p1 = refreshHubState();
    markHubDirty('details-saved');
    const p2 = refreshHubState();
    expect(fetcher).toHaveBeenCalledTimes(2);
    second.resolve(ok(liveState('new')));
    await p2;
    first.resolve(ok(liveState('old')));
    await p1;
    expect(getHubState()?.details.aboutText).toBe('new');
    expect(isHubDirty()).toBe(false);
  });

  it('keeps the last good state when a refresh fails', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 500 }));
    __resetHubStoreForTests({ fetcher, seed: liveState('kept') });
    markHubDirty('asset-added');
    await refreshHubState();
    expect(getHubState()?.details.aboutText).toBe('kept');
    expect(isHubDirty()).toBe(true);
    expect(getHubSnapshot().pending).toBe(false);
  });

  it('does not bump the revision when nothing changed', async () => {
    const fetcher = vi.fn(async () => ok(liveState('same')));
    __resetHubStoreForTests({ fetcher, seed: liveState('same') });
    const before = getHubState();
    await refreshHubState();
    expect(getHubSnapshot().revision).toBe(0);
    expect(getHubState()).toBe(before);
  });

  it('defers data-changed while an app is open and refreshes once on close', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => ok(liveState('fresh')));
    __resetHubStoreForTests({ fetcher, seed: liveState() });
    setHubAppOpen(true);
    emitHubDataChanged('asset-added');
    emitHubDataChanged('details-saved');
    await vi.advanceTimersByTimeAsync(HUB_REFRESH_DEBOUNCE_MS * 2);
    expect(fetcher).not.toHaveBeenCalled();
    expect(isHubDirty()).toBe(true);
    const closing = flushHubDirty();
    setHubAppOpen(false);
    // Back navigation (popstate) flushes too: still one request.
    const again = flushHubDirty();
    expect(again).toBe(closing);
    await closing;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getHubState()?.details.aboutText).toBe('fresh');
  });

  it('does nothing on close when nothing changed', () => {
    const fetcher = vi.fn(async () => ok(liveState()));
    __resetHubStoreForTests({ fetcher, seed: liveState() });
    expect(flushHubDirty()).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('debounces data-changed (150 ms) when no app is open', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => ok(liveState('x')));
    __resetHubStoreForTests({ fetcher, seed: liveState() });
    emitHubDataChanged('asset-reordered');
    emitHubDataChanged('asset-reordered');
    expect(getHubSnapshot().pending).toBe(true);
    await vi.advanceTimersByTimeAsync(HUB_REFRESH_DEBOUNCE_MS - 10);
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refreshes after the tab was hidden for more than 30 s, and on bfcache restore', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => ok(liveState()));
    __resetHubStoreForTests({ fetcher, seed: liveState() });
    const setVisibility = (value: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(5_000);
    setVisibility('visible');
    expect(fetcher).not.toHaveBeenCalled();
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(HUB_HIDDEN_REFRESH_MS + 1);
    setVisibility('visible');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();

    const show = new Event('pageshow');
    Object.defineProperty(show, 'persisted', { value: true });
    window.dispatchEvent(show);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
