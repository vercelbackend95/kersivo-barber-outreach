import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminGlobalMobileNextStripHost from './AdminGlobalMobileNextStripHost';
import BookingsAdminPanel from './BookingsAdminPanel';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';
import { AdminTodayBookingsLiveProvider } from './useAdminTodayBookingsLive';
import { AdminClockContext, HERO_SHOWCASE_ADMIN_CLOCK, REAL_ADMIN_CLOCK } from './adminClock';
import { signalHeroShowcaseReadyWhenSettled } from './heroShowcaseReady';
import { resolveAdminSpaSection } from '@/lib/admin/sectionUrl';
import { ADMIN_SESSION_EXPIRED_EVENT } from './adminAuth';
import type { DemoDayBooking } from '@/lib/admin/demoFixtures/daySchedule';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import {
  enablePublicAdminDemo,
  getStoredAdminSecret,
  installAdminFetchInterceptor,
  setPublicAdminDemoMode,
} from './adminAuth';
import type { AdminProfileUser } from './AdminSidebarProfile';
import { getPublicAdminDemoCapabilities, type PublicAdminDemoTenant } from '@/lib/admin/demoConfig';
import { SkeletonKPICards } from '../skeleton';
import { authClient } from '@/lib/auth-client';
import { isGuestPreviewConstructionPause } from '@/lib/preview/guestPreviewConstruction';
import type { SerializedKersivoAccess } from '@/lib/shop/kersivoAccess';
import {
  ADMIN_UPGRADE_QUERY_PARAM,
  lockedFeatureForSection,
  parseFullKersivoFeature,
  resolveAdminProductGate,
  type FullKersivoFeature,
} from '@/lib/admin/productLocks';
import FullKersivoUpgradeDialog, {
  AdminProductLockProvider,
  FullKersivoLockedSection,
} from './FullKersivoUpgradeDialog';

const ServicesAdminPanel = lazy(() => import('./ServicesAdminPanel'));
const ClientsAdminPanel = lazy(() => import('./ClientsAdminPanel'));
const ShopAdminPanel = lazy(() => import('./ShopAdminPanel'));
const AiAssistantPanel = lazy(() => import('./AiAssistantPanel'));
const BarbershopSettingsPanel = lazy(() => import('./BarbershopSettingsPanel'));
const SiteLaunchHubPanel = lazy(() => import('./SiteLaunchHubPanel'));

export type AdminSection =
  | 'bookings_dashboard'
  | 'bookings_blocks'
  | 'bookings_reports'
  | 'bookings_history_tab'
  | 'bookings_clients'
  | 'services'
  | 'shop_products'
  | 'shop_orders'
  | 'shop_sales'
  | 'assistant'
  | 'barbershop_settings'
  | 'site_launch'
  /** Legacy URL alias → bookings_blocks (Team) */
  | 'team';

function clearTransientAdminViewportState() {
  if (typeof document === 'undefined') return;

  const { body, documentElement } = document;
  body.style.overflow = '';
  body.style.overscrollBehavior = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  documentElement.style.overflow = '';
}

function getSectionFromUrl(): AdminSection {
  if (typeof window === 'undefined') return 'bookings_dashboard';
  return resolveAdminSpaSection(new URLSearchParams(window.location.search).get('section'));
}

function PanelChunkFallback() {
  return (
    <div className="admin-transition-skeleton" aria-busy="true">
      <div className="admin-transition-skeleton-kpi-grid">
        <SkeletonKPICards count={3} />
      </div>
    </div>
  );
}

type LazyPanelErrorBoundaryState = {
  hasError: boolean;
};

