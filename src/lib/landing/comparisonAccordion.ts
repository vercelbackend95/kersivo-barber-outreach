/**
 * Shared click/tap accordion for the competitor comparison sections.
 * The first category is server-rendered open; nothing opens or closes on scroll,
 * so passive scrolling never shifts the layout.
 */
export function setComparisonItemOpen(item: HTMLElement, open: boolean): void {
  const trigger = item.querySelector<HTMLButtonElement>('[data-comparison-trigger]');
  const reveal = item.querySelector<HTMLElement>('[data-comparison-reveal]');
  const revealInner = item.querySelector<HTMLElement>('[data-comparison-reveal-inner]');

  item.dataset.open = open ? 'true' : 'false';
  trigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
  reveal?.setAttribute('aria-hidden', open ? 'false' : 'true');

  if (open) revealInner?.removeAttribute('inert');
  else revealInner?.setAttribute('inert', '');
}

export function bindComparisonAccordions(rootSelector: string): void {
  document.querySelectorAll<HTMLElement>(rootSelector).forEach((root) => {
    if (root.dataset.accordionBound === 'true') return;
    root.dataset.accordionBound = 'true';

    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-comparison-item]'));

    items.forEach((item) => {
      item.querySelector<HTMLButtonElement>('[data-comparison-trigger]')?.addEventListener('click', () => {
        const shouldOpen = item.dataset.open !== 'true';
        items.forEach((other) => setComparisonItemOpen(other, shouldOpen && other === item));
      });
    });
  });
}
