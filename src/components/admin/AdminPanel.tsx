import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminGlobalMobileNextStripHost from './AdminGlobalMobileNextStripHost';
import BookingsAdminPanel from './BookingsAdminPanel';
import PrivateDemoAuthPanel from './PrivateDemoAuthPanel';
import { AdminTodayBookingsLiveProvider } from './useAdminTodayBookingsLive';
import { resolveDemoSectionAlias } from '@/lib/admin/demoConfig';
import {
  enablePublicAdminDemo,
  getStoredAdminSecret,
  installAdminFetchInterceptor,
  setPublicAdminDemoMode,
} from './adminAuth';
import type { AdminProfileUser } from './AdminSidebarProfile';
import { SkeletonKPICards } from '../skeleton';
import { authClient } from '@/lib/auth-client';

const ServicesAdminPanel = lazy(() => import('./ServicesAdminPanel'));
const ClientsAdminPanel = lazy(() => import('./ClientsAdminPanel'));
const ShopAdminPanel = lazy(() => import('./ShopAdminPanel'));
const AiAssistantPanel = lazy(() => import('./AiAssistantPanel'));

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

  const rawSection = new URLSearchParams(window.location.search).get('section');
  const section = resolveDemoSectionAlias(rawSection) ?? rawSection;
  if (section === 'bookings_blocks') return 'bookings_blocks';
  if (section === 'bookings_reports') return 'bookings_reports';
  if (section === 'bookings_history') return 'bookings_history';
  if (section === 'bookings_clients') return 'bookings_clients';
  if (section === 'services') return 'services';
  if (section === 'shop_orders') return 'shop_orders';
  if (section === 'shop_sales') return 'shop_sales';
  if (section === 'shop_products') return 'shop_products';
  if (section === 'assistant') return 'assistant';
  // Legacy ?section=team → unified Team surface (bookings_blocks)
  if (section === 'team') return 'bookings_blocks';
  return 'bookings_dashboard';
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
};

export default function AdminPanel({ demoMode = false }: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('bookings_dashboard');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [authReady, setAuthReady] = useState(demoMode);
  const [hasAccess, setHasAccess] = useState(() => demoMode || Boolean(getStoredAdminSecret()));
  const [profileUser, setProfileUser] = useState<AdminProfileUser | null>(null);
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [demoLoadError, setDemoLoadError] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

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
          shop?: { logoUrl?: string | null; name?: string | null } | null;
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
          setShopLogoUrl(payload.shop?.logoUrl ?? null);
          setShopName(payload.shop?.name?.trim() || null);
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
            setPermissions(null);
          }
        } catch {
          setHasAccess(Boolean(getStoredAdminSecret()));
          setProfileUser(null);
          setShopLogoUrl(null);
          setShopName(null);
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
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
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

    setIsTransitioning(true);
    setActiveSection(section);
    const params = new URLSearchParams(window.location.search);
    params.set('section', section);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);

    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, 100);
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

  if (!demoMode && !authReady) {
    return (
      <div className="admin-login-viewport">
        <div className="auth-gate-card">
          <p className="admin-login-brand-sub" style={{ margin: 0, textAlign: 'center' }}>
            Checking session…
          </p>
        </div>
      </div>
    );
  }

  if (!demoMode && !hasAccess) {
    return (
      <PrivateDemoAuthPanel
        initialMode="signup"
        onSuccess={() => {
          window.location.assign('/admin');
        }}
      />
    );
  }

  return (
    <AdminTodayBookingsLiveProvider isPublicDemo={demoMode}>
      <AdminLayout
        activeSection={activeSection}
        onChangeSection={handleSectionChange}
        isTransitioning={isTransitioning}
        showSectionSkeleton={false}
        isPublicDemo={demoMode}
        profileUser={profileUser}
        shopLogoUrl={demoMode ? null : shopLogoUrl}
        shopName={demoMode ? null : shopName}
        permissions={demoMode ? null : permissions}
        persistentAdminChrome={<AdminGlobalMobileNextStripHost />}
      >
        <BookingsAdminPanel
          key="bookings"
          isActive={isBookingsSection}
          isPublicDemo={demoMode}
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

        <LazyPanelErrorBoundary key={activeSection}>
          <Suspense fallback={<PanelChunkFallback />}>
            {activeSection === 'services' ? <ServicesAdminPanel key="services" /> : null}

            {activeSection === 'bookings_clients' ? <ClientsAdminPanel key="clients" /> : null}

            {activeSection === 'shop_products' || activeSection === 'shop_orders' || activeSection === 'shop_sales' ? (
              <ShopAdminPanel key={activeSection} initialTab={shopTab} />
            ) : null}

            {activeSection === 'assistant' ? <AiAssistantPanel key="assistant" isPublicDemo={demoMode} /> : null}
          </Suspense>
        </LazyPanelErrorBoundary>
      </AdminLayout>
    </AdminTodayBookingsLiveProvider>
  );
}
