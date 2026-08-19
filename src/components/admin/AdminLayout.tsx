import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  Sparkles,
  TrendingUp,
  User,
  Users,
  X,
} from '../lucide-react';

import DemoActionLock from './DemoActionLock';
import AdminSidebarLaunchCta from './AdminSidebarLaunchCta';
import AdminSidebarProfile, { type AdminProfileUser } from './AdminSidebarProfile';
import BlacklineConversionCard from './BlacklineConversionCard';
import BlacklineWordmark, { type BlacklineWordmarkSize } from '@/components/demo/BlacklineWordmark';
import { clearAdminSecret } from './adminAuth';
import { authClient } from '@/lib/auth-client';
import { getPublicAdminDemoCapabilities, type PublicAdminDemoTenant } from '@/lib/admin/demoConfig';
import {
  dismissPreviewSubscribeBanner,
  isPreviewSubscribeBannerVisible,
  notePreviewSubscribeBannerSectionChange,
} from '@/lib/admin/previewSubscribeBanner';
import '@/styles/components/admin-demo.css';
import '@/styles/components/admin-profile.css';
import '@/styles/components/admin-sidebar-launch-cta.css';

type AdminLayoutProps = {
  activeSection: AdminSection;
  onChangeSection: (section: AdminSection) => void;
  isTransitioning: boolean;
  isEntering?: boolean;
  showPending?: boolean;
  showSectionSkeleton: boolean;
  isPublicDemo?: boolean;
  demoTenant?: PublicAdminDemoTenant;
  profileUser?: AdminProfileUser | null;
  shopId?: string | null;
  shopLogoUrl?: string | null;
  shopName?: string | null;
  publicActivityPaused?: boolean;
  /** Guest preview construction (not an owner-initiated pause). */
  previewUnderConstruction?: boolean;
  /** Guest preview cookie access (via === 'preview') — profile menu, not bare Logout. */
  isPreviewAccess?: boolean;
  /** When set, sidebar items are filtered by permission keys from session. */
  permissions?: string[] | null;
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
  /** Any of these permissions unlocks the nav item; omit = always visible when authenticated. */
  anyOf?: string[];
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
      { section: 'bookings_dashboard', label: 'Bookings', icon: <Calendar {...ICON} />, anyOf: ['bookings.manage', 'bookings.self'] },
      { section: 'bookings_blocks', label: 'Team', icon: <Users {...ICON} />, anyOf: ['catalog.manage', 'members.manage', 'members.invite_barber', 'team.read'] },
      { section: 'bookings_reports', label: 'Reports', icon: <BarChart2 {...ICON} />, anyOf: ['reports.view'] },
      { section: 'bookings_history', label: 'History', icon: <Clock {...ICON} />, anyOf: ['bookings.manage', 'bookings.self'] },
      { section: 'bookings_clients', label: 'Clients', icon: <User {...ICON} />, anyOf: ['clients.read'] },
      { section: 'services', label: 'Services', icon: <Scissors {...ICON} />, anyOf: ['catalog.manage'] },
    ],
  },
  {
    title: 'Shop / Retail',
    items: [
      { section: 'shop_products', label: 'Products', icon: <Package {...ICON} />, anyOf: ['retail.manage'] },
      { section: 'shop_orders', label: 'Orders', icon: <ShoppingBag {...ICON} />, anyOf: ['retail.manage'] },
      { section: 'shop_sales', label: 'Sales', icon: <TrendingUp {...ICON} />, anyOf: ['reports.view', 'retail.manage'] },
    ],
  },
  {
    title: 'Assistant',
    items: [
      { section: 'assistant', label: 'Assistant', icon: <Sparkles {...ICON} />, anyOf: ['ai.use'] },
    ],
  },
];

const DEFAULT_SIDEBAR_LOGO = '/images/logo_nobg.png';

