import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import {
  Camera,
  Clock,
  Globe,
  ImagePlus,
  ListChecks,
  MessageCircle,
  NotebookPen,
  Palette,
  Scissors,
  Store,
  Ticket,
  TrendingUp,
  Users,
  X,
} from '@/components/lucide-react';
import {
  adminHubAppMeta,
  parseAdminHubApp,
  resolveAdminHubApp,
  type AdminHubAppId,
} from '@/lib/adminHub/apps';
import { ADMIN_HUB_APP_CLOSE } from '@/lib/adminHub/copy';
import { loadAdminHubApp } from './apps/loadApp';
import { AppStatus } from './apps/AppStatus';
import { AppChromeProvider, emptyAppChrome, type AdminHubAppChrome } from './apps/AppChrome';
import type { AdminHubAppBodyProps, AdminHubAppContext } from './apps/types';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ICONS: Record<AdminHubAppId, typeof Store> = {
  logo: ImagePlus,
  photos: Camera,
  services: Scissors,
  team: Users,
  hours: Clock,
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
  return parseAdminHubApp(new URLSearchParams(window.location.search).get('app'));
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
  const [app, setApp] = useState<AdminHubAppId | null>(props.initialApp);
  const [sheet, setSheet] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [Body, setBody] = useState<ComponentType<AdminHubAppBodyProps> | null>(null);
  const [chrome, setChrome] = useState<AdminHubAppChrome>(emptyAppChrome);
  const loader = props.loadApp ?? loadAdminHubApp;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setSheet(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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

  const close = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('app');
    history.replaceState({ adminHubApp: null }, '', url);
    withTransition(() => setApp(null));
    queueMicrotask(() => openerRef.current?.focus());
  }, []);

  const open = useCallback((id: AdminHubAppId, opener: HTMLElement | null, push: boolean) => {
    openerRef.current = opener;
    if (push) {
      const url = new URL(window.location.href);
      url.searchParams.set('app', id);
      history.pushState({ adminHubApp: id }, '', url);
      pushedRef.current = true;
    }
    withTransition(() => setApp(id));
  }, []);

  useEffect(() => {
    const onPop = () => {
      const next = appFromLocation();
      setApp(next);
      pushedRef.current = false;
      if (!next) queueMicrotask(() => openerRef.current?.focus());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const root = document.querySelector('.admin-hub');
    if (!root) return;
    const onClick = (event: Event) => {
      const mouse = event as MouseEvent;
      if (mouse.defaultPrevented || mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) {
        return;
      }
      const link = (mouse.target as HTMLElement | null)?.closest?.('a');
      if (!link || !root.contains(link)) return;
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname !== '/admin') return;
      const id = parseAdminHubApp(url.searchParams.get('app'));
      if (!id) return;
      mouse.preventDefault();
      if (id === app) return;
      open(id, link, true);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [app, open]);

  useEffect(() => {
    if (!app) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const toFocus = closeRef.current;
    toFocus?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [app]);

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

  if (!app) return null;
  const meta = adminHubAppMeta(app);
  const Icon = ICONS[resolveAdminHubApp(app)];

  return (
    <div className="admin-hub-app-root">
      <div className="admin-hub-app__scrim" aria-hidden="true" onClick={close} />
      <div
        ref={dialogRef}
        className={`admin-hub-app${sheet ? ' admin-hub-app--sheet' : ' admin-hub-app--window'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="admin-hub-app"
        data-app={app}
        tabIndex={-1}
        style={sheet ? undefined : { maxWidth: meta.maxWidth }}
        onKeyDown={onKeyDown}
      >
        {sheet ? <span className="admin-hub-app__grab" aria-hidden="true" /> : null}
        <header className="admin-hub-app__bar">
          <span className="admin-hub-app__icon" aria-hidden="true">
            <Icon width={16} height={16} strokeWidth={1.8} />
          </span>
          <div>
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
          ) : Body ? (
            <AppChromeProvider setChrome={setChrome}>
              <Body ctx={props.ctx} />
            </AppChromeProvider>
          ) : (
            <AppStatus state="loading" />
          )}
        </div>
        {chrome.footer ? <div className="admin-hub-app__foot">{chrome.footer}</div> : null}
      </div>
    </div>
  );
}
