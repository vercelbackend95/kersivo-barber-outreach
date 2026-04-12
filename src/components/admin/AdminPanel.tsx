import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminGlobalMobileNextStripHost from './AdminGlobalMobileNextStripHost';
import BookingsAdminPanel from './BookingsAdminPanel';
import ShopAdminPanel from './ShopAdminPanel';
import ServicesAdminPanel from './ServicesAdminPanel';
import { AdminTodayBookingsLiveProvider } from './useAdminTodayBookingsLive';
import { getStoredAdminSecret, installAdminFetchInterceptor, saveAdminSecret } from './adminAuth';
export type AdminSection =
  | 'bookings_dashboard'
  | 'bookings_blocks'
  | 'bookings_reports'
  | 'bookings_history'
    | 'services'
  | 'shop_products'
  | 'shop_orders'
  | 'shop_sales';
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

  const section = new URLSearchParams(window.location.search).get('section');
  if (section === 'bookings_blocks') return 'bookings_blocks';
  if (section === 'bookings_reports') return 'bookings_reports';
  if (section === 'bookings_history') return 'bookings_history';
    if (section === 'services') return 'services';
  if (section === 'shop_orders') return 'shop_orders';
  if (section === 'shop_sales') return 'shop_sales';
  if (section === 'shop_products') return 'shop_products';
  return 'bookings_dashboard';

}

/** Pre-fills the login field so demos work without emailing secrets (must match server `ADMIN_SECRET`). */
const ADMIN_LOGIN_PREFILL_SECRET = 'supersecret123';

export default function AdminPanel() {
  const [activeSection, setActiveSection] = useState<AdminSection>('bookings_dashboard');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSectionSkeleton, setShowSectionSkeleton] = useState(false);
  const [adminSecretDraft, setAdminSecretDraft] = useState(ADMIN_LOGIN_PREFILL_SECRET);
  const [hasAdminSecret, setHasAdminSecret] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secretError, setSecretError] = useState('');
  const transitionTimeoutRef = useRef<number | null>(null);
  const skeletonTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
        installAdminFetchInterceptor();
    const existingSecret = getStoredAdminSecret();
    setHasAdminSecret(Boolean(existingSecret));

    setActiveSection(getSectionFromUrl());
    const handlePopState = () => {
      setActiveSection(getSectionFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);

  }, []);

  const handleSectionChange = useCallback((section: AdminSection) => {
    if (section === activeSection) return;

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (skeletonTimeoutRef.current !== null) {
      window.clearTimeout(skeletonTimeoutRef.current);
      skeletonTimeoutRef.current = null;
    }

    setIsTransitioning(true);
    setShowSectionSkeleton(true);
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

    skeletonTimeoutRef.current = window.setTimeout(() => {
      setShowSectionSkeleton(false);
      skeletonTimeoutRef.current = null;
    }, 300);
  }, [activeSection]);

  const handleSaveAdminSecret = useCallback(() => {
    const trimmed = adminSecretDraft.trim();
    if (!trimmed) return;

    saveAdminSecret(trimmed);
    setHasAdminSecret(true);
    setAdminSecretDraft('');
    window.location.reload();
  }, [adminSecretDraft]);

  const handleLoginClick = useCallback(() => {
    if (!adminSecretDraft.trim()) {
      setSecretError('Please enter your admin secret.');
      return;
    }
    setSecretError('');
    setIsVerifying(true);
    handleSaveAdminSecret();
  }, [adminSecretDraft, handleSaveAdminSecret]);

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
      if (skeletonTimeoutRef.current !== null) {
        window.clearTimeout(skeletonTimeoutRef.current);
      }
    };
  }, []);


  if (!hasAdminSecret) {
    return (
      <div className="admin-login-viewport">
        <div className="admin-login-card">

          <div className="admin-login-brand">
            <div className="admin-login-monogram" aria-hidden="true">K</div>
            <div className="admin-login-brand-text">
              <span className="admin-login-brand-name">Kersivo</span>
              <span className="admin-login-brand-sub">Admin Panel</span>
            </div>
          </div>

          <div className={`field${secretError ? ' field--error' : ''}`}>
            <label className="field__label" htmlFor="admin-secret-input">
              Admin secret
            </label>
            <input
              id="admin-secret-input"
              type="password"
              className={`input${secretError ? ' input--error' : ''}`}
              value={adminSecretDraft}
              onChange={(event) => {
                setAdminSecretDraft(event.target.value);
                if (secretError) setSecretError('');
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLoginClick(); }}
              autoComplete="current-password"
              aria-invalid={secretError ? 'true' : undefined}
              aria-describedby={secretError ? 'admin-secret-error' : undefined}
              disabled={isVerifying}
            />
            {secretError && (
              <span id="admin-secret-error" className="field__hint" role="alert">
                {secretError}
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn btn--primary admin-login-submit"
            onClick={handleLoginClick}
            disabled={isVerifying}
            aria-busy={isVerifying}
          >
            {isVerifying ? (
              <>
                <svg
                  className="admin-login-spinner"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  width="18"
                  height="18"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="40 20"
                  />
                </svg>
                Verifying…
              </>
            ) : (
              'Unlock Admin Panel'
            )}
          </button>

          <footer className="admin-login-footer">
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure access — credentials stored locally in this browser
          </footer>

        </div>
      </div>
    );
  }

  return (
    <AdminTodayBookingsLiveProvider>
      <AdminLayout
        activeSection={activeSection}
        onChangeSection={handleSectionChange}
        isTransitioning={isTransitioning}
        showSectionSkeleton={showSectionSkeleton}
        persistentAdminChrome={<AdminGlobalMobileNextStripHost />}
      >
        <BookingsAdminPanel
          key="bookings"
          isActive={isBookingsSection}
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
      
      {activeSection === 'services' ? (
        <ServicesAdminPanel key="services" />
      ) : null}

      {activeSection === 'shop_products' || activeSection === 'shop_orders' || activeSection === 'shop_sales' ? (
        <ShopAdminPanel key={activeSection} initialTab={shopTab} />
      ) : null}

      </AdminLayout>
    </AdminTodayBookingsLiveProvider>
  );
}
