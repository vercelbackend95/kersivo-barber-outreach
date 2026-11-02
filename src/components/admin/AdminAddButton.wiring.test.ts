import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('AdminAddButton wiring', () => {
  it('keeps labelled desktop Add actions and a shared mobile FAB', () => {
    const services = read('src/components/admin/ServicesAdminPanel.tsx');
    const bookings = read('src/components/admin/BookingsAdminPanel.tsx');
    const shop = read('src/components/admin/ShopAdminPanel.tsx');
    const fab = read('src/components/admin/AdminMobileFab.tsx');

    expect(fab).toContain('aria-label={label}');
    expect(fab).toContain('<Plus aria-hidden />');

    expect(services).toContain('import AdminAddButton from \'./AdminAddButton\'');
    expect(services).toContain('import AdminMobileFab from \'./AdminMobileFab\'');
    expect(services).toContain('label="Add service"');
    expect(services).not.toMatch(/className="btn btn--primary btn--icon"/);
    expect(services).toContain('context="services"');
    expect(services).toContain('admin-has-mobile-fab');

    expect(bookings).toContain('import AdminAddButton from \'./AdminAddButton\'');
    expect(bookings).toContain('import AdminMobileFab from \'./AdminMobileFab\'');
    expect(bookings).toContain('label="Add team member"');
    expect(bookings).toContain('label="New booking"');
    expect(bookings).toContain('className="admin-manual-booking-fab"');
    expect(bookings).toContain('visibility="always"');
    expect(bookings).toContain('context="bookings"');
    expect(bookings).toContain('context="team"');
    expect(bookings).not.toMatch(/className="btn btn--primary btn--icon"/);
    expect(bookings).toContain('mode === \'blocks\' && canEditTeam');
    expect(bookings).toContain('canCreateManualBooking && !isPublicDemo && (mode === \'dashboard\' || mode === \'history\')');

    expect(shop).toContain('import AdminAddButton from \'./AdminAddButton\'');
    expect(shop).toContain('import AdminMobileFab from \'./AdminMobileFab\'');
    expect(shop).toContain('label="Add product"');
    expect(shop).toContain('context="products"');
    expect(shop).toContain("activeTab === 'products'");
    expect(shop).not.toMatch(/className="btn btn--primary btn--icon"/);
  });

  it('shows a first-item CTA in each empty state without removing instructional copy', () => {
    const services = read('src/components/admin/ServicesAdminPanel.tsx');
    const overview = read('src/components/admin/BarbersOverview.tsx');
    const shop = read('src/components/admin/ShopAdminPanel.tsx');

    expect(services).toContain('label="Add your first service"');
    expect(services).toContain('Add the services customers can book, with prices and durations.');

    expect(overview).toContain('label="Add your first team member"');
    expect(overview).toContain('Add the people customers can book with. You can set their hours and services.');

    expect(shop).toContain('label="Add your first product"');
    expect(shop).toContain('Add products you sell in the shop. Retail stays off until you switch it on.');
    expect(shop).toContain('retailOn');
  });

  it('hides labelled create actions on the admin mobile chrome breakpoint and keeps them on desktop', () => {
    const headerCss = read('src/styles/components/admin-section-header.css');
    const fabCss = read('src/styles/components/admin-mobile-fab.css');
    const addButton = read('src/components/admin/AdminAddButton.tsx');

    expect(headerCss).toContain("@import './admin-mobile-fab.css'");
    expect(addButton).toContain("visibility = 'desktop'");
    expect(addButton).toContain('admin-add-btn--desktop');
    expect(headerCss).toContain('.admin-add-btn');
    expect(headerCss).toContain('white-space: nowrap');
    expect(headerCss).toContain('min-height: 40px');
    expect(headerCss).toContain('min-height: 44px');
    expect(headerCss).toMatch(/@media \(max-width: 480px\)[\s\S]*flex-wrap:\s*wrap/);
    expect(fabCss).toContain('@media (max-width: 768px)');
    expect(fabCss).toContain('.admin-add-btn--desktop');
    expect(fabCss).toContain('display: none');
    expect(fabCss).toContain('.admin-mobile-fab--mobile');
    expect(fabCss).toContain('calc(var(--admin-mobile-fab-offset) + env(safe-area-inset-right, 0px))');
    expect(fabCss).toContain('calc(var(--admin-mobile-fab-offset) + env(safe-area-inset-bottom, 0px))');
    expect(fabCss).toContain("body:has([aria-modal='true']) .admin-mobile-fab");
    expect(fabCss).toContain('prefers-reduced-motion');
  });

  it('opens the create sheet from ?add=1 then strips the query', () => {
    const services = read('src/components/admin/ServicesAdminPanel.tsx');
    const bookings = read('src/components/admin/BookingsAdminPanel.tsx');
    const shop = read('src/components/admin/ShopAdminPanel.tsx');
    const panel = read('src/components/admin/AdminPanel.tsx');

    expect(panel).toContain('hasAdminAddQuery()');
    expect(panel).toContain('openCreateOnMount');
    expect(services).toContain('openCreateOnMount');
    expect(services).toContain('stripAdminAddQueryFromUrl()');
    expect(bookings).toContain('openCreateOnMount');
    expect(bookings).toContain('stripAdminAddQueryFromUrl()');
    expect(shop).toContain('openCreateOnMount');
    expect(shop).toContain('stripAdminAddQueryFromUrl()');
  });

  it('does not put a product FAB on Orders or Sales', () => {
    const shop = read('src/components/admin/ShopAdminPanel.tsx');
    expect(shop).toMatch(/activeTab === 'products' \? \(\s*<AdminMobileFab label="Add product"/);
    expect(shop).toContain("activeTab === 'products' ? ' admin-has-mobile-fab' : ''");
  });

  it('reuses Overview Add menu logic for the mobile FAB', () => {
    const menu = read('src/components/adminHub/AdminHubAddMenu.tsx');
    const overview = read('src/components/adminHub/AdminHubOverview.astro');
    expect(menu).toContain('showMobileFab');
    expect(menu).toContain('import AdminMobileFab from \'@/components/admin/AdminMobileFab\'');
    expect(menu).toContain('ADMIN_HUB_ADD_MENU');
    expect(overview).toContain('showMobileFab');
    expect(overview).toContain('admin-has-mobile-fab');
  });
});