/** Catches lazy-chunk / render failures outside panel-internal boundaries (avoids blank black admin). */
class LazyPanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  LazyPanelErrorBoundaryState
> {
  state: LazyPanelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyPanelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Admin lazy panel failed to load:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="admin-inline-error" role="alert">
          <p>This section failed to load.</p>
          <button type="button" className="btn btn--secondary" onClick={this.handleRetry}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

type AdminPanelProps = {
  demoMode?: boolean;
  demoTenant?: PublicAdminDemoTenant;
  /** SSR-seeded demo bookings for the dashboard (avoids empty flash after hydration). */
  initialBookings?: DemoDayBooking[];
  /** URL `?section=` from the Astro host so the first paint matches the deep link. */
  initialSection?: string | null;
  /** Fixed-height landing-page embed: render a finite, non-scrolling showcase of long lists. */
  showcaseMode?: boolean;
};

export default function AdminPanel({
  demoMode = false,
  demoTenant = 'generic',
  initialBookings,
  initialSection = null,
  showcaseMode = false,
}: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>(() =>
    resolveAdminSpaSection(
      initialSection ??
        (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('section') : null),
    ),
  );
  const [isEntering, setIsEntering] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [authReady, setAuthReady] = useState(demoMode);
  const [hasAccess, setHasAccess] = useState(() => demoMode || Boolean(getStoredAdminSecret()));
  const [profileUser, setProfileUser] = useState<AdminProfileUser | null>(null);
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(
    demoTenant === 'blackline' ? DEMO_SHOP_NAME : null,
  );
  const [shopId, setShopId] = useState<string | null>(null);
  const [publicActivityPaused, setPublicActivityPaused] = useState(false);
  const [previewUnderConstruction, setPreviewUnderConstruction] = useState(false);
  const [isPreviewAccess, setIsPreviewAccess] = useState(false);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [sessionVia, setSessionVia] = useState<string | null>(null);
  const [productAccess, setProductAccess] = useState<SerializedKersivoAccess | null>(null);
  const [upgradeFeature, setUpgradeFeature] = useState<FullKersivoFeature | null>(null);
  const upgradeParamHandledRef = useRef(false);
  const [demoLoadError, setDemoLoadError] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);
  const pendingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    installAdminFetchInterceptor();

    if (demoMode) {
      enablePublicAdminDemo();
      setAuthReady(true);
      setHasAccess(true);
    } else {
      setPublicAdminDemoMode(false);
      void (async () => {
        let redirectingToOnboarding = false;

        const applySessionPayload = (payload: {
          ok?: boolean;
          onboardingCompleted?: boolean;
          onboardingRequired?: boolean;
          onboardingGate?: string;
          via?: string;
          permissions?: string[];
          productAccess?: SerializedKersivoAccess | null;
          shop?: {
            logoUrl?: string | null;
            name?: string | null;
            publicActivityPaused?: boolean;
            pauseReason?: string | null;
          } | null;
          shopId?: string | null;
          user?: { name?: string | null; email?: string | null; image?: string | null } | null;
        }) => {
          const onboardingRequired =
            payload.onboardingRequired ?? payload.onboardingCompleted === false;
          if (payload.via === 'session' && onboardingRequired) {
            let skipGate = false;
            // The reopen escape hatch never bypasses explicit Free activation.
            if (payload.onboardingGate !== 'free_activation') {
              try {
                skipGate = sessionStorage.getItem('kersivo_skip_onboarding_gate') === '1';
              } catch {
                skipGate = false;
              }
            }
            if (!skipGate) {
              redirectingToOnboarding = true;
              window.location.assign('/admin/onboarding');
              return;
            }
          }
          setHasAccess(true);
          setShopId(typeof payload.shopId === 'string' ? payload.shopId : null);
          setShopLogoUrl(payload.shop?.logoUrl ?? null);
          setShopName(payload.shop?.name?.trim() || null);
          setPublicActivityPaused(Boolean(payload.shop?.publicActivityPaused));
          setIsPreviewAccess(payload.via === 'preview');
          setPreviewUnderConstruction(
            payload.via === 'preview' ||
              isGuestPreviewConstructionPause(payload.shop?.pauseReason),
          );
          setPermissions(payload.permissions ?? null);
          setSessionVia(typeof payload.via === 'string' ? payload.via : null);
          setProductAccess(payload.productAccess ?? null);
          if (payload.user) {
            setProfileUser({
              name: payload.user.name ?? null,
              email: payload.user.email ?? null,
              image: payload.user.image ?? null,
            });
          } else {
            setProfileUser(null);
          }
        };

        try {
          let response = await fetch('/api/admin/session', { credentials: 'include' });
          if (!response.ok) {
            // Signed-in via Better Auth but no ShopMember yet (invite OAuth landed on /admin).
            const baSession = await authClient.getSession().catch(() => null);
            if (baSession?.data?.user) {
              const pending = await fetch('/api/admin/members/accept-pending', {
                method: 'POST',
                credentials: 'include',
              }).catch(() => null);
              if (pending?.ok) {
                response = await fetch('/api/admin/session', { credentials: 'include' });
              }
            }
          }

          if (response.ok) {
            const payload = (await response.json()) as {
              ok?: boolean;
              onboardingCompleted?: boolean;
              onboardingRequired?: boolean;
              onboardingGate?: string;
              via?: string;
              permissions?: string[];
              productAccess?: SerializedKersivoAccess | null;
              shop?: { logoUrl?: string | null; name?: string | null } | null;
              user?: { name?: string | null; email?: string | null; image?: string | null } | null;
            };
            applySessionPayload(payload);
          } else {
            setHasAccess(Boolean(getStoredAdminSecret()));
            setProfileUser(null);
            setShopLogoUrl(null);
            setShopName(null);
            setShopId(null);
            setPermissions(null);
            setSessionVia(null);
            setProductAccess(null);
          }
        } catch {
          setHasAccess(Boolean(getStoredAdminSecret()));
          setProfileUser(null);
          setShopLogoUrl(null);
          setShopName(null);
          setShopId(null);
          setPermissions(null);
          setSessionVia(null);
          setProductAccess(null);
        } finally {
          if (!redirectingToOnboarding) {
            setAuthReady(true);
          }
        }
      })();
    }

    setActiveSection(getSectionFromUrl());
    const handlePopState = () => {
      setActiveSection(getSectionFromUrl());
      setIsEntering(false);
      setShowPending(false);
    };
    const handleSessionExpired = () => {
      setHasAccess(false);
      setProfileUser(null);
      setShopLogoUrl(null);
      setShopName(null);
      setShopId(null);
      setPermissions(null);
      setSessionVia(null);
      setProductAccess(null);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
      if (demoMode) {
        setPublicAdminDemoMode(false);
      }
    };
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode || showcaseMode) return;
    void (async () => {
      try {
        const response = await fetch('/api/admin-demo/session');
        if (!response.ok) setDemoLoadError(true);
      } catch {
        setDemoLoadError(true);
      }
    })();
  }, [demoMode, showcaseMode]);

  useEffect(() => {
    if (!showcaseMode) return undefined;
    return signalHeroShowcaseReadyWhenSettled();
  }, [showcaseMode]);

  const productGate = useMemo(
    () => resolveAdminProductGate({ demoMode, via: sessionVia, productAccess }),
    [demoMode, sessionVia, productAccess],
  );
  const openUpgrade = useCallback((feature: FullKersivoFeature) => setUpgradeFeature(feature), []);
  const closeUpgrade = useCallback(() => setUpgradeFeature(null), []);
  const productLocks = useMemo(() => ({ gate: productGate, openUpgrade }), [productGate, openUpgrade]);
  // Deep links / back-forward into a plan-locked section keep the chrome but never mount the panel.
  const activeLockedFeature = lockedFeatureForSection(productGate, activeSection);

  useEffect(() => {
    if (demoMode || !authReady || upgradeParamHandledRef.current) return;
    upgradeParamHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (!params.has(ADMIN_UPGRADE_QUERY_PARAM)) return;
    const feature = parseFullKersivoFeature(params.get(ADMIN_UPGRADE_QUERY_PARAM));
    params.delete(ADMIN_UPGRADE_QUERY_PARAM);
    const nextSearch = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
    );
    if (feature && productGate) setUpgradeFeature(feature);
  }, [authReady, demoMode, productGate]);

  const handleSectionChange = useCallback((section: AdminSection) => {
    const lockedFeature = lockedFeatureForSection(productGate, section);
    if (lockedFeature) {
      setUpgradeFeature(lockedFeature);
      return;
    }
    if (section === activeSection) return;

    const isBookingsSubviewSwitch =
      (activeSection === 'bookings_dashboard' && section === 'bookings_history_tab') ||
      (activeSection === 'bookings_history_tab' && section === 'bookings_dashboard');

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }

    setActiveSection(section);
    // Landing showcase keeps the application chrome completely static. Only the
    // right-hand content canvas changes; no route-level entrance/pending state.
    setIsEntering(showcaseMode ? false : !isBookingsSubviewSwitch);
    setShowPending(false);
    const params = new URLSearchParams(window.location.search);
    params.set('section', section);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState({ adminSection: section }, '', nextUrl);
    }

    if (showcaseMode || isBookingsSubviewSwitch) return;

    pendingTimeoutRef.current = window.setTimeout(() => {
      setShowPending(true);
      pendingTimeoutRef.current = null;
    }, 250);

    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsEntering(false);
      setShowPending(false);
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      transitionTimeoutRef.current = null;
    }, 180);
  }, [activeSection, productGate, showcaseMode]);

  const shopTab = useMemo(() => {
    if (activeSection === 'shop_orders') return 'orders';
    if (activeSection === 'shop_sales') return 'sales';
    return 'products';
  }, [activeSection]);

  const isBookingsSection =
    activeSection === 'bookings_dashboard'
    || activeSection === 'bookings_blocks'
    || activeSection === 'bookings_reports'
    || activeSection === 'bookings_history_tab';

  useEffect(() => {
    if (showcaseMode) return;
    clearTransientAdminViewportState();
  }, [activeSection, showcaseMode]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, []);

  if (demoMode && demoLoadError) {
    return (
      <div className="admin-login-viewport">
        <div className="auth-gate-card">
          <p className="admin-login-brand-sub" style={{ margin: 0, textAlign: 'center' }}>
            Could not load the demo dashboard. Please refresh or try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!demoMode && authReady && !hasAccess) {
    return (
      <PrivateDemoAuthPanel
        initialMode="signup"
        onSuccess={() => {
          window.location.assign('/admin');
        }}
      />
    );
  }

  const sessionPending = !demoMode && !authReady;

  return (
    <AdminClockContext.Provider value={showcaseMode ? HERO_SHOWCASE_ADMIN_CLOCK : REAL_ADMIN_CLOCK}>
    <AdminTodayBookingsLiveProvider
      isPublicDemo={demoMode}
      isBlacklineDemo={demoTenant === 'blackline'}
      showDemoModePills={demoMode && getPublicAdminDemoCapabilities(demoTenant).showDemoModePills}
      initialBookings={initialBookings}
    >
      <AdminProductLockProvider value={productLocks}>
      <AdminLayout
        activeSection={activeSection === 'bookings_history_tab' ? 'bookings_dashboard' : activeSection}
        onChangeSection={handleSectionChange}
        isTransitioning={showPending || sessionPending}
        isEntering={isEntering}
        showPending={showPending || sessionPending}
        showSectionSkeleton={false}
        isPublicDemo={demoMode}
        demoTenant={demoTenant}
        profileUser={profileUser}
        shopId={demoMode ? null : shopId}
        shopLogoUrl={demoMode ? null : shopLogoUrl}
        shopName={demoTenant === 'blackline' ? shopName : demoMode ? null : shopName}
        publicActivityPaused={demoMode ? false : publicActivityPaused}
        previewUnderConstruction={demoMode ? false : previewUnderConstruction}
        isPreviewAccess={demoMode ? false : isPreviewAccess}
        permissions={demoMode ? null : permissions}
        persistentAdminChrome={<AdminGlobalMobileNextStripHost />}
        showcaseMode={showcaseMode}
      >
        {sessionPending ? null : (
          <>
        <BookingsAdminPanel
          key="bookings"
          isActive={isBookingsSection && !activeLockedFeature}
          isPublicDemo={demoMode}
          isBlacklineDemo={demoTenant === 'blackline'}
          initialBookings={initialBookings as never}
          mode={
            activeLockedFeature
              ? 'dashboard'
              : activeSection === 'bookings_blocks'
              ? 'blocks'
              : activeSection === 'bookings_reports'
                ? 'reports'
                : activeSection === 'bookings_history_tab'
                  ? 'history'
                  : 'dashboard'
          }
          historyWithinBookings={activeSection === 'bookings_history_tab' && !activeLockedFeature}
          onOpenHistoryWithinBookings={() => handleSectionChange('bookings_history_tab')}
          onBackToDashboard={() => handleSectionChange('bookings_dashboard')}
          showcaseMode={showcaseMode}
        />

        {activeLockedFeature ? (
          <FullKersivoLockedSection feature={activeLockedFeature} />
        ) : (
        <LazyPanelErrorBoundary>
          <Suspense fallback={<PanelChunkFallback />}>
            {activeSection === 'services' ? (
              <ServicesAdminPanel
                key="services"
                isBlacklineDemo={demoTenant === 'blackline'}
                showcaseMode={showcaseMode}
              />
            ) : null}

            {activeSection === 'bookings_clients' ? (
              <ClientsAdminPanel key="clients" showcaseMode={showcaseMode} />
            ) : null}

            {activeSection === 'shop_products' || activeSection === 'shop_orders' || activeSection === 'shop_sales' ? (
              <ShopAdminPanel
                key="shop"
                initialTab={shopTab}
                isBlacklineDemo={demoTenant === 'blackline'}
                showcaseMode={showcaseMode}
              />
            ) : null}

            {activeSection === 'assistant' ? <AiAssistantPanel key="assistant" isPublicDemo={demoMode} showcaseMode={showcaseMode} /> : null}

            {activeSection === 'barbershop_settings' ? (
              <BarbershopSettingsPanel
                key="barbershop-settings"
                onIdentitySaved={(identity) => {
                  setShopName(identity.name.trim() || null);
                  setShopLogoUrl(identity.logoUrl);
                }}
                onPauseChanged={setPublicActivityPaused}
              />
            ) : null}

            {activeSection === 'site_launch' ? <SiteLaunchHubPanel key="site-launch" /> : null}
          </Suspense>
        </LazyPanelErrorBoundary>
        )}
          </>
        )}
      </AdminLayout>
      <FullKersivoUpgradeDialog feature={upgradeFeature} onClose={closeUpgrade} />
      </AdminProductLockProvider>
    </AdminTodayBookingsLiveProvider>
    </AdminClockContext.Provider>
  );
}
