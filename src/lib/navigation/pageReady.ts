/**
 * Runs `init` once per rendered page. Astro bundles a component's <script> and executes it only once
 * per visit, so with ClientRouter it must also re-run for each client-side navigation. Keyed on the
 * <body> element (replaced on every swap), so the first load's direct call and its astro:page-load
 * cannot bind twice. The optional returned cleanup runs before the next swap.
 */
export function onPageReady(init: () => void | (() => void)): void {
  let lastBody: HTMLElement | null = null;
  let cleanup: void | (() => void);

  const run = () => {
    if (document.body === lastBody) return;
    lastBody = document.body;
    cleanup = init();
  };

  run();
  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', () => {
    if (cleanup) cleanup();
    cleanup = undefined;
  });
}
