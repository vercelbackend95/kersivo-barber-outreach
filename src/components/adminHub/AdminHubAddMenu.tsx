import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Camera,
  ChevronDown,
  ImagePlus,
  NotebookPen,
  Package,
  Paperclip,
  Plus,
  Scissors,
  StickyNote,
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
import { AdminHubSheet } from './AdminHubSheet';

const MOBILE_MQ = '(max-width: 640px)';

const ICONS: Record<AdminHubAddItemId, typeof Camera> = {
  photos: Camera,
  logo: ImagePlus,
  text: NotebookPen,
  'team-photos': Users,
  'price-list': StickyNote,
  other: Paperclip,
  team: Users,
  service: Scissors,
  product: Package,
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches;
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
  variant?: 'header' | 'inline';
  label?: string;
  testId?: string;
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(isMobileViewport);
  const [activeIndex, setActiveIndex] = useState(0);
  const items = flatten(menu.groups);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  const openMenu = useCallback(() => {
    if (menu.empty) return;
    setActiveIndex(0);
    setOpen(true);
    trackHubEvent('hub_add_menu_open');
  }, [menu.empty]);

  useEffect(() => {
    if (!open || mobile) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', onPointer), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, mobile, close]);

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
    if (variant !== 'inline') return null;
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
    // Close after the click bubbles so AppHost can still see the in-tree <a href>.
    queueMicrotask(() => close(false));
  };

  const list = (
    <div
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label={ADMIN_HUB_ADD_MENU}
      className={mobile ? 'admin-hub-add-menu__sheet-list' : 'admin-hub-add-menu__panel'}
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
    variant === 'inline'
      ? 'btn btn--ghost btn--sm admin-hub-add-menu__inline'
      : `btn btn--sm admin-add-btn${tone === 'outline' ? ' btn--outline' : ' btn--primary'}`;

  return (
    <div className={`admin-hub-add-menu${variant === 'inline' ? ' admin-hub-add-menu--inline' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={props.testId ?? (variant === 'inline' ? 'admin-hub-add-inline' : 'admin-hub-add')}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        {variant === 'inline' ? null : <Plus aria-hidden />}
        <span>{label}</span>
        {variant === 'inline' ? null : (
          <ChevronDown
            aria-hidden
            width={14}
            height={14}
            strokeWidth={2}
            className={`admin-hub-add-menu__chevron${open ? ' is-open' : ''}`}
          />
        )}
      </button>
      {open && !mobile ? list : null}
      {open && mobile ? (
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
