import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import BookingsAdminPanel from './BookingsAdminPanel';
import ShopAdminPanel from './ShopAdminPanel';

type AdminTopSection = 'bookings' | 'shop';

function getSectionFromUrl(): AdminTopSection {
  if (typeof window === 'undefined') return 'bookings';
  const section = new URLSearchParams(window.location.search).get('section');
  return section === 'shop' ? 'shop' : 'bookings';

}


export default function AdminPanel() {
    const [activeSection, setActiveSection] = useState<AdminTopSection>('bookings');

  useEffect(() => {
    setActiveSection(getSectionFromUrl());
    const handlePopState = () => {
      setActiveSection(getSectionFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);

  }, []);

  const handleSectionChange = useCallback((section: AdminTopSection) => {
    setActiveSection(section);
    const params = new URLSearchParams(window.location.search);
    params.set('section', section);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);

  }, []);

  return (
        <AdminLayout activeSection={activeSection} onChangeSection={handleSectionChange}>
      <BookingsAdminPanel isActive={activeSection === 'bookings'} />
      {activeSection === 'shop' ? <ShopAdminPanel /> : null}
    </AdminLayout>

  );
}
