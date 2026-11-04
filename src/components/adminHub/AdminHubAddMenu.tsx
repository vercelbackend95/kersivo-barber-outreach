import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  ChevronDown,
  Clock,
  ImagePlus,
  NotebookPen,
  Package,
  Paperclip,
  Plus,
  Scissors,
  StickyNote,
  Store,
  Users,
} from '@/components/lucide-react';
import {
  ADMIN_HUB_ADD,
  ADMIN_HUB_ADD_MENU,
} from '@/lib/adminHub/copy';
import {
  overviewAddMenu,
  parseAdminHubAddItem,
  type AdminHubAddItemId,
  type HubAddMenuGroup,
  type HubAddMenuItem,
} from '@/lib/adminHub/addMenu';
import { adminHubAppHref } from '@/lib/adminHub/apps';
import type { HubCapabilities, HubStage } from '@/lib/freePreview/hubStage';
import AdminMobileFab from '@/components/admin/AdminMobileFab';
import { ADMIN_MOBILE_CHROME_MAX_PX } from '@/components/admin/useAdminMobileNextAppointmentsChrome';
import { useClientPortalTarget } from '@/lib/adminHub/hubOverlay';
import { AdminHubSheet } from './AdminHubSheet';

const INLINE_SHEET_MQ = '(max-width: 640px)';
const HEADER_SHEET_MQ = `(max-width: ${ADMIN_MOBILE_CHROME_MAX_PX}px)`;

const ICONS: Record<AdminHubAddItemId, typeof Camera> = {
  business: Store,
  hours: Clock,
  photos: Camera,
  logo: ImagePlus,
  text: NotebookPen,
  'price-list': StickyNote,
  other: Paperclip,
  team: Users,
  service: Scissors,
  product: Package,
};

const PANEL_GAP = 8;
const VIEWPORT_MARGIN = 12;
const PANEL_MAX_HEIGHT = 640;

/**
 * Fixed position for the portaled desktop panel: below the trigger, right edges aligned; flips above when there is
 * more room there than below and the panel does not fit below. Clamped to a 12 px viewport margin; max-height is the
 * available space (the panel scrolls inside). Returns whether the trigger is still (partly) in view.
 */
function placePanel(panel: HTMLElement, trigger: HTMLElement): boolean {
  const t = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;

  const width = panel.offsetWidth;
  const left = Math.min(Math.max(t.right - width, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - width));
  const cap = Math.min(vh * 0.8, PANEL_MAX_HEIGHT);
  // scrollHeight has no borders; max-height is border-box.
  const natural = Math.min(panel.scrollHeight + panel.offsetHeight - panel.clientHeight, cap);
  const below = vh - VIEWPORT_MARGIN - (t.bottom + PANEL_GAP);
  const above = t.top - PANEL_GAP - VIEWPORT_MARGIN;
  const flip = below < natural && above > below;
  const maxHeight = Math.max(0, Math.min(cap, flip ? above : below));
  const top = flip
    ? Math.max(VIEWPORT_MARGIN, t.top - PANEL_GAP - Math.min(natural, maxHeight))
    : Math.max(VIEWPORT_MARGIN, t.bottom + PANEL_GAP);

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.maxHeight = `${Math.floor(maxHeight)}px`;
  panel.dataset.placement = flip ? 'top' : 'bottom';
  return t.bottom > 0 && t.top < vh && t.right > 0 && t.left < vw;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type AddMenuVariant = 'header' | 'inline' | 'icon';

function sheetQuery(variant: AddMenuVariant, showMobileFab?: boolean) {
  return variant === 'header' && showMobileFab ? HEADER_SHEET_MQ : INLINE_SHEET_MQ;
}

function isSheetViewport(variant: AddMenuVariant, showMobileFab?: boolean): boolean {
  return typeof window !== 'undefined' && window.matchMedia(sheetQuery(variant, showMobileFab)).matches;
}

function trackHubEvent(name: 'hub_add_menu_open' | 'hub_add_menu_item', item?: AdminHubAddItemId) {
  void fetch('/api/admin-hub/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item ? { name, item } : { name }),
    keepalive: true,
  }).catch(() => {});
}

