/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from './AdminLayout';
import { ADMIN_HUB_NAV_GROUP } from '@/lib/adminHub/copy';
import { PREVIEW_HUB_PATHS } from '@/lib/adminHub/previewHubPaths';

vi.mock('./AdminHubSetupCard', () => ({ AdminHubSetupCard: () => null }));
vi.mock('@/components/adminHub/AdminHubSetupCard', () => ({ AdminHubSetupCard: () => null }));
vi.mock('./AdminSidebarLaunchCta', () => ({ default: () => null }));
vi.mock('./AdminSidebarProfile', () => ({ default: () => null }));
vi.mock('./BlacklineConversionCard', () => ({ default: () => null }));
vi.mock('./DemoActionLock', () => ({ default: () => null }));

const FULL_PERMISSIONS = [
  'bookings.manage',
  'catalog.manage',
  'members.manage',
  'members.invite_barber',
  'team.read',
  'reports.view',
  'clients.read',
  'retail.manage',
  'ai.use',
];

function navSnapshot(container: HTMLElement) {
  const nav = container.querySelector('.admin-sidebar-nav');
  if (!nav) return [];
  return [...nav.querySelectorAll('.admin-sidebar-group')].map((group) => ({
    title: group.querySelector('.admin-sidebar-group-title')?.textContent ?? '',
    items: [...group.querySelectorAll('.admin-sidebar-link')].map((link) => ({
      label: link.querySelector('.admin-sidebar-link-label')?.textContent ?? '',
      href: link.getAttribute('href'),
      current: link.getAttribute('aria-current') === 'page',
    })),
  }));
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminLayout paid sidebar', () => {
  it('renders the full-mode menu groups and items unchanged', () => {
    const { container } = render(
      <AdminLayout
        isTransitioning={false}
        showSectionSkeleton={false}
        permissions={FULL_PERMISSIONS}
        activeSection="bookings_dashboard"
      >
        <div>paid</div>
      </AdminLayout>,
    );

    expect(navSnapshot(container)).toEqual([
      {
        title: 'Booking system',
        items: [
          { label: 'Bookings', href: null, current: true },
          { label: 'Team', href: null, current: false },
          { label: 'Reports', href: null, current: false },
          { label: 'Clients', href: null, current: false },
          { label: 'Services', href: null, current: false },
        ],
      },
      {
        title: 'Shop / Retail',
        items: [
          { label: 'Products', href: null, current: false },
          { label: 'Orders', href: null, current: false },
          { label: 'Sales', href: null, current: false },
        ],
      },
      {
        title: 'Assistant',
        items: [{ label: 'Assistant', href: null, current: false }],
      },
    ]);
  });
});

describe('AdminLayout preview chrome', () => {
  it('renders three groups and seven hub items with the real-admin hrefs', () => {
    const { container } = render(
      <AdminLayout
        mode="preview"
        previewSection="services"
        isTransitioning={false}
        showSectionSkeleton={false}
        previewUnreadMessages={2}
      >
        <div>hub</div>
      </AdminLayout>,
    );

    expect(navSnapshot(container)).toEqual([
      {
        title: ADMIN_HUB_NAV_GROUP,
        items: [
          { label: 'Overview', href: PREVIEW_HUB_PATHS.overview, current: false },
          { label: 'Changes', href: PREVIEW_HUB_PATHS.changes, current: false },
          { label: 'Website', href: PREVIEW_HUB_PATHS.website, current: false },
          { label: 'Messages', href: PREVIEW_HUB_PATHS.messages, current: false },
        ],
      },
      {
        title: 'Booking system',
        items: [
          { label: 'Team', href: PREVIEW_HUB_PATHS.team, current: false },
          { label: 'Services', href: PREVIEW_HUB_PATHS.services, current: true },
        ],
      },
      {
        title: 'Shop / Retail',
        items: [{ label: 'Products', href: PREVIEW_HUB_PATHS.products, current: false }],
      },
    ]);
    expect(container.querySelectorAll('.admin-sidebar-link')).toHaveLength(7);
    expect(container.querySelector('[data-testid="admin-hub-unread"]')?.textContent).toBe('2');
  });
});
