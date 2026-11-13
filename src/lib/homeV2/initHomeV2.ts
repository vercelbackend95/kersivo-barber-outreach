import { createCompare } from '@/lib/homeV2/compare';
import { initHomeV2Motion } from '@/lib/homeV2/motion';
import { createScene } from '@/lib/homeV2/scene';
import { createTabs } from '@/lib/homeV2/tabs';
import { createWipe } from '@/lib/homeV2/wipe';

const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/** Binds every /home-v2 interaction and returns one cleanup for astro:before-swap. */
export function initHomeV2(root: Document): () => void {
  const cleanups: Array<() => void> = [];
  const add = (cleanup: (() => void) | null | undefined) => {
    if (cleanup) cleanups.push(cleanup);
  };

  const stage = root.querySelector<HTMLElement>('[data-hv2-wipe]');
  const wipe = stage ? createWipe(stage) : null;
  if (wipe) cleanups.push(wipe.destroy);

  const tabs = root.querySelector<HTMLElement>('[data-hv2-tabs]');
  if (tabs) add(createTabs(tabs));

  const compare = root.querySelector<HTMLElement>('[data-hv2-compare]');
  if (compare) add(createCompare(compare));

  add(initHomeV2Motion(root, wipe));

  // The WebGL backdrop is decoration: skipped for reduced motion and Save-Data.
  const sceneHost = root.querySelector<HTMLElement>('[data-hv2-scene]');
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (sceneHost && !saveData && window.matchMedia(MOTION_OK).matches) add(createScene(sceneHost));

  return () => {
    for (const fn of cleanups.splice(0)) fn();
  };
}
