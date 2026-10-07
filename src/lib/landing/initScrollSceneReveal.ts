/**
 * One-shot scroll reveal for editorial scenes ([data-dist-scene] inside a section).
 * Content is only hidden once the section carries data-dist-enhanced, so it stays visible without JS.
 * Each scene flips data-dist-visible to "true" the first time it enters the viewport; CSS owns the motion.
 */
export const SCENE_REVEAL_OPTIONS: IntersectionObserverInit = {
  threshold: 0.18,
  rootMargin: '0px 0px -10% 0px',
};

export function initScrollSceneReveal(
  section: HTMLElement | null,
  win: Window & typeof globalThis = window,
): () => void {
  if (!section) return () => {};

  const scenes = Array.from(section.querySelectorAll<HTMLElement>('[data-dist-scene]'));
  const reveal = (scene: HTMLElement) => {
    scene.dataset.distVisible = 'true';
  };

  section.dataset.distEnhanced = 'true';

  const prefersReducedMotion =
    typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion || typeof win.IntersectionObserver !== 'function') {
    scenes.forEach(reveal);
    return () => {};
  }

  scenes.forEach((scene) => {
    if (scene.dataset.distVisible !== 'true') scene.dataset.distVisible = 'false';
  });

  const observer = new win.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal(entry.target as HTMLElement);
      observer.unobserve(entry.target);
    }
  }, SCENE_REVEAL_OPTIONS);

  scenes.forEach((scene) => {
    if (scene.dataset.distVisible !== 'true') observer.observe(scene);
  });

  return () => observer.disconnect();
}
