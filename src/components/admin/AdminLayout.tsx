import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminSection } from './AdminPanel';
import { SkeletonKPICards, SkeletonTableRows } from '../skeleton';
import {
  BarChart2,
  Calendar,
  Clock,
  LogOut,
  Menu,
  Package,
  Scissors,
  ShoppingBag,
  TrendingUp,
  User,
  Users,
  X,
} from '../lucide-react';

type AdminLayoutProps = {
  activeSection: AdminSection;
  onChangeSection: (section: AdminSection) => void;
  isTransitioning: boolean;
  showSectionSkeleton: boolean;
  /** Always mounted (hidden); keeps effects alive while section skeleton replaces `children`. */
  persistentAdminChrome?: React.ReactNode;
  children: React.ReactNode;
};

type MobileTopExtensionSetter = (extension: React.ReactNode | null) => void;
const AdminMobileTopExtensionContext = createContext<MobileTopExtensionSetter>(() => {});

export function useAdminMobileTopExtension() {
  return useContext(AdminMobileTopExtensionContext);
}

type SectionItem = {
  section: AdminSection;
  label: string;
  icon: React.ReactElement;
};
type SectionGroup = {
  title: string;
  items: SectionItem[];
};

const ICON = { width: 16, height: 16, 'aria-hidden': true as const };

const menuGroups: SectionGroup[] = [
  {
    title: 'Booking system',
    items: [
      { section: 'bookings_dashboard', label: 'Bookings', icon: <Calendar {...ICON} /> },
      { section: 'bookings_blocks', label: 'Barbers', icon: <Users {...ICON} /> },
      { section: 'bookings_reports', label: 'Reports', icon: <BarChart2 {...ICON} /> },
      { section: 'bookings_history', label: 'History', icon: <Clock {...ICON} /> },
      { section: 'bookings_clients', label: 'Clients', icon: <User {...ICON} /> },
      { section: 'services', label: 'Services', icon: <Scissors {...ICON} /> },
    ],
  },
  {
    title: 'Shop / Retail',
    items: [
      { section: 'shop_products', label: 'Products', icon: <Package {...ICON} /> },
      { section: 'shop_orders', label: 'Orders', icon: <ShoppingBag {...ICON} /> },
      { section: 'shop_sales', label: 'Sales', icon: <TrendingUp {...ICON} /> },
    ],
  },
];

function SidebarBrand() {
  return (
    <div className="admin-sidebar-brand">
      <div className="admin-sidebar-monogram" aria-hidden="true">
        <img
          className="admin-sidebar-logo-img"
          src="/images/logo_nobg.png"
          alt=""
          width={72}
          height={72}
          decoding="async"
        />
      </div>
      <div className="admin-sidebar-brand-text">

        <span className="admin-sidebar-brand-sub">Admin</span>
      </div>
    </div>
  );
}

function SidebarStatus({ className = '' }: { className?: string }) {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return (
    <div className={`admin-sidebar-status ${className}`.trim()} aria-label="System status">
      <span className="admin-sidebar-status-date">{dateStr}</span>
      <span className="admin-sidebar-status-dot" aria-hidden="true" />
      <span className="admin-sidebar-status-label">Online</span>
    </div>
  );
}

