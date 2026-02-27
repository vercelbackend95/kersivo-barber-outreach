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


const menuItems: SectionItem[] = [
  { section: 'bookings_dashboard', label: 'Dashboard' },
  { section: 'bookings_blocks', label: 'Quick Blocks' },
  { section: 'bookings_reports', label: 'Reports' },
  { section: 'bookings_history', label: 'History' },
  { section: 'shop_products', label: 'Products' },
  { section: 'shop_orders', label: 'Orders' },
  { section: 'shop_sales', label: 'Sales' },
];

export default function AdminLayout({ activeSection, onChangeSection, children }: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileOpenButtonRef = useRef<HTMLButtonElement | null>(null);

  const onSelectSection = (section: AdminSection) => {
    onChangeSection(section);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.assign('/admin');
  };

  const menu = useMemo(() => (
    <nav className="admin-sidebar-nav" aria-label="Admin navigation">
      {menuItems.map((item) => (
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
  ), [activeSection]);

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
      <aside className="admin-sidebar" aria-label="Admin sections">
        <h1 className="admin-sidebar-title">ADMIN</h1>
        {menu}
                <div className="admin-sidebar-logout-wrap">
          <div className="admin-sidebar-divider" aria-hidden="true" />
          <button type="button" className="btn btn--secondary admin-sidebar-logout" onClick={() => void handleLogout()}>
            Logout
          </button>
        </div>
      </aside>

      <section className="admin-main-content">
        <header className="admin-mobile-header" aria-label="Admin mobile header">
          <p className="admin-mobile-title">ADMIN</p>
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
        {children}
      </section>

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
          <p className="admin-mobile-title">ADMIN</p>
          <button
            type="button"
            className="admin-mobile-close-button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close admin menu"
          >
            ✕
          </button>
        </div>
        {menu}
        <button type="button" className="btn btn--secondary admin-mobile-logout" onClick={() => void handleLogout()}>
          Logout
        </button>
      </aside>
    </div>
  );
}
