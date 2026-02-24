import React from 'react';

type AdminTopSection = 'bookings' | 'shop';

type AdminLayoutProps = {
  activeSection: AdminTopSection;
  onChangeSection: (section: AdminTopSection) => void;
  children: React.ReactNode;
};

export default function AdminLayout({ activeSection, onChangeSection, children }: AdminLayoutProps) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <h1 className="admin-sidebar-title">Admin</h1>
        <nav className="admin-sidebar-nav">
          <button
            type="button"
            className={`admin-sidebar-link ${activeSection === 'bookings' ? 'admin-sidebar-link--active' : ''}`}
            onClick={() => onChangeSection('bookings')}
          >
            Bookings
          </button>
          <button
            type="button"
            className={`admin-sidebar-link ${activeSection === 'shop' ? 'admin-sidebar-link--active' : ''}`}
            onClick={() => onChangeSection('shop')}
          >
            Shop
          </button>
        </nav>
      </aside>

      <section className="admin-main-content">{children}</section>
    </div>
  );
}