export default function AdminLayout({
  activeSection,
  onChangeSection,
  isTransitioning,
  showSectionSkeleton,
  persistentAdminChrome,
  children,
}: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileTopExtension, setMobileTopExtension] = useState<React.ReactNode | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastPublishedHeaderInsetPxRef = useRef<number | null>(null);
  const [mobileChromeMounted, setMobileChromeMounted] = useState(false);

  useLayoutEffect(() => {
    setMobileChromeMounted(true);
  }, []);

  /*
   * iOS Safari: fixed layers use the layout viewport; *dvh* / bottom:0 often end above the visible
   * bottom (URL bar). Publish a pixel height from innerHeight + visualViewport so the menu backdrop
   * reaches the same vertical extent as scrolled admin content under the browser chrome.
   */
  useLayoutEffect(() => {
    if (!mobileChromeMounted) return undefined;

    const root = document.documentElement;
    const mq = window.matchMedia('(max-width: 48rem)');
    let rafId = 0;
    let settleTimeoutId = 0;
    let lastPublishedHeightPx: string | null = null;

    const clearVvVars = () => {
      lastPublishedHeightPx = null;
      root.style.removeProperty('--admin-mobile-vv-top');
      root.style.removeProperty('--admin-mobile-vv-h');
      root.style.removeProperty('--admin-mobile-app-h');
    };

    const syncVisualViewportVars = () => {
      if (!mq.matches) {
        clearVvVars();
        return;
      }
      const vv = window.visualViewport;
      /*
       * Cover the same vertical band as in-flow admin content under iOS Safari:
       * - innerHeight tracks chrome show/hide
       * - vv.height + offsetTop is the visual viewport span inside the layout box (extends past *dvh)
       */
      const fromVv = vv ? vv.offsetTop + vv.height : 0;
      const h = Math.max(window.innerHeight, fromVv);
      const hPx = `${Math.ceil(h)}px`;
      if (lastPublishedHeightPx === hPx) return;
      lastPublishedHeightPx = hPx;
      root.style.setProperty('--admin-mobile-vv-top', '0px');
      root.style.setProperty('--admin-mobile-vv-h', hPx);
      root.style.setProperty('--admin-mobile-app-h', hPx);
    };

    const scheduleVisualViewportSync = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncVisualViewportVars();
      });
    };

    syncVisualViewportVars();
    scheduleVisualViewportSync();
    settleTimeoutId = window.setTimeout(scheduleVisualViewportSync, 250);

    const vv = window.visualViewport;
    vv?.addEventListener('resize', scheduleVisualViewportSync);
    vv?.addEventListener('scroll', scheduleVisualViewportSync, { passive: true });
    mq.addEventListener('change', scheduleVisualViewportSync);
    window.addEventListener('resize', scheduleVisualViewportSync);
    window.addEventListener('orientationchange', scheduleVisualViewportSync);

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      if (settleTimeoutId !== 0) window.clearTimeout(settleTimeoutId);
      clearVvVars();
      vv?.removeEventListener('resize', scheduleVisualViewportSync);
      vv?.removeEventListener('scroll', scheduleVisualViewportSync);
      mq.removeEventListener('change', scheduleVisualViewportSync);
      window.removeEventListener('resize', scheduleVisualViewportSync);
      window.removeEventListener('orientationchange', scheduleVisualViewportSync);
    };
  }, [mobileChromeMounted, activeSection, showSectionSkeleton]);

  const onSelectSection = (section: AdminSection) => {
    onChangeSection(section);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    window.location.assign('/admin');
  };

  const menu = useMemo(() => (
    <nav className="admin-sidebar-nav" aria-label="Admin navigation">
      {menuGroups.map((group) => (
        <div className="admin-sidebar-group" key={group.title}>
          <p className="admin-sidebar-group-title">{group.title}</p>
          {group.items.map((item) => (
            <button
              key={item.section}
              type="button"
              className={`admin-sidebar-link ${activeSection === item.section ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onSelectSection(item.section)}
            >
              <span className="admin-sidebar-link-icon">{item.icon}</span>
              <span className="admin-sidebar-link-label">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  ), [activeSection]);

  const activeSectionLabel = useMemo(() => {
    for (const group of menuGroups) {
      const item = group.items.find((i) => i.section === activeSection);
      if (item) return item.label;
    }
    return '';
  }, [activeSection]);

  const skeletonVariant = useMemo<'kpi' | 'table'>(() => {
    if (activeSection === 'bookings_reports' || activeSection === 'shop_sales') {
      return 'kpi';
    }
    return 'table';
  }, [activeSection]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    const drawerNode = mobileDrawerRef.current;
    const focusable = drawerNode?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusable?.[0];
    const lastFocusable = focusable?.[focusable.length - 1];
    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !focusable || focusable.length === 0) {
        return;
      }


      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      mobileOpenButtonRef.current?.focus();
    };
  }, [isMobileMenuOpen]);

  useLayoutEffect(() => {
    const mainEl = mainContentRef.current;
    if (!mainEl) return undefined;

    const mq = window.matchMedia('(max-width: 48rem)');
    let ro: ResizeObserver | null = null;
    let rafId = 0;

    const clearWindowListeners = () => {
      window.removeEventListener('resize', schedulePublish);
      window.visualViewport?.removeEventListener('resize', schedulePublish);
    };

    const publish = () => {
      if (!mq.matches) {
        lastPublishedHeaderInsetPxRef.current = null;
        mainEl.style.removeProperty('--admin-mobile-measured-header-bottom');
        document.documentElement.style.removeProperty('--admin-mobile-measured-header-bottom');
        return;
      }
      const headerEl = mainEl.querySelector<HTMLElement>('.admin-mobile-header');
      if (!headerEl) {
        lastPublishedHeaderInsetPxRef.current = null;
        mainEl.style.removeProperty('--admin-mobile-measured-header-bottom');
        document.documentElement.style.removeProperty('--admin-mobile-measured-header-bottom');
        return;
      }
      /* Fixed header at top: spacer height == header height; height is stabler than rect.bottom during vv jitter. */
      const insetPx = Math.ceil(headerEl.getBoundingClientRect().height);
      if (lastPublishedHeaderInsetPxRef.current === insetPx) {
        return;
      }
      lastPublishedHeaderInsetPxRef.current = insetPx;
      const insetStr = `${insetPx}px`;
      mainEl.style.setProperty('--admin-mobile-measured-header-bottom', insetStr);
      /* Portals (e.g. Shop product sheet → document.body) must read the same inset as main column. */
      document.documentElement.style.setProperty('--admin-mobile-measured-header-bottom', insetStr);
    };

    const schedulePublish = () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        publish();
      });
    };

    const attach = () => {
      ro?.disconnect();
      ro = null;
      clearWindowListeners();

      if (!mq.matches) {
        lastPublishedHeaderInsetPxRef.current = null;
        mainEl.style.removeProperty('--admin-mobile-measured-header-bottom');
        document.documentElement.style.removeProperty('--admin-mobile-measured-header-bottom');
        return;
      }

      const headerEl = mainEl.querySelector<HTMLElement>('.admin-mobile-header');
      if (!headerEl) {
        lastPublishedHeaderInsetPxRef.current = null;
        mainEl.style.removeProperty('--admin-mobile-measured-header-bottom');
        document.documentElement.style.removeProperty('--admin-mobile-measured-header-bottom');
        return;
      }

      publish();
      ro = new ResizeObserver(schedulePublish);
      ro.observe(headerEl);
      window.addEventListener('resize', schedulePublish);
      window.visualViewport?.addEventListener('resize', schedulePublish);
    };

    attach();
    mq.addEventListener('change', attach);

    return () => {
      mq.removeEventListener('change', attach);
      ro?.disconnect();
      clearWindowListeners();
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      lastPublishedHeaderInsetPxRef.current = null;
      mainEl.style.removeProperty('--admin-mobile-measured-header-bottom');
      document.documentElement.style.removeProperty('--admin-mobile-measured-header-bottom');
    };
  }, [mobileTopExtension, activeSectionLabel]);

  const mobileMenuLayer = (
    <>
      <div
        className={`admin-mobile-overlay ${isMobileMenuOpen ? 'admin-mobile-overlay--open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden={!isMobileMenuOpen}
      />
      <aside
        id="admin-mobile-drawer"
        ref={mobileDrawerRef}
        className={`admin-mobile-drawer ${isMobileMenuOpen ? 'admin-mobile-drawer--open' : ''}`}
        aria-label="Admin menu drawer"
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="admin-mobile-drawer-head">
          <div className="admin-mobile-drawer-head-top">
            <SidebarBrand />
            <button
              type="button"
              className="admin-mobile-close-button"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close admin menu"
            >
              <X width={20} height={20} aria-hidden="true" />
            </button>
          </div>
          <SidebarStatus className="admin-sidebar-status--mobile-drawer" />
        </div>
        {menu}
        <div className="admin-sidebar-divider" aria-hidden="true" />
        <button
          type="button"
          className="btn btn--ghost admin-mobile-logout"
          onClick={() => void handleLogout()}
        >
          <LogOut width={15} height={15} aria-hidden="true" />
          Logout
        </button>
      </aside>
    </>
  );

  return (
    <AdminMobileTopExtensionContext.Provider value={setMobileTopExtension}>
      <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <SidebarBrand />
        {menu}
        <div className="admin-sidebar-logout-wrap">
          <SidebarStatus />
          <div className="admin-sidebar-divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--ghost admin-sidebar-logout"
            onClick={() => void handleLogout()}
          >
            <LogOut width={15} height={15} aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <section
        ref={mainContentRef}
        className="admin-main-content admin-mobile-edge"
        aria-busy={isTransitioning}
        data-transitioning={isTransitioning}
      >
        <header
          className={`admin-mobile-header${mobileTopExtension ? ' admin-mobile-header--with-next' : ''}`}
          aria-label="Admin mobile header"
        >
          <div className="admin-mobile-header-bar">
            <SidebarBrand />
            <div className="admin-mobile-header-center">
              {activeSectionLabel && (
                <span className="admin-mobile-section-name" aria-current="page">
                  {activeSectionLabel}
                </span>
              )}
              <SidebarStatus className="admin-sidebar-status--mobile-header" />
            </div>
            <button
              ref={mobileOpenButtonRef}
              type="button"
              className="admin-mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="admin-mobile-drawer"
            >
              <Menu width={20} height={20} aria-hidden="true" />
            </button>
          </div>
          {mobileTopExtension ? (
            <div className="admin-mobile-header-extension" aria-label="Upcoming appointments">
              {mobileTopExtension}
            </div>
          ) : null}
        </header>
        <div className="admin-mobile-header-spacer" aria-hidden="true" />
        {persistentAdminChrome ? (
          <div className="admin-persistent-chrome-host" aria-hidden="true" style={{ display: 'none' }}>
            {persistentAdminChrome}
          </div>
        ) : null}
        {showSectionSkeleton ? (
          <div className="admin-transition-skeleton" aria-hidden="true">
            {skeletonVariant === 'kpi' ? (
              <div className="admin-transition-skeleton-kpi-grid">
                <SkeletonKPICards count={3} />
              </div>
            ) : (
              <div className="admin-transition-skeleton-table-wrap">
                <table className="admin-transition-skeleton-table">
                  <tbody>
                    <SkeletonTableRows count={6} cols={6} />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          children
        )}
      </section>

      {mobileChromeMounted ? createPortal(mobileMenuLayer, document.body) : null}
      </div>
    </AdminMobileTopExtensionContext.Provider>
  );
}
