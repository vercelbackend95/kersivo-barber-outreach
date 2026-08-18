import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminGlobalMobileNextStripHost from './AdminGlobalMobileNextStripHost';
import BookingsAdminPanel from './BookingsAdminPanel';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';
import { AdminTodayBookingsLiveProvider } from './useAdminTodayBookingsLive';
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
  | 'bookings_history'
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
};

export default function AdminPanel({
  demoMode = false,
  demoTenant = 'generic',
  initialBookings,
  initialSection = null,
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
          via?: string;
          permissions?: string[];
          shop?: {
            logoUrl?: string | null;
            name?: string | null;
            publicActivityPaused?: boolean;
            pauseReason?: string | null;
          } | null;
          shopId?: string | null;
          user?: { name?: string | null; email?: string | null; image?: string | null } | null;
        }) => {
          if (payload.via === 'session' && payload.onboardingCompleted === false) {
            let skipGate = false;
            try {
              skipGate = sessionStorage.getItem('kersivo_skip_onboarding_gate') === '1';
            } catch {
              skipGate = false;
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
              via?: string;
              permissions?: string[];
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
          }
        } catch {
          setHasAccess(Boolean(getStoredAdminSecret()));
          setProfileUser(null);
          setShopLogoUrl(null);
          setShopName(null);
          setShopId(null);
          setPermissions(null);
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
    if (!demoMode) return;
    void (async () => {
      try {
        const response = await fetch('/api/admin-demo/session');
        if (!response.ok) setDemoLoadError(true);
      } catch {
        setDemoLoadError(true);
      }
    })();
  }, [demoMode]);

  const handleSectionChange = useCallback((section: AdminSection) => {
    if (section === activeSection) return;

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }

    setActiveSection(section);
    setIsEntering(true);
    setShowPending(false);
    const params = new URLSearchParams(window.location.search);
    params.set('section', section);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState({ adminSection: section }, '', nextUrl);
    }

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
  }, [activeSection]);

  const shopTab = useMemo(() => {
    if (activeSection === 'shop_orders') return 'orders';
    if (activeSection === 'shop_sales') return 'sales';
    return 'products';
  }, [activeSection]);

  const isBookingsSection =
    activeSection === 'bookings_dashboard'
    || activeSection === 'bookings_blocks'
    || activeSection === 'bookings_reports'
    || activeSection === 'bookings_history';

  useEffect(() => {
    clearTransientAdminViewportState();
  }, [activeSection]);

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
    <AdminTodayBookingsLiveProvider
      isPublicDemo={demoMode}
      isBlacklineDemo={demoTenant === 'blackline'}
      showDemoModePills={demoMode && getPublicAdminDemoCapabilities(demoTenant).showDemoModePills}
      initialBookings={initialBookings}
    >
      <AdminLayout
        activeSection={activeSection}
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
      >
        {sessionPending ? null : (
          <>
        <BookingsAdminPanel
          key="bookings"
          isActive={isBookingsSection}
          isPublicDemo={demoMode}
          isBlacklineDemo={demoTenant === 'blackline'}
          initialBookings={initialBookings as never}
          mode={
            activeSection === 'bookings_blocks'
              ? 'blocks'
              : activeSection === 'bookings_reports'
                ? 'reports'
                : activeSection === 'bookings_history'
                  ? 'history'
                  : 'dashboard'
          }
          onBackToDashboard={() => handleSectionChange('bookings_dashboard')}
        />

        <LazyPanelErrorBoundary>
          <Suspense fallback={<PanelChunkFallback />}>
            {activeSection === 'services' ? (
              <ServicesAdminPanel key="services" isBlacklineDemo={demoTenant === 'blackline'} />
            ) : null}

            {activeSection === 'bookings_clients' ? <ClientsAdminPanel key="clients" /> : null}

            {activeSection === 'shop_products' || activeSection === 'shop_orders' || activeSection === 'shop_sales' ? (
              <ShopAdminPanel key="shop" initialTab={shopTab} />
            ) : null}

            {activeSection === 'assistant' ? <AiAssistantPanel key="assistant" isPublicDemo={demoMode} /> : null}

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
          </>
        )}
      </AdminLayout>
    </AdminTodayBookingsLiveProvider>
  );
}
