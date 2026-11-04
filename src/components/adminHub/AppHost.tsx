import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Globe,
  ImagePlus,
  ListChecks,
  MessageCircle,
  NotebookPen,
  Palette,
  Store,
  Ticket,
  TrendingUp,
  X,
} from '@/components/lucide-react';
import {
  adminHubAppMeta,
  adminHubAppOpenTarget,
  parseAdminHubApp,
  resolveAdminHubApp,
  type AdminHubAppId,
} from '@/lib/adminHub/apps';
import { ADMIN_HUB_LOCATION_EVENT, parseAdminHubAddWebsiteItem } from '@/lib/adminHub/addMenu';
import {
  ADMIN_HUB_APP_CLOSE,
  ADMIN_HUB_LEAVE_BODY,
  ADMIN_HUB_LEAVE_DISCARD,
  ADMIN_HUB_LEAVE_KEEP,
  ADMIN_HUB_LEAVE_TITLE,
} from '@/lib/adminHub/copy';
import { useAdminHubScrollLock, useClientPortalTarget, useHubOverlayMode } from '@/lib/adminHub/hubOverlay';
import { flushHubDirty, setHubAppOpen, useHubSnapshot } from '@/lib/adminHub/hubStore';
import { mergeLiveStateIntoAppCtx } from '@/lib/adminHub/liveState';
import { navigateAppPath } from '@/lib/navigation/clientNavigate';
import { useHubToast } from '@/lib/adminHub/hubToast';
import { loadAdminHubApp } from './apps/loadApp';
import { AppStatus } from './apps/AppStatus';
import { AppChromeProvider, emptyAppChrome, type AdminHubAppChrome } from './apps/AppChrome';
import { AdminHubConfirmDialog } from './AdminHubConfirmDialog';
import type { AdminHubAppBodyProps, AdminHubAppContext } from './apps/types';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ICONS: Record<AdminHubAppId, typeof Store> = {
  logo: ImagePlus,
  photos: Camera,
  materials: ImagePlus,
  about: NotebookPen,
  messages: MessageCircle,
  activity: TrendingUp,
  colours: Palette,
  setup: ListChecks,
  business: Store,
  domain: Globe,
  payments: Ticket,
  approve: ListChecks,
};

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Menu items unmount when the Add menu closes — restore to the still-mounted trigger. */
function stableOpener(opener: HTMLElement | null): HTMLElement | null {
  if (!opener) return null;
  const menu = opener.closest('[role="menu"]');
  const menuId = menu?.id;
  if (menuId) {
    const trigger = [...document.querySelectorAll<HTMLElement>('[aria-controls]')].find(
      (el) => el.getAttribute('aria-controls') === menuId,
    );
    if (trigger) return trigger;
  }
  return opener;
}

