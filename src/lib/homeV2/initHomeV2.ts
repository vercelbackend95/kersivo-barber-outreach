import { createCompare } from '@/lib/homeV2/compare';
import { initHomeV2Motion } from '@/lib/homeV2/motion';
import { createTabs } from '@/lib/homeV2/tabs';
import { createWipe } from '@/lib/homeV2/wipe';

/** Binds every homepage interaction and returns one cleanup for astro:before-swap. */
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

  return () => {
    for (const fn of cleanups.splice(0)) fn();
  };
}
