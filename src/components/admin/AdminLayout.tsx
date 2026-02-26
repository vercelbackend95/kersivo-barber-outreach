import React from 'react';
import type { AdminSection } from './AdminPanel';

type AdminLayoutProps = {
  activeSection: AdminSection;
  onChangeSection: (section: AdminSection) => void;

  children: React.ReactNode;
};

export default function AdminLayout({ activeSection, onChangeSection, children }: AdminLayoutProps) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <h1 className="admin-sidebar-title">Admin</h1>

        <div className="admin-sidebar-group" aria-label="Bookings navigation">
          <p className="admin-sidebar-group-title">Bookings</p>
          <nav className="admin-sidebar-nav">
            <button
              type="button"
              className={`admin-sidebar-link ${activeSection === 'bookings_dashboard' ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onChangeSection('bookings_dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`admin-sidebar-link ${activeSection === 'bookings_blocks' ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onChangeSection('bookings_blocks')}
            >
              Quick Blocks
            </button>
            <button
              type="button"
              className={`admin-sidebar-link ${activeSection === 'bookings_reports' ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onChangeSection('bookings_reports')}
            >
              Reports
            </button>
            <button
              type="button"
              className={`admin-sidebar-link ${activeSection === 'bookings_history' ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onChangeSection('bookings_history')}
            >
              History
            </button>
          </nav>
        </div>

        <div className="admin-sidebar-divider" role="presentation" />

        <div className="admin-sidebar-group" aria-label="Shop navigation">
          <p className="admin-sidebar-group-title">Shop</p>
          <nav className="admin-sidebar-nav">
            <button
              type="button"
              className={`admin-sidebar-link ${activeSection === 'shop_products' ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onChangeSection('shop_products')}
            >
              Products
            </button>
            <button
              type="button"
              className={`admin-sidebar-link ${activeSection === 'shop_orders' ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onChangeSection('shop_orders')}
            >
              Orders
            </button>
            <button
              type="button"
              className={`admin-sidebar-link ${activeSection === 'shop_sales' ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onChangeSection('shop_sales')}
            >
              Sales
            </button>
          </nav>
        </div>
      </aside>

      <section className="admin-main-content">{children}</section>
    </div>
  );
}
