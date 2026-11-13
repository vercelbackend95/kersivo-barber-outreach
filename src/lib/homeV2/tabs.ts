/**
 * Turns the stacked demo views into an ARIA tablist (automatic activation, roving tabindex).
 * Without this script every panel stays visible in order.
 */
export function createTabs(section: HTMLElement): (() => void) | null {
  const list = section.querySelector<HTMLElement>('[data-hv2-tablist]');
  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-hv2-tab]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-hv2-panel]'));
  const rail = section.querySelector<HTMLElement>('[data-hv2-tab-rail]');
  if (!list || tabs.length === 0 || tabs.length !== panels.length) return null;

  list.hidden = false;
  section.classList.add('is-tabbed');

  const placeRail = (tab: HTMLElement) => {
    if (!rail) return;
    rail.style.width = `${tab.offsetWidth}px`;
    rail.style.setProperty('--rail-x', `${tab.offsetLeft}px`);
  };

  const select = (index: number, focus: boolean) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
    placeRail(tabs[index]);
    if (focus) tabs[index].focus();
  };

  const onClick = (event: MouseEvent) => {
    const index = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    if (index >= 0) select(index, false);
  };

  const onKeydown = (event: KeyboardEvent) => {
    const current = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight' ? (current === last ? 0 : current + 1)
      : event.key === 'ArrowLeft' ? (current === 0 ? last : current - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : -1;
    if (next < 0) return;
    event.preventDefault();
    select(next, true);
  };

  const onResize = () => {
    const active = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    if (active) placeRail(active);
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', onClick);
    tab.addEventListener('keydown', onKeydown);
  });
  window.addEventListener('resize', onResize);
  select(0, false);

  return () => {
    tabs.forEach((tab) => {
      tab.removeEventListener('click', onClick);
      tab.removeEventListener('keydown', onKeydown);
    });
    window.removeEventListener('resize', onResize);
  };
}
