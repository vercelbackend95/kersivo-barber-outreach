import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import BookingsAdminPanel from './BookingsAdminPanel';
import ShopAdminPanel from './ShopAdminPanel';

export type AdminSection =
  | 'bookings_dashboard'
  | 'bookings_blocks'
  | 'bookings_reports'
  | 'bookings_history'
  | 'shop_products'
  | 'shop_orders'
  | 'shop_sales';


function getSectionFromUrl(): AdminSection {
  if (typeof window === 'undefined') return 'bookings_dashboard';

  const section = new URLSearchParams(window.location.search).get('section');
  if (section === 'bookings_blocks') return 'bookings_blocks';
  if (section === 'bookings_reports') return 'bookings_reports';
  if (section === 'bookings_history') return 'bookings_history';
  if (section === 'shop_orders') return 'shop_orders';
  if (section === 'shop_sales') return 'shop_sales';
  if (section === 'shop_products') return 'shop_products';
  return 'bookings_dashboard';

}


export default function AdminPanel() {
  const [activeSection, setActiveSection] = useState<AdminSection>('bookings_dashboard');

  useEffect(() => {
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


  return (
    <AdminLayout activeSection={activeSection} onChangeSection={handleSectionChange}>
      <BookingsAdminPanel
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
      {activeSection === 'shop_products' || activeSection === 'shop_orders' || activeSection === 'shop_sales' ? (
        <ShopAdminPanel initialTab={shopTab} />
      ) : null}

    </AdminLayout>

  );
}
