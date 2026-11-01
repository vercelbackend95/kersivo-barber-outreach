import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('AdminAddButton wiring', () => {
  it('replaces the icon-only header actions with labelled AdminAddButton', () => {
    const services = read('src/components/admin/ServicesAdminPanel.tsx');
    const bookings = read('src/components/admin/BookingsAdminPanel.tsx');
    const shop = read('src/components/admin/ShopAdminPanel.tsx');

    expect(services).toContain('import AdminAddButton from \'./AdminAddButton\'');
    expect(services).toContain('label="Add service"');
    expect(services).not.toMatch(/className="btn btn--primary btn--icon"/);
    expect(services).not.toContain('aria-label="Add service"');

    expect(bookings).toContain('import AdminAddButton from \'./AdminAddButton\'');
    expect(bookings).toContain('label="Add team member"');
    expect(bookings).not.toMatch(/className="btn btn--primary btn--icon"/);
    expect(bookings).not.toContain('aria-label="Add team member"');
    expect(bookings).toContain('aria-label="New booking"');
    expect(bookings).toContain('className="admin-manual-booking-fab"');

    expect(shop).toContain('import AdminAddButton from \'./AdminAddButton\'');
    expect(shop).toContain('label="Add product"');
    expect(shop).not.toMatch(/className="btn btn--primary btn--icon"/);
    expect(shop).not.toContain('aria-label="Add product"');
  });

  it('shows a first-item CTA in each empty state', () => {
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

  it('keeps the add label visible and wraps header actions under the title on narrow screens', () => {
    const css = read('src/styles/components/admin-section-header.css');
    expect(css).toContain('.admin-add-btn');
    expect(css).toContain('white-space: nowrap');
    expect(css).toContain('min-height: 40px');
    expect(css).toContain('min-height: 44px');
    expect(css).toMatch(/@media \(max-width: 480px\)[\s\S]*flex-wrap:\s*wrap/);
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
});
