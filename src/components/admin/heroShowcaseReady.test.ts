/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_SHOWCASE_READY_ATTRIBUTE, HERO_SHOWCASE_READY_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';

const activity = { pending: 0, serial: 0 };
const listeners = new Set<() => void>();

vi.mock('./heroShowcaseFetch', () => ({
  getHeroShowcaseRequestActivity: () => ({ ...activity }),
  subscribeHeroShowcaseRequestActivity: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
}));

const { signalHeroShowcaseReadyWhenSettled } = await import('./heroShowcaseReady');

function setActivity(pending: number, serialDelta = 0) {
  activity.pending = pending;
  activity.serial += serialDelta;
  for (const listener of [...listeners]) listener();
}

function createFrameWindow() {
  let resolveFonts!: () => void;
  const fontsReady = new Promise<void>((resolve) => {
    resolveFonts = resolve;
  });
  const frames: FrameRequestCallback[] = [];
  const postMessage = vi.fn();
  const win = {
    document: Object.assign(document, { fonts: { ready: fontsReady } }),
    location: { origin: 'http://localhost:3000' },
    parent: { postMessage },
    innerWidth: 400,
    innerHeight: 300,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
    cancelAnimationFrame: vi.fn(),
  } as unknown as Window;
  const flush = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  };
  const runFrame = async () => {
    frames.splice(0).forEach((callback) => callback(0));
    await flush();
  };
  return { win, postMessage, resolveFonts, runFrame, flush, pendingFrames: () => frames.length };
}

beforeEach(() => {
  activity.pending = 0;
  activity.serial = 0;
  listeners.clear();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute(HERO_SHOWCASE_READY_ATTRIBUTE);
});

describe('signalHeroShowcaseReadyWhenSettled', () => {
  it('posts to the same-origin parent only after fonts, idle data and two frames', async () => {
    const frame = createFrameWindow();
    activity.pending = 1;
    signalHeroShowcaseReadyWhenSettled(frame.win);
    await frame.flush();
    expect(frame.pendingFrames()).toBe(0);

    frame.resolveFonts();
    await frame.flush();
    expect(frame.pendingFrames()).toBe(0);

    setActivity(0, 1);
    await frame.flush();
    await frame.runFrame();
    expect(frame.postMessage).not.toHaveBeenCalled();
    await frame.runFrame();

    expect(frame.postMessage).toHaveBeenCalledTimes(1);
    expect(frame.postMessage).toHaveBeenCalledWith({ type: HERO_SHOWCASE_READY_MESSAGE_TYPE }, 'http://localhost:3000');
    expect(document.documentElement.getAttribute(HERO_SHOWCASE_READY_ATTRIBUTE)).toBe('true');
  });

  it('starts over when a request begins during the two-frame window', async () => {
    const frame = createFrameWindow();
    signalHeroShowcaseReadyWhenSettled(frame.win);
    frame.resolveFonts();
    await frame.flush();
    await frame.runFrame();
    setActivity(1, 1);
    setActivity(0);
    await frame.runFrame();
    expect(frame.postMessage).not.toHaveBeenCalled();

    await frame.runFrame();
    await frame.runFrame();
    expect(frame.postMessage).toHaveBeenCalledTimes(1);
  });

  it('waits while a skeleton is visible in the viewport', async () => {
    const frame = createFrameWindow();
    const skeleton = document.createElement('div');
    skeleton.className = 'admin-mobile-next-strip-list--skeleton';
    skeleton.getBoundingClientRect = () => ({ top: 10, left: 10, bottom: 50, right: 200, width: 190, height: 40 }) as DOMRect;
    document.body.append(skeleton);

    signalHeroShowcaseReadyWhenSettled(frame.win);
    frame.resolveFonts();
    await frame.flush();
    await frame.runFrame();
    await frame.runFrame();
    expect(frame.postMessage).not.toHaveBeenCalled();

    skeleton.remove();
    await frame.runFrame();
    await frame.runFrame();
    expect(frame.postMessage).toHaveBeenCalledTimes(1);
  });

  it('never posts after cleanup', async () => {
    const frame = createFrameWindow();
    const cleanup = signalHeroShowcaseReadyWhenSettled(frame.win);
    frame.resolveFonts();
    await frame.flush();
    await frame.runFrame();
    cleanup();
    await frame.runFrame();
    await frame.runFrame();
    expect(frame.postMessage).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(HERO_SHOWCASE_READY_ATTRIBUTE)).toBe(false);
  });
});
