import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import BookingsAdminPanel from './BookingsAdminPanel';
import ShopAdminPanel from './ShopAdminPanel';
import ServicesAdminPanel from './ServicesAdminPanel';
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


export default function AdminPanel() {
  const [activeSection, setActiveSection] = useState<AdminSection>('bookings_dashboard');
  const [adminSecretDraft, setAdminSecretDraft] = useState('');
  const [hasAdminSecret, setHasAdminSecret] = useState(false);

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
    setActiveSection(section);
    const params = new URLSearchParams(window.location.search);
    params.set('section', section);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  const handleSaveAdminSecret = useCallback(() => {
    const trimmed = adminSecretDraft.trim();
    if (!trimmed) return;

    saveAdminSecret(trimmed);
    setHasAdminSecret(true);
    setAdminSecretDraft('');
    window.location.reload();
  }, [adminSecretDraft]);

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


  if (!hasAdminSecret) {
    return (
      <section className="surface booking-shell admin-auth-shell">
        <h1>ADMIN ACCESS</h1>
        <p className="muted">Enter admin secret to unlock admin API access in this browser.</p>
        <label htmlFor="admin-secret-input">Admin secret</label>
        <input
          id="admin-secret-input"
          type="password"
          value={adminSecretDraft}
          onChange={(event) => setAdminSecretDraft(event.target.value)}
          autoComplete="current-password"
        />
        <div className="admin-auth-actions">
          <button type="button" className="btn btn--primary" onClick={handleSaveAdminSecret}>
            Save access
          </button>
        </div>
      </section>
    );
  }

  return (
    <AdminLayout activeSection={activeSection} onChangeSection={handleSectionChange}>
      <BookingsAdminPanel
              key={isBookingsSection ? activeSection : 'bookings-hidden'}
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

  );
}