function SidebarBrand({
  logoUrl = null,
  shopName = null,
  statusSlot = null,
  onOpenSettings = null,
  blackline = false,
  wordmarkSize = 'default',
  showPlatformAttribution = false,
}: {
  logoUrl?: string | null;
  shopName?: string | null;
  statusSlot?: React.ReactNode;
  onOpenSettings?: (() => void) | null;
  blackline?: boolean;
  wordmarkSize?: BlacklineWordmarkSize;
  showPlatformAttribution?: boolean;
}) {
  const [src, setSrc] = useState(logoUrl || DEFAULT_SIDEBAR_LOGO);
  const isCustom = Boolean(logoUrl) && src === logoUrl;
  const brandLabel = shopName?.trim() || 'Admin';

  useEffect(() => {
    setSrc(logoUrl || DEFAULT_SIDEBAR_LOGO);
  }, [logoUrl]);

  const inner = blackline ? (
    <>
      <BlacklineWordmark size={wordmarkSize} />
      {showPlatformAttribution || statusSlot ? (
        <div className="admin-sidebar-brand-text">
          {statusSlot}
          {showPlatformAttribution ? (
            <span className="admin-sidebar-brand-powered">Powered by KERSIVO</span>
          ) : null}
        </div>
      ) : null}
    </>
  ) : (
    <>
      <div
        className={`admin-sidebar-monogram${isCustom ? ' admin-sidebar-monogram--custom' : ''}`}
        aria-hidden="true"
      >
        <img
          className="admin-sidebar-logo-img"
          src={src}
          alt=""
          width={60}
          height={60}
          decoding="async"
          onError={() => setSrc(DEFAULT_SIDEBAR_LOGO)}
        />
      </div>
      <div className="admin-sidebar-brand-text">
        {statusSlot}
        <span className="admin-sidebar-brand-name">{brandLabel}</span>
      </div>
    </>
  );

  const brandClassName = `admin-sidebar-brand${blackline ? ' admin-sidebar-brand--blackline' : ''}`;

  if (onOpenSettings) {
    return (
      <button
        type="button"
        className={`${brandClassName} admin-sidebar-brand--button`}
        onClick={onOpenSettings}
        aria-label={`Open barbershop settings for ${brandLabel}`}
      >
        {inner}
      </button>
    );
  }

  return <div className={brandClassName}>{inner}</div>;
}

function SidebarStatus({
  className = '',
  paused = false,
  underConstruction = false,
}: {
  className?: string;
  paused?: boolean;
  underConstruction?: boolean;
}) {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const label = underConstruction ? 'Building' : paused ? 'Paused' : 'Online';
  const showDotAlert = paused || underConstruction;
  return (
    <div className={`admin-sidebar-status ${className}`.trim()} aria-label="System status">
      <span className="admin-sidebar-status-date">{dateStr}</span>
      <span
        className={`admin-sidebar-status-dot${showDotAlert ? ' admin-sidebar-status-dot--paused' : ''}`}
        aria-hidden="true"
      />
      <span className="admin-sidebar-status-label">{label}</span>
    </div>
  );
}

