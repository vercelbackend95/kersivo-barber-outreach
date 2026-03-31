import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminSection } from './AdminPanel';
import { SkeletonKPICards, SkeletonTableRows } from '../skeleton';
import {
  BarChart2,
  Calendar,
  Clock,
  LogOut,
  Menu,
  Package,
  Scissors,
  ShoppingBag,
  TrendingUp,
  Users,
  X,
} from '../lucide-react';

type AdminLayoutProps = {
  activeSection: AdminSection;
  onChangeSection: (section: AdminSection) => void;
  isTransitioning: boolean;
  showSectionSkeleton: boolean;
  children: React.ReactNode;
};

type SectionItem = {
  section: AdminSection;
  label: string;
  icon: React.ReactElement;
};
type SectionGroup = {
  title: string;
  items: SectionItem[];
};

const ICON = { width: 16, height: 16, 'aria-hidden': true as const };

const menuGroups: SectionGroup[] = [
  {
    title: 'Booking system',
    items: [
      { section: 'bookings_dashboard', label: 'Bookings', icon: <Calendar {...ICON} /> },
      { section: 'bookings_blocks', label: 'Barbers', icon: <Users {...ICON} /> },
      { section: 'bookings_reports', label: 'Reports', icon: <BarChart2 {...ICON} /> },
      { section: 'bookings_history', label: 'History', icon: <Clock {...ICON} /> },
      { section: 'services', label: 'Services', icon: <Scissors {...ICON} /> },
    ],
  },
  {
    title: 'Shop / Retail',
    items: [
      { section: 'shop_products', label: 'Products', icon: <Package {...ICON} /> },
      { section: 'shop_orders', label: 'Orders', icon: <ShoppingBag {...ICON} /> },
      { section: 'shop_sales', label: 'Sales', icon: <TrendingUp {...ICON} /> },
    ],
  },
];

function SidebarBrand() {
  return (
    <div className="admin-sidebar-brand">
      <div className="admin-sidebar-monogram" aria-hidden="true">K</div>
      <div className="admin-sidebar-brand-text">
        <span className="admin-sidebar-brand-name">Kersivo</span>
        <span className="admin-sidebar-brand-sub">Admin</span>
      </div>
    </div>
  );
}

function SidebarStatus({ className = '' }: { className?: string }) {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return (
    <div className={`admin-sidebar-status ${className}`.trim()} aria-label="System status">
      <span className="admin-sidebar-status-date">{dateStr}</span>
      <span className="admin-sidebar-status-dot" aria-hidden="true" />
      <span className="admin-sidebar-status-label">Online</span>
    </div>
  );
}

export default function AdminLayout({
  activeSection,
  onChangeSection,
  isTransitioning,
  showSectionSkeleton,
  children,
}: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const mobileHeaderRef = useRef<HTMLElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileOpenButtonRef = useRef<HTMLButtonElement | null>(null);

  const onSelectSection = (section: AdminSection) => {
    onChangeSection(section);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    window.location.assign('/admin');
  };

  const menu = useMemo(() => (
    <nav className="admin-sidebar-nav" aria-label="Admin navigation">
      {menuGroups.map((group) => (
        <div className="admin-sidebar-group" key={group.title}>
          <p className="admin-sidebar-group-title">{group.title}</p>
          {group.items.map((item) => (
            <button
              key={item.section}
              type="button"
              className={`admin-sidebar-link ${activeSection === item.section ? 'admin-sidebar-link--active' : ''}`}
              onClick={() => onSelectSection(item.section)}
            >
              <span className="admin-sidebar-link-icon">{item.icon}</span>
              <span className="admin-sidebar-link-label">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  ), [activeSection]);

  const activeSectionLabel = useMemo(() => {
    for (const group of menuGroups) {
      const item = group.items.find((i) => i.section === activeSection);
      if (item) return item.label;
    }
    return '';
  }, [activeSection]);

  const skeletonVariant = useMemo<'kpi' | 'table'>(() => {
    if (activeSection === 'bookings_reports' || activeSection === 'shop_sales') {
      return 'kpi';
    }
    return 'table';
  }, [activeSection]);

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

  useEffect(() => {
    const mainContentNode = mainContentRef.current;
    const mobileHeaderNode = mobileHeaderRef.current;
    if (!mainContentNode || !mobileHeaderNode) return undefined;

    const updateHeaderHeightVariable = () => {
      const nextHeight = mobileHeaderNode.getBoundingClientRect().height;
      mainContentNode.style.setProperty('--admin-mobile-header-h', `${Math.ceil(nextHeight)}px`);
    };

    updateHeaderHeightVariable();
    const resizeObserver = new ResizeObserver(updateHeaderHeightVariable);
    resizeObserver.observe(mobileHeaderNode);
    window.addEventListener('resize', updateHeaderHeightVariable);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeightVariable);
      mainContentNode.style.removeProperty('--admin-mobile-header-h');
    };
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <SidebarBrand />
        {menu}
        <div className="admin-sidebar-logout-wrap">
          <SidebarStatus />
          <div className="admin-sidebar-divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--ghost admin-sidebar-logout"
            onClick={() => void handleLogout()}
          >
            <LogOut width={15} height={15} aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <section
        ref={mainContentRef}
        className="admin-main-content admin-mobile-edge"
        aria-busy={isTransitioning}
        data-transitioning={isTransitioning}
      >
        <header ref={mobileHeaderRef} className="admin-mobile-header" aria-label="Admin mobile header">
          <SidebarBrand />
          <div className="admin-mobile-header-center">
            {activeSectionLabel && (
              <span className="admin-mobile-section-name" aria-current="page">
                {activeSectionLabel}
              </span>
            )}
            <SidebarStatus className="admin-sidebar-status--mobile-header" />
          </div>
          <button
            ref={mobileOpenButtonRef}
            type="button"
            className="admin-mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open admin menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="admin-mobile-drawer"
          >
            <Menu width={20} height={20} aria-hidden="true" />
          </button>
        </header>
        {showSectionSkeleton ? (
          <div className="admin-transition-skeleton" aria-hidden="true">
            {skeletonVariant === 'kpi' ? (
              <div className="admin-transition-skeleton-kpi-grid">
                <SkeletonKPICards count={3} />
              </div>
            ) : (
              <div className="admin-transition-skeleton-table-wrap">
                <table className="admin-transition-skeleton-table">
                  <tbody>
                    <SkeletonTableRows count={6} cols={6} />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          children
        )}
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
          <SidebarBrand />
          <SidebarStatus className="admin-sidebar-status--mobile-drawer" />
          <button
            type="button"
            className="admin-mobile-close-button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close admin menu"
          >
            <X width={20} height={20} aria-hidden="true" />
          </button>
        </div>
        {menu}
        <div className="admin-sidebar-divider" aria-hidden="true" />
        <button
          type="button"
          className="btn btn--ghost admin-mobile-logout"
          onClick={() => void handleLogout()}
        >
          <LogOut width={15} height={15} aria-hidden="true" />
          Logout
        </button>
      </aside>
    </div>
  );
}