function flatten(groups: HubAddMenuGroup[]): HubAddMenuItem[] {
  return groups.flatMap((group) => group.items);
}

export function AdminHubAddMenu(props: {
  stage: HubStage;
  capabilities: HubCapabilities;
  canAddShop?: boolean;
  tone?: 'primary' | 'outline';
  variant?: 'header' | 'inline' | 'icon';
  label?: string;
  testId?: string;
  /** Overview header only — one contextual mobile FAB for the existing Add menu. */
  showMobileFab?: boolean;
}) {
  const menu = useMemo(
    () =>
      overviewAddMenu({
        canUpload: props.capabilities.canUpload,
        canEditDetails: props.capabilities.canEditDetails,
        canAddShop: props.canAddShop ?? false,
      }),
    [props.capabilities.canUpload, props.capabilities.canEditDetails, props.canAddShop],
  );
  const tone = props.tone ?? (props.stage === 'requested' || props.stage === 'designing' ? 'primary' : 'outline');
  const variant = props.variant ?? 'header';
  const label = props.label ?? ADMIN_HUB_ADD;
  const menuId = useId();
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const fabTriggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [open, setOpen] = useState(false);
  const showMobileFab = Boolean(props.showMobileFab);
  const [sheet, setSheet] = useState(() => isSheetViewport(variant, showMobileFab));
  const [activeIndex, setActiveIndex] = useState(0);
  const portalTarget = useClientPortalTarget();
  const items = flatten(menu.groups);

  useEffect(() => {
    const mq = window.matchMedia(sheetQuery(variant, showMobileFab));
    const sync = () => setSheet(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [variant, showMobileFab]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      queueMicrotask(() => {
        const useFab = showMobileFab && isSheetViewport(variant, showMobileFab);
        (useFab ? fabTriggerRef.current : desktopTriggerRef.current)?.focus();
      });
    }
  }, [variant, showMobileFab]);

  const openMenu = useCallback(() => {
    if (menu.empty) return;
    setActiveIndex(0);
    setOpen(true);
    trackHubEvent('hub_add_menu_open');
  }, [menu.empty]);

  useEffect(() => {
    if (!open || sheet) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        desktopTriggerRef.current?.contains(target) ||
        fabTriggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', onPointer), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, sheet, close]);

  // Desktop panel is portaled to body (never under tile photos / logo, never clipped by overflow: hidden).
  useLayoutEffect(() => {
    if (!open || sheet || !portalTarget) return;
    const panel = panelRef.current;
    const trigger = desktopTriggerRef.current;
    if (!panel || !trigger) return;
    let frame = 0;
    let scrolled = false;
    const update = () => {
      frame = 0;
      const inView = placePanel(panel, trigger);
      // Only a scroll closes it: the trigger left the viewport, so the menu would float detached.
      if (inView || !scrolled) return;
      const hadFocus = panel.contains(document.activeElement);
      setOpen(false);
      if (hadFocus) trigger.focus({ preventScroll: true });
    };
    update();
    const schedule = (event: Event) => {
      if (event.type === 'scroll') {
        // Scrolling inside the panel itself does not move the trigger.
        if (event.target instanceof Node && panel.contains(event.target)) return;
        scrolled = true;
      }
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    // The tile's hover lift (transform transition) moves the trigger after the first placement.
    document.addEventListener('transitionend', schedule, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
      document.removeEventListener('transitionend', schedule, true);
    };
  }, [open, sheet, portalTarget]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const node = itemRefs.current[activeIndex];
    if (prefersReducedMotion()) node?.focus();
    else queueMicrotask(() => node?.focus());
  }, [open, activeIndex]);

  if (menu.empty) {
    if (variant === 'header') return null;
    if (variant === 'icon') {
      return (
        <a
          className="admin-hub-add-fab"
          href={adminHubAppHref('materials')}
          aria-label={label}
          data-testid={props.testId ?? 'admin-hub-add-inline'}
        >
          <Plus aria-hidden />
        </a>
      );
    }
    return (
      <a className="btn btn--ghost btn--sm admin-hub-add-menu__fallback" href={adminHubAppHref('materials')}>
        {label}
      </a>
    );
  }

  const move = (next: number) => {
    const count = items.length;
    if (!count) return;
    const index = ((next % count) + count) % count;
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(items.length - 1);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) openMenu();
      else move(0);
    }
  };

  const onItemClick = (item: HubAddMenuItem) => {
    const parsed = parseAdminHubAddItem(item.id);
    if (parsed) trackHubEvent('hub_add_menu_item', parsed);
    // Close after the click bubbles so AppHost's document listener still sees the <a href>
    // (panel and sheet are portaled to document.body; delegation is on document, not .admin-shell).
    queueMicrotask(() => close(false));
  };

  const list = (
    <div
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label={ADMIN_HUB_ADD_MENU}
      className={sheet ? 'admin-hub-add-menu__sheet-list' : 'admin-hub-add-menu__panel'}
      data-testid="admin-hub-add-menu"
      onKeyDown={onMenuKeyDown}
    >
      {menu.groups.map((group) => (
        <div key={group.id} role="group" aria-label={group.heading} className="admin-hub-add-menu__group">
          <p className="admin-hub-add-menu__heading">{group.heading}</p>
          {group.items.map((item) => {
            const index = items.indexOf(item);
            const Icon = ICONS[item.id];
            return (
              <a
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role="menuitem"
                href={item.href}
                className="admin-hub-add-menu__item"
                tabIndex={activeIndex === index ? 0 : -1}
                data-add-item={item.id}
                {...(item.inPlace ? { 'data-admin-hub-item': item.id } : {})}
                onClick={() => onItemClick(item)}
              >
                <span className="admin-hub-add-menu__icon" aria-hidden="true">
                  <Icon width={16} height={16} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="admin-hub-add-menu__title">{item.title}</span>
                  <span className="admin-hub-add-menu__hint">{item.hint}</span>
                </span>
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );

  const triggerClass =
    variant === 'icon'
      ? 'admin-hub-add-fab'
      : variant === 'inline'
        ? 'btn btn--ghost btn--sm admin-hub-add-menu__inline'
        : `btn btn--sm admin-add-btn admin-add-btn--desktop${tone === 'outline' ? ' btn--outline' : ' btn--primary'}`;

  const toggleMenu = () => (open ? close() : openMenu());
  const compactTestId = props.testId ?? 'admin-hub-add-inline';

  return (
    <div
      className={`admin-hub-add-menu${variant === 'inline' ? ' admin-hub-add-menu--inline' : ''}${
        variant === 'icon' ? ' admin-hub-add-menu--icon' : ''
      }`}
    >
      <button
        ref={desktopTriggerRef}
        type="button"
        className={triggerClass}
        aria-label={variant === 'icon' ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={props.testId ?? (variant === 'header' ? 'admin-hub-add' : compactTestId)}
        onClick={toggleMenu}
        onKeyDown={onTriggerKeyDown}
      >
        {variant === 'inline' ? null : <Plus aria-hidden />}
        {variant === 'icon' ? null : <span>{label}</span>}
        {variant === 'header' ? (
          <ChevronDown
            aria-hidden
            width={14}
            height={14}
            strokeWidth={2}
            className={`admin-hub-add-menu__chevron${open ? ' is-open' : ''}`}
          />
        ) : null}
      </button>
      {props.showMobileFab ? (
        <AdminMobileFab
          ref={fabTriggerRef}
          label={ADMIN_HUB_ADD_MENU}
          onClick={toggleMenu}
          onKeyDown={onTriggerKeyDown}
          context="overview"
          expanded={open}
          controls={menuId}
          haspopup="menu"
        />
      ) : null}
      {open && !sheet && portalTarget ? createPortal(list, portalTarget) : null}
      {open && sheet ? (
        <AdminHubSheet
          title={ADMIN_HUB_ADD}
          onClose={() => close()}
          icon={Plus}
          testId="admin-hub-add-sheet"
        >
          {list}
        </AdminHubSheet>
      ) : null}
    </div>
  );
}
