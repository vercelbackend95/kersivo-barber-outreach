import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminSection } from './AdminPanel';

type AdminLayoutProps = {
  activeSection: AdminSection;
  onChangeSection: (section: AdminSection) => void;
  children: React.ReactNode;
};

type SectionItem = {
  section: AdminSection;
  label: string;
};

const bookingItems: SectionItem[] = [
  { section: 'bookings_dashboard', label: 'Dashboard' },
  { section: 'bookings_blocks', label: 'Quick Blocks' },
  { section: 'bookings_reports', label: 'Reports' },
  { section: 'bookings_history', label: 'History' },
];

const shopItems: SectionItem[] = [
  { section: 'shop_products', label: 'Products' },
  { section: 'shop_orders', label: 'Orders' },
  { section: 'shop_sales', label: 'Sales' },
];
export const ADMIN_MOBILE_BREAKPOINT_PX = 768;


export default function AdminLayout({ activeSection, onChangeSection, children }: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia(`(max-width: ${ADMIN_MOBILE_BREAKPOINT_PX}px)`).matches;
  });


  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileOpenButtonRef = useRef<HTMLButtonElement | null>(null);

  const onSelectSection = (section: AdminSection) => {
    onChangeSection(section);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.reload();
  };

  const menuGroups = useMemo(() => (
    <>
      <div className="admin-sidebar-group" aria-label="Bookings navigation">
        <p className="admin-sidebar-group-title">Bookings</p>
        <nav className="admin-sidebar-nav">
          {bookingItems.map((item) => (
            <button
              key={item.section}
              type="button"
              className={`admin-sidebar-link ${activeSection === item.section ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onSelectSection(item.section)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="admin-sidebar-divider" role="presentation" />

      <div className="admin-sidebar-group" aria-label="Shop navigation">
        <p className="admin-sidebar-group-title">Shop</p>
        <nav className="admin-sidebar-nav">
          {shopItems.map((item) => (
            <button
              key={item.section}
              type="button"
              className={`admin-sidebar-link ${activeSection === item.section ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onSelectSection(item.section)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  ), [activeSection]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${ADMIN_MOBILE_BREAKPOINT_PX}px)`);

    const handleViewportChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const matches = 'matches' in event ? event.matches : mediaQuery.matches;
      setIsMobile(matches);
      console.log('isMobile', matches);
    };

    handleViewportChange(mediaQuery);

    const listener = (event: MediaQueryListEvent) => {
      handleViewportChange(event);
    };

    mediaQuery.addEventListener('change', listener);

    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile]);


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

  return (
    <div className="admin-shell">
      {!isMobile && (
        <aside className="admin-sidebar" aria-label="Admin sections">
          <h1 className="admin-sidebar-title">Admin</h1>
          {menuGroups}
        </aside>
      )}


      <section className="admin-main-content">
        {isMobile && (
          <header className="admin-mobile-header" aria-label="Admin mobile header">
            <p className="admin-mobile-title">Admin</p>
            <button
              ref={mobileOpenButtonRef}
              type="button"
              className="admin-mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="admin-mobile-drawer"
            >
              ☰
            </button>
          </header>
        )}

        {children}
      </section>


      {isMobile && (
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
              <p className="admin-mobile-title">Admin</p>
              <button
                type="button"
                className="admin-mobile-close-button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close admin menu"
              >
                ✕
              </button>
            </div>
            {menuGroups}
            <div className="admin-sidebar-divider" role="presentation" />
            <button type="button" className="btn btn--secondary admin-mobile-logout" onClick={() => void handleLogout()}>
              Logout
            </button>
          </aside>
        </>
      )}

    </div>
  );
}
