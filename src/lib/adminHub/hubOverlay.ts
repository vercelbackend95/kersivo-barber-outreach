import { useEffect, useState } from 'react';

let lockCount = 0;
let saved: {
  htmlOverflow: string;
  bodyOverflow: string;
  bodyOverscroll: string;
  scrollY: number;
} | null = null;

/** Lock `html` + `body` overflow without losing the current scroll position. Nested-safe. */
export function lockAdminHubScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const { body, documentElement } = document;
  if (lockCount === 0) {
    saved = {
      htmlOverflow: documentElement.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      scrollY: window.scrollY,
    };
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'contain';
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0 || !saved) return;
    documentElement.style.overflow = saved.htmlOverflow;
    body.style.overflow = saved.bodyOverflow;
    body.style.overscrollBehavior = saved.bodyOverscroll;
    const top = saved.scrollY;
    saved = null;
    documentElement.scrollTop = top;
    body.scrollTop = top;
    if (typeof window.scrollTo === 'function' && !/jsdom/i.test(navigator.userAgent)) {
      window.scrollTo({ top, left: 0, behavior: 'auto' });
    }
  };
}

export function useAdminHubScrollLock(locked = true): void {
  useEffect(() => {
    if (!locked) return undefined;
    return lockAdminHubScroll();
  }, [locked]);
}

/** `document.body` after mount so SSR / first hydrate can render `null` without a mismatch. */
export function useClientPortalTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.body);
  }, []);
  return target;
}