export default function AdminLayout({
  activeSection,
  onChangeSection,
  isTransitioning,
  isEntering = false,
  showPending = false,
  showSectionSkeleton,
  isPublicDemo = false,
  demoTenant = 'generic',
  profileUser = null,
  shopId = null,
  shopLogoUrl = null,
  shopName = null,
  publicActivityPaused = false,
  previewUnderConstruction = false,
  isPreviewAccess = false,
  permissions = null,
  persistentAdminChrome,
  children,
}: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileTopExtension, setMobileTopExtension] = useState<React.ReactNode | null>(null);
  const [showPreviewSubscribeBanner, setShowPreviewSubscribeBanner] = useState(() =>
    typeof window === 'undefined' ? true : isPreviewSubscribeBannerVisible(),
  );
  const mainContentRef = useRef<HTMLElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastPublishedHeaderInsetPxRef = useRef<number | null>(null);
  const prevActiveSectionRef = useRef(activeSection);
  const [mobileChromeMounted, setMobileChromeMounted] = useState(false);
  const isBlacklineDemo = demoTenant === 'blackline';
  const demoCapabilities = getPublicAdminDemoCapabilities(demoTenant);
  const brandShopName = isBlacklineDemo ? shopName : isPublicDemo ? null : shopName;

  const canOpenBarbershopSettings =
    !isPublicDemo && Boolean(!permissions || permissions.includes('shop.settings'));

  const openBarbershopSettings = useCallback(() => {
    onChangeSection('barbershop_settings');
    setIsMobileMenuOpen(false);
  }, [onChangeSection]);

  const visibleMenuGroups = useMemo(() => {
    if (!permissions) return menuGroups;
    const allowed = new Set(permissions);
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.anyOf || item.anyOf.some((p) => allowed.has(p)),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [permissions]);

  useLayoutEffect(() => {
    setMobileChromeMounted(true);
  }, []);

  /*
   * iOS Safari: fixed overlays/drawers need a measured visual viewport height.
   * Only sync on resize/orientation — never on visualViewport scroll. Writing CSS
   * height vars during scroll fights rubber-band inertia (spring jump on all tabs).
   */
  useLayoutEffect(() => {
    if (!mobileChromeMounted) return undefined;

    const root = document.documentElement;
    const mq = window.matchMedia('(max-width: 48rem)');
    let rafId = 0;
    let settleTimeoutId = 0;
    let lastPublishedHeightPx: number | null = null;
    const HEIGHT_JITTER_PX = 2;

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
       * Overlay/drawer coverage only (not document min-height):
       * prefer the larger of innerHeight and visualViewport height.
       * Skip offsetTop — it jitter during rubber-band and is unnecessary for resize-only sync.
       */
      const fromVv = vv ? vv.height : 0;
      const h = Math.ceil(Math.max(window.innerHeight, fromVv));
      if (
        lastPublishedHeightPx !== null &&
        Math.abs(lastPublishedHeightPx - h) <= HEIGHT_JITTER_PX
      ) {
        return;
      }
      lastPublishedHeightPx = h;
      const hPx = `${h}px`;
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
    mq.addEventListener('change', scheduleVisualViewportSync);
    window.addEventListener('resize', scheduleVisualViewportSync);
    window.addEventListener('orientationchange', scheduleVisualViewportSync);

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      if (settleTimeoutId !== 0) window.clearTimeout(settleTimeoutId);
      clearVvVars();
      vv?.removeEventListener('resize', scheduleVisualViewportSync);
      mq.removeEventListener('change', scheduleVisualViewportSync);
      window.removeEventListener('resize', scheduleVisualViewportSync);
      window.removeEventListener('orientationchange', scheduleVisualViewportSync);
    };
  }, [mobileChromeMounted]);

  const onSelectSection = (section: AdminSection) => {
    setIsMobileMenuOpen(false);
    onChangeSection(section);
  };

  useEffect(() => {
    const panel = mainContentRef.current;
    if (!panel) return;
    panel.scrollTop = 0;
  }, [activeSection]);

  const handleLogout = async () => {
    if (isPublicDemo) {
      window.location.assign('/');
      return;
    }
    clearAdminSecret();
    try {
      await authClient.signOut();
    } catch {
      // ignore
    }
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    window.location.assign('/');
  };

  const canManageBilling =
    isPublicDemo || !permissions || permissions.includes('billing.manage');

  const previewProfileUser: AdminProfileUser = {
    name: shopName?.trim() || 'My Barbershop',
    email: null,
    image: null,
  };

  const accountFooter = isPublicDemo ? (
    <AdminSidebarProfile
      mode="guest"
      variant="desktop"
      suppressAuthLock={isBlacklineDemo}
      conversionAccountMenu={demoCapabilities.conversionAccountMenu}
      createShopHref={demoCapabilities.createShopHref}
      previewWebsiteHref={demoCapabilities.previewWebsiteHref}
      kersivoHomeHref={demoCapabilities.kersivoHomeHref}
      user={isBlacklineDemo ? { name: shopName, email: null, image: null } : null}
    />
  ) : isPreviewAccess ? (
    <AdminSidebarProfile
      mode="preview"
      user={previewProfileUser}
      variant="desktop"
      permissions={permissions}
      shopId={shopId}
      onOpenBarbershopSettings={canOpenBarbershopSettings ? openBarbershopSettings : undefined}
    />
  ) : profileUser ? (
    <AdminSidebarProfile
      user={profileUser}
      variant="desktop"
      permissions={permissions}
      shopId={shopId}
      onOpenBarbershopSettings={canOpenBarbershopSettings ? openBarbershopSettings : undefined}
    />
  ) : (
    <button
      type="button"
      className="btn btn--ghost admin-sidebar-logout"
      onClick={() => void handleLogout()}
    >
      <LogOut width={15} height={15} aria-hidden="true" />
      Logout
    </button>
  );

  const accountFooterMobile = isPublicDemo ? (
    <AdminSidebarProfile
      mode="guest"
      variant="mobile"
      suppressAuthLock={isBlacklineDemo}
      conversionAccountMenu={demoCapabilities.conversionAccountMenu}
      createShopHref={demoCapabilities.createShopHref}
      previewWebsiteHref={demoCapabilities.previewWebsiteHref}
      kersivoHomeHref={demoCapabilities.kersivoHomeHref}
      user={isBlacklineDemo ? { name: shopName, email: null, image: null } : null}
    />
  ) : isPreviewAccess ? (
    <AdminSidebarProfile
      mode="preview"
      user={previewProfileUser}
      variant="mobile"
      permissions={permissions}
      shopId={shopId}
      onOpenBarbershopSettings={canOpenBarbershopSettings ? openBarbershopSettings : undefined}
    />
  ) : profileUser ? (
    <AdminSidebarProfile
      user={profileUser}
      variant="mobile"
      permissions={permissions}
      shopId={shopId}
      onOpenBarbershopSettings={canOpenBarbershopSettings ? openBarbershopSettings : undefined}
    />
  ) : (
    <button
      type="button"
      className="btn btn--ghost admin-mobile-logout"
      onClick={() => void handleLogout()}
    >
      <LogOut width={15} height={15} aria-hidden="true" />
      Logout
    </button>
  );

  const renderMenu = (showLaunchCta: boolean) => (
    <nav className="admin-sidebar-nav" aria-label="Admin navigation">
      {visibleMenuGroups.map((group) => (
        <div className="admin-sidebar-group" key={group.title}>
          <p className="admin-sidebar-group-title">{group.title}</p>
          {group.items.map((item) => (
            <button
              key={item.section}
              type="button"
              className={`admin-sidebar-link ${activeSection === item.section ? 'admin-sidebar-link--active' : ''}`}
              aria-current={activeSection === item.section ? 'page' : undefined}
              onClick={() => onSelectSection(item.section)}
            >
              <span className="admin-sidebar-link-icon">{item.icon}</span>
              <span className="admin-sidebar-link-label">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
      {isBlacklineDemo && showLaunchCta ? (
        <div className="admin-sidebar-group">
          <BlacklineConversionCard />
        </div>
      ) : showLaunchCta && canManageBilling ? (
        <div className="admin-sidebar-group">
          <AdminSidebarLaunchCta isPublicDemo={isPublicDemo} onSpaSection={onChangeSection} />
        </div>
      ) : null}
    </nav>
  );

  const activeSectionLabel = useMemo(() => {
    if (activeSection === 'barbershop_settings') return 'Barbershop settings';
    if (activeSection === 'site_launch') return 'Site launch';
    for (const group of visibleMenuGroups) {
      const item = group.items.find((i) => i.section === activeSection);
      if (item) return item.label;
    }
    return '';
  }, [activeSection, visibleMenuGroups]);

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
      const chromeEl = mainEl.querySelector<HTMLElement>('.admin-mobile-top-chrome');
      if (!chromeEl) {
        lastPublishedHeaderInsetPxRef.current = null;
        mainEl.style.removeProperty('--admin-mobile-measured-header-bottom');
        document.documentElement.style.removeProperty('--admin-mobile-measured-header-bottom');
        return;
      }
      /* Fixed top chrome: spacer height == banner + header (+ next strip); height is stabler than rect.bottom during vv jitter. */
      const insetPx = Math.ceil(chromeEl.getBoundingClientRect().height);
      const previous = lastPublishedHeaderInsetPxRef.current;
      if (previous !== null && Math.abs(previous - insetPx) < 2) {
        return;
      }
      if (previous === insetPx) {
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

      const chromeEl = mainEl.querySelector<HTMLElement>('.admin-mobile-top-chrome');
      if (!chromeEl) {
        lastPublishedHeaderInsetPxRef.current = null;
        mainEl.style.removeProperty('--admin-mobile-measured-header-bottom');
        document.documentElement.style.removeProperty('--admin-mobile-measured-header-bottom');
        return;
      }

      publish();
      ro = new ResizeObserver(schedulePublish);
      ro.observe(chromeEl);
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
  }, [mobileTopExtension, activeSectionLabel, previewUnderConstruction, publicActivityPaused, showPreviewSubscribeBanner]);

  useEffect(() => {
    if (!previewUnderConstruction) return;
    if (prevActiveSectionRef.current === activeSection) return;
    prevActiveSectionRef.current = activeSection;
    setShowPreviewSubscribeBanner(notePreviewSubscribeBannerSectionChange());
  }, [activeSection, previewUnderConstruction]);

  const handleDismissPreviewSubscribeBanner = useCallback(() => {
    dismissPreviewSubscribeBanner();
    setShowPreviewSubscribeBanner(false);
  }, []);

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
            <SidebarBrand
              logoUrl={isPublicDemo ? null : shopLogoUrl}
              shopName={brandShopName}
              blackline={isBlacklineDemo}
              wordmarkSize="compact"
              showPlatformAttribution={isBlacklineDemo}
              statusSlot={
                <SidebarStatus
                  className="admin-sidebar-status--mobile-drawer"
                  paused={publicActivityPaused && !previewUnderConstruction}
                  underConstruction={previewUnderConstruction}
                />
              }
              onOpenSettings={canOpenBarbershopSettings ? openBarbershopSettings : null}
            />
            <button
              type="button"
              className="admin-mobile-close-button"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close admin menu"
            >
              <X width={20} height={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="admin-mobile-drawer-launch">
          {isBlacklineDemo ? (
            <BlacklineConversionCard />
          ) : canManageBilling ? (
            <AdminSidebarLaunchCta isPublicDemo={isPublicDemo} onSpaSection={onChangeSection} />
          ) : null}
        </div>
        {renderMenu(false)}
        <div className="admin-sidebar-divider" aria-hidden="true" />
        {accountFooterMobile}
      </aside>
    </>
  );

  return (
    <AdminMobileTopExtensionContext.Provider value={setMobileTopExtension}>
      <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <SidebarBrand
          logoUrl={isPublicDemo ? null : shopLogoUrl}
          shopName={brandShopName}
          blackline={isBlacklineDemo}
          wordmarkSize="default"
          showPlatformAttribution={isBlacklineDemo}
          onOpenSettings={canOpenBarbershopSettings ? openBarbershopSettings : null}
        />
        {renderMenu(true)}
        <div className="admin-sidebar-logout-wrap">
          <SidebarStatus
            paused={publicActivityPaused && !previewUnderConstruction}
            underConstruction={previewUnderConstruction}
          />
          <div className="admin-sidebar-divider" aria-hidden="true" />
          {accountFooter}
        </div>
      </aside>

      <section
        ref={mainContentRef}
        className="admin-main-content admin-mobile-edge"
        aria-busy={isTransitioning || showPending || undefined}
        data-transitioning={showPending || isEntering ? 'true' : undefined}
      >
        <div
          className="admin-route-pending"
          hidden={!showPending}
          data-active={showPending ? '' : undefined}
          aria-hidden="true"
        />
        <div className="admin-mobile-top-chrome">
          {previewUnderConstruction && showPreviewSubscribeBanner ? (
            <div className="admin-barbershop-paused-banner" role="status">
              <div className="admin-barbershop-paused-banner__body">
                <span className="admin-barbershop-paused-banner__desktop-copy">
                  This is how your dashboard will look. Subscribe and we&apos;ll build your website
                  around it.{' '}
                </span>
                <span className="admin-barbershop-paused-banner__mobile-copy">
                  Preview of your dashboard.{' '}
                </span>
                <a className="admin-barbershop-paused-banner__link" href="/admin/launch">
                  Get started — £39/month
                </a>
              </div>
              <button
                type="button"
                className="admin-barbershop-paused-banner__dismiss"
                aria-label="Dismiss"
                onClick={handleDismissPreviewSubscribeBanner}
              >
                <X width={16} height={16} aria-hidden="true" />
              </button>
            </div>
          ) : publicActivityPaused && !previewUnderConstruction ? (
            <div className="admin-barbershop-paused-banner" role="status">
              <div className="admin-barbershop-paused-banner__body">
                Barbershop is paused — public bookings and retail checkout are off.{' '}
                {canOpenBarbershopSettings ? (
                  <button type="button" className="admin-barbershop-paused-banner__link" onClick={openBarbershopSettings}>
                    Manage in Barbershop settings
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <header
            className={`admin-mobile-header${mobileTopExtension ? ' admin-mobile-header--with-next' : ''}`}
            aria-label="Admin mobile header"
          >
            <div className="admin-mobile-header-bar">
              <SidebarBrand
                logoUrl={isPublicDemo ? null : shopLogoUrl}
                shopName={brandShopName}
                blackline={isBlacklineDemo}
                wordmarkSize="compact"
                onOpenSettings={canOpenBarbershopSettings ? openBarbershopSettings : null}
              />
              <div className="admin-mobile-header-center">
                {activeSectionLabel && (
                  <span className="admin-mobile-section-name" aria-current="page">
                    {activeSectionLabel}
                  </span>
                )}
                <SidebarStatus
                  className="admin-sidebar-status--mobile-header"
                  paused={publicActivityPaused && !previewUnderConstruction}
                  underConstruction={previewUnderConstruction}
                />
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
        </div>
        <div className="admin-mobile-header-spacer" aria-hidden="true" />
        {isPublicDemo ? <DemoActionLock variant={isBlacklineDemo ? 'blackline' : 'generic'} /> : null}
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
          <div className="admin-main-panel" data-entering={isEntering ? 'true' : undefined}>
            {children}
          </div>
        )}
      </section>

      {mobileChromeMounted ? createPortal(mobileMenuLayer, document.body) : null}
      </div>
    </AdminMobileTopExtensionContext.Provider>
  );
}
