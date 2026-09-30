/**
 * @vitest-environment jsdom
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ACTION_BLOCKED_MESSAGE } from '@/lib/admin/demoConfig';
import { BLACKLINE_HERO_SHOWCASE_DAY } from '@/lib/admin/heroShowcase';

const HERO_URL = '/demo/admin?embed=hero&section=bookings_dashboard';
const nativeFetch = vi.fn(async () => new Response('{}', { status: 200 }));
let activity: typeof import('./heroShowcaseFetch');

beforeAll(async () => {
  window.history.replaceState({}, '', HERO_URL);
  vi.stubGlobal('fetch', nativeFetch);
  window.fetch = nativeFetch as typeof window.fetch;
  await import('./adminAuth');
  activity = await import('./heroShowcaseFetch');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  nativeFetch.mockClear();
  window.history.replaceState({}, '', HERO_URL);
});

describe('hero showcase fetch adapter', () => {
  it('serves admin data from local fixtures at the showcase clock without touching the network', async () => {
    const response = await window.fetch(`/api/admin/bookings?date=${BLACKLINE_HERO_SHOWCASE_DAY}&mode=day`, {
      credentials: 'include',
    });
    const body = (await response.json()) as { bookings: unknown[] };
    expect(response.status).toBe(200);
    expect(body.bookings).toHaveLength(21);
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it('answers the demo session and unknown API paths locally too', async () => {
    const session = await window.fetch('/api/admin-demo/session');
    expect(session.status).toBe(200);
    const unknown = await window.fetch('/api/something-else');
    expect(unknown.status).toBe(404);
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it('keeps demo writes blocked', async () => {
    const response = await window.fetch('/api/admin/bookings/cancel', { method: 'POST', body: '{}' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: DEMO_ACTION_BLOCKED_MESSAGE });
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it('tracks in-flight local requests for the ready signal', async () => {
    const before = activity.getHeroShowcaseRequestActivity();
    const pending = window.fetch('/api/admin/team');
    expect(activity.getHeroShowcaseRequestActivity().pending).toBe(before.pending + 1);
    await pending;
    const after = activity.getHeroShowcaseRequestActivity();
    expect(after.pending).toBe(0);
    expect(after.serial).toBeGreaterThan(before.serial);
  });

  it('leaves cross-origin requests on the network', async () => {
    await window.fetch('https://cdn.example.com/api/thing');
    expect(nativeFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the normal BLACKLINE demo on the network API', async () => {
    window.history.replaceState({}, '', '/demo/admin?section=bookings_dashboard');
    await window.fetch('/api/admin/bookings?mode=day');
    expect(nativeFetch).toHaveBeenCalledTimes(1);
    expect(String((nativeFetch.mock.calls[0] as unknown[])[0])).toContain('/api/demo/admin/bookings');
  });
});
