// KERSIVO live-demo bar: keeps the fixed Heritage nav just below the bar until the bar scrolls away.
// Loaded as a classic script straight after the bar, so the nav is placed before the first paint.
(() => {
  const bar = document.querySelector('[data-kersivo-bar]');
  if (bar) {
    const root = document.documentElement;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const offset = Math.max(0, bar.offsetHeight - window.scrollY);
      root.style.setProperty('--kd-offset', `${offset}px`);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(sync); };
    // The bar's own height, for layout that must fit under it (the hero, see css/style.css).
    const syncHeight = () => root.style.setProperty('--kd-h', `${bar.offsetHeight}px`);
    syncHeight();
    window.addEventListener('resize', syncHeight);
    sync();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
  }
})();