function isShownTrigger(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function restoreOpenerFocus(opener: HTMLElement | null) {
  if (opener?.isConnected && isShownTrigger(opener)) {
    opener.focus();
    return;
  }
  const selector =
    '[data-testid="admin-mobile-fab"], [data-testid="admin-hub-add"], [data-testid="admin-hub-add-inline"]';
  const visible = [...document.querySelectorAll<HTMLElement>(selector)].find(isShownTrigger);
  visible?.focus();
}

function withTransition(update: () => void): void {
  const start = document.startViewTransition?.bind(document);
  if (start && !prefersReducedMotion()) {
    try {
      start(update);
      return;
    } catch {
      /* unsupported or skipped */
    }
  }
  update();
}

function appFromLocation(): AdminHubAppId | null {
  const raw = parseAdminHubApp(new URLSearchParams(window.location.search).get('app'));
  return raw ? adminHubAppOpenTarget(raw).id : null;
}

export function AppHost(props: {
  initialApp: AdminHubAppId | null;
  ctx: AdminHubAppContext;
  loadApp?: (id: AdminHubAppId) => Promise<{ default: ComponentType<AdminHubAppBodyProps> }>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false);
  // Unsaved edits in the open app (useAppLeaveGuard): leaving asks first.
  const guardRef = useRef(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const setLeaveGuard = useCallback((active: boolean) => {
    guardRef.current = active;
  }, []);
  /** Runs `action` now, or after the owner confirms "Discard changes" when the app has unsaved edits. */
  const guarded = useCallback((action: () => void) => {
    if (!guardRef.current) {
      action();
      return;
    }
    pendingLeaveRef.current = action;
    setLeaveOpen(true);
  }, []);
  const appRef = useRef<AdminHubAppId | null>(null);
  const hrefRef = useRef<string>('');
  const [app, setApp] = useState<AdminHubAppId | null>(
    props.initialApp ? adminHubAppOpenTarget(props.initialApp).id : null,
  );
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [Body, setBody] = useState<ComponentType<AdminHubAppBodyProps> | null>(null);
  const [chrome, setChrome] = useState<AdminHubAppChrome>(emptyAppChrome);
  const loader = props.loadApp ?? loadAdminHubApp;
  const portalTarget = useClientPortalTarget();
  useAdminHubScrollLock(Boolean(app && portalTarget));
  const hub = useHubSnapshot();
  const toast = useHubToast();
  // Each open gets the latest hub data once (waiting for a refresh already under way); an open app is never re-fed.
  const ctxRef = useRef<{ app: AdminHubAppId; ctx: AdminHubAppContext } | null>(null);
  if (!app) ctxRef.current = null;
  else if (ctxRef.current?.app !== app && !hub.pending) {
    ctxRef.current = { app, ctx: mergeLiveStateIntoAppCtx(props.ctx, hub.state) };
  }
  const appCtx = app && ctxRef.current?.app === app ? ctxRef.current.ctx : null;
  appRef.current = app;

  useEffect(() => {
    setHubAppOpen(Boolean(app));
  }, [app]);

  useEffect(() => () => setHubAppOpen(false), []);

  const mode = useHubOverlayMode((app ? adminHubAppMeta(app).sheetBelow : undefined) ?? 1024);
  const sheet = mode !== 'window';

  useEffect(() => {
    if (!app) {
      setBody(null);
      setLoadError(false);
      setChrome(emptyAppChrome);
      return;
    }
    let cancelled = false;
    setBody(null);
    setLoadError(false);
    void loader(app)
      .then((mod) => {
        if (!cancelled) setBody(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [app, loader, retry]);

  const writeLocation = useCallback((id: AdminHubAppId | null, item: string | null, push: boolean) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('app', id);
    else url.searchParams.delete('app');
    if (id && item) url.searchParams.set('item', item);
    else url.searchParams.delete('item');
    const state = { adminHubApp: id, adminHubItem: item };
    hrefRef.current = url.href;
    if (push) {
      history.pushState(state, '', url);
      pushedRef.current = true;
    } else {
      history.replaceState(state, '', url);
    }
    window.dispatchEvent(new Event(ADMIN_HUB_LOCATION_EVENT));
  }, []);

  const closeNow = useCallback(() => {
    // Something changed while the app was open: refresh the Overview once (no-op otherwise).
    void flushHubDirty();
    const usedHistory = pushedRef.current;
    pushedRef.current = false;
    if (usedHistory) history.back();
    else writeLocation(null, null, false);
    withTransition(() => setApp(null));
    queueMicrotask(() => restoreOpenerFocus(openerRef.current));
  }, [writeLocation]);

  const close = useCallback(() => guarded(closeNow), [closeNow, guarded]);

  const open = useCallback(
    (id: AdminHubAppId, opener: HTMLElement | null, push: boolean, item: string | null = null) => {
      const target = adminHubAppOpenTarget(id);
      const nextItem = item ?? target.item;
      if (target.id === app) {
        openerRef.current = stableOpener(opener);
        writeLocation(target.id, nextItem, false);
        return;
      }
      if (app && guardRef.current) {
        guarded(() => open(id, opener, push, item));
        return;
      }
      openerRef.current = stableOpener(opener);
      // Switching apps: start the refresh first so the next app waits for fresh data.
      void flushHubDirty();
      writeLocation(target.id, nextItem, push);
      withTransition(() => setApp(target.id));
    },
    [app, guarded, writeLocation],
  );

  // Astro's ClientRouter turns same-origin link clicks (the sidebar, in-page ?app= links) and Back/Forward into
  // soft navigations that swap the page, dropping the app and its edits without a beforeunload prompt. While the
  // guard is on, such a navigation never loads: a link asks here and continues on "Discard changes"; Back/Forward
  // is asked by the popstate handler below (which puts the app URL back) and goes back again on Discard.
  useEffect(() => {
    const onBeforePreparation = (event: Event) => {
      const prep = event as Event & { navigationType?: string; loader?: () => Promise<void>; to?: URL };
      if (!guardRef.current) return;
      prep.loader = () => new Promise<void>(() => undefined);
      const to = prep.to?.href;
      if (prep.navigationType !== 'traverse' && to) guarded(() => void navigateAppPath(to));
    };
    document.addEventListener('astro:before-preparation', onBeforePreparation);
    return () => document.removeEventListener('astro:before-preparation', onBeforePreparation);
  }, [guarded]);

  useEffect(() => {
    hrefRef.current = window.location.href;
    const onPop = () => {
      const next = appFromLocation();
      if (guardRef.current && next !== appRef.current) {
        // Back / Forward with unsaved edits: put the app's URL back and ask; Discard goes back again.
        history.pushState(history.state, '', hrefRef.current);
        pushedRef.current = true;
        guarded(() => history.back());
        return;
      }
      hrefRef.current = window.location.href;
      void flushHubDirty();
      setApp(next);
      pushedRef.current = false;
      if (!next) queueMicrotask(() => restoreOpenerFocus(openerRef.current));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [guarded]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = parseAdminHubApp(params.get('app'));
    if (raw === 'about') {
      writeLocation('materials', 'text', false);
    }
  }, [writeLocation]);

  useEffect(() => {
    const onClick = (event: Event) => {
      const mouse = event as MouseEvent;
      if (mouse.defaultPrevented || mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) {
        return;
      }
      const target = mouse.target as HTMLElement | null;
      const button = target?.closest?.('button[data-admin-hub-app]') as HTMLElement | null;
      if (button) {
        const id = parseAdminHubApp(button.getAttribute('data-admin-hub-app'));
        if (!id) return;
        mouse.preventDefault();
        const item = parseAdminHubAddWebsiteItem(button.getAttribute('data-admin-hub-item'));
        open(id, button, true, item);
        return;
      }
      const itemHost = target?.closest?.('[data-admin-hub-item], [data-admin-hub-app]') as HTMLElement | null;
      const link = (itemHost?.closest?.('a') ?? target?.closest?.('a')) as HTMLAnchorElement | null;
      if (!link) return;
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin')) return;
      const id = parseAdminHubApp(url.searchParams.get('app')) ?? parseAdminHubApp(link.getAttribute('data-admin-hub-app'));
      if (!id) return;
      mouse.preventDefault();
      const item =
        parseAdminHubAddWebsiteItem(url.searchParams.get('item')) ??
        parseAdminHubAddWebsiteItem(link.getAttribute('data-admin-hub-item'));
      open(id, link, true, item);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [app, open]);

  useEffect(() => {
    if (!app || !portalTarget) return;
    closeRef.current?.focus();
  }, [app, portalTarget]);

  useEffect(() => {
    if (!app) return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [app, close]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const list = focusables(dialogRef.current);
    if (!list.length) {
      event.preventDefault();
      return;
    }
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const keepEditing = () => {
    pendingLeaveRef.current = null;
    setLeaveOpen(false);
  };
  const discardAndLeave = () => {
    const action = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    guardRef.current = false;
    setLeaveOpen(false);
    // After the dialog has gone (it hands focus back first), so the leave restores focus as usual.
    if (action) window.setTimeout(action, 0);
  };

  if (!portalTarget) return null;
  // Stays mounted while apps open and close, so a toast raised on close (e.g. "Draft saved") is announced.
  const toastRegion = (
    <div className="admin-hub-toast" role="status" aria-live="polite" data-testid="admin-hub-toast">
      {toast}
    </div>
  );
  if (!app) return createPortal(<>{toastRegion}{null}</>, portalTarget);
  const meta = adminHubAppMeta(app);
  const Icon = ICONS[resolveAdminHubApp(app)];
  const fullscreen = mode === 'fullscreen';

  return createPortal(
    <>
    {toastRegion}
    <div className="admin-hub-app-root">
      <div className="admin-hub-app__scrim" aria-hidden="true" onClick={close} />
      <div
        ref={dialogRef}
        className={`admin-hub-app${sheet ? ' admin-hub-app--sheet' : ' admin-hub-app--window'}${fullscreen ? ' admin-hub-app--fullscreen' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="admin-hub-app"
        data-app={app}
        tabIndex={-1}
        style={sheet ? undefined : { maxWidth: meta.maxWidth }}
        onKeyDown={onKeyDown}
      >
        {sheet && !fullscreen ? <span className="admin-hub-app__grab" aria-hidden="true" /> : null}
        <header className="admin-hub-app__bar">
          <span className="admin-hub-app__icon" aria-hidden="true">
            <Icon width={16} height={16} strokeWidth={1.8} />
          </span>
          <div className="admin-hub-app__heading">
            <h2 className="admin-hub-app__title" id={titleId}>
              {meta.title}
            </h2>
            <p className="admin-hub-app__crumb">{meta.crumb}</p>
          </div>
          {chrome.headerAction ? <div className="admin-hub-app__action">{chrome.headerAction}</div> : null}
          <button
            ref={closeRef}
            type="button"
            className="admin-hub-app__close"
            aria-label={ADMIN_HUB_APP_CLOSE}
            onClick={close}
          >
            <X width={18} height={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>
        <div className="admin-hub-app__body">
          {loadError ? (
            <AppStatus state="error" onRetry={() => setRetry((n) => n + 1)} />
          ) : Body && appCtx ? (
            <AppChromeProvider setChrome={setChrome} setLeaveGuard={setLeaveGuard}>
              <Body ctx={appCtx} />
            </AppChromeProvider>
          ) : (
            <AppStatus state="loading" />
          )}
        </div>
        {chrome.footer ? <div className="admin-hub-app__foot">{chrome.footer}</div> : null}
      </div>
    </div>
    {leaveOpen ? (
      <AdminHubConfirmDialog
        title={ADMIN_HUB_LEAVE_TITLE}
        body={ADMIN_HUB_LEAVE_BODY}
        primaryLabel={ADMIN_HUB_LEAVE_DISCARD}
        secondaryLabel={ADMIN_HUB_LEAVE_KEEP}
        initialFocus="secondary"
        onConfirm={discardAndLeave}
        onClose={keepEditing}
        testId="admin-hub-leave-confirm"
      />
    ) : null}
    </>,
    portalTarget,
  );
}
