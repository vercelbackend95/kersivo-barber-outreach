import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isPreviewHubAllowedPath,
  paidAdminRedirectForHubPath,
  previewHubLegacyRedirect,
  previewHubSectionFromPath,
} from './previewHubPaths';

describe('preview hub paths', () => {
  it('allows the hub routes, real-admin paths and leave-preview', () => {
    expect(isPreviewHubAllowedPath('/admin')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/changes')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/website')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/messages')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/team')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/services')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/products')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/leave-preview')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/launch')).toBe(false);
    expect(isPreviewHubAllowedPath('/admin/upgrade')).toBe(false);
    expect(isPreviewHubAllowedPath('/admin/barbershop-settings')).toBe(false);
    expect(isPreviewHubAllowedPath('/admin/retail-onboarding')).toBe(false);
    expect(isPreviewHubAllowedPath('/admin/bookings')).toBe(false);
  });

  it('keeps query strings on allowed hub paths (middleware matches pathname only)', () => {
    expect(isPreviewHubAllowedPath(new URL('http://x/admin/team?add=1').pathname)).toBe(true);
    expect(isPreviewHubAllowedPath(new URL('http://x/admin/services?add=1').pathname)).toBe(true);
    expect(isPreviewHubAllowedPath(new URL('http://x/admin/products?add=1').pathname)).toBe(true);
    expect(isPreviewHubAllowedPath(new URL('http://x/admin/bookings?add=1').pathname)).toBe(false);
  });

  it('maps path to section', () => {
    expect(previewHubSectionFromPath('/admin')).toBe('overview');
    expect(previewHubSectionFromPath('/admin/changes')).toBe('changes');
    expect(previewHubSectionFromPath('/admin/website/')).toBe('website');
    expect(previewHubSectionFromPath('/admin/messages')).toBe('messages');
    expect(previewHubSectionFromPath('/admin/team')).toBe('team');
    expect(previewHubSectionFromPath('/admin/services/')).toBe('services');
    expect(previewHubSectionFromPath('/admin/products')).toBe('products');
  });

  it('redirects old query URLs', () => {
    expect(previewHubLegacyRedirect(new URL('http://x/admin?section=changes'))).toBe('/admin/changes');
    expect(previewHubLegacyRedirect(new URL('http://x/admin?section=website&view=booking'))).toBe(
      '/admin/website?view=booking',
    );
    expect(previewHubLegacyRedirect(new URL('http://x/admin?section=messages&draft=reopen'))).toBe(
      '/admin/messages?draft=reopen',
    );
    expect(previewHubLegacyRedirect(new URL('http://x/admin?app=messages&draft=reopen'))).toBeNull();
    expect(previewHubLegacyRedirect(new URL('http://x/admin?app=colours'))).toBeNull();
    expect(previewHubLegacyRedirect(new URL('http://x/admin?app=services'))).toBe('/admin/services');
    expect(previewHubLegacyRedirect(new URL('http://x/admin?app=team'))).toBe('/admin/team');
  });

  it('removes leftover hub chrome and keeps paid admin CSS on main', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/components/admin-hub.css'), 'utf8');
    const booking = readFileSync(resolve(process.cwd(), 'src/styles/components/booking.css'), 'utf8');
    const layout = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf8');
    expect(css).toContain('admin-hub-setup__count');
    expect(css).toContain('admin-shell--preview');
    expect(css).toContain('admin-mobile-drawer-dock');
    expect(css).toContain('admin-sidebar-link-badge');
    expect(css).not.toContain('admin-hub-tabs');
    expect(css).not.toContain('admin-hub-unread');
    expect(css).not.toContain('admin-hub-composer-fake');
    expect(css).not.toContain('admin-hub-chip--prog');
    expect(css).not.toContain('admin-hub-skel--bar');
    expect(css).not.toContain('rgba(215, 38, 56');
    expect(css).not.toContain('#ff9aa4');
    expect(booking).not.toContain('admin-mobile-drawer-dock');
    expect(booking).not.toContain('admin-sidebar-link-badge');
    expect(booking).toMatch(/\.admin-sidebar-nav \{\s*display: grid;\s*gap: 0\.85rem;\s*flex: 1;\s*\}/);
    expect(booking).toMatch(/\.admin-mobile-drawer \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto auto 1fr auto auto;/);
    expect(layout).not.toContain('admin-hub-tabs');
    expect(layout).toContain("mode === 'preview'");
    expect(layout).toContain('admin-shell--preview');
    expect(layout).toContain('admin-sidebar-link');
    expect(layout).toContain('PREVIEW_HUB_PATHS.messages');
    expect(layout).toContain('previewUnreadMessages');
    expect(layout).toContain('admin-sidebar-link-badge');
    expect(layout).toContain('placement="sidebar"');
    expect(layout).toContain('placement="mobile"');
    expect(layout).toContain('admin-mobile-drawer-dock');
    expect(layout).toContain('admin-mobile-top-chrome');
    expect(existsSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubShell.astro'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubSetupCard.astro'))).toBe(false);
  });

  it('maps hub real-admin paths to paid SPA sections', () => {
    expect(paidAdminRedirectForHubPath('team')).toBe('/admin?section=bookings_blocks');
    expect(paidAdminRedirectForHubPath('services')).toBe('/admin?section=services');
    expect(paidAdminRedirectForHubPath('products')).toBe('/admin?section=shop_products');
  });

  it('keeps add=1 on the paid redirect so the create sheet still opens', () => {
    expect(paidAdminRedirectForHubPath('services', new URLSearchParams('add=1'))).toBe(
      '/admin?section=services&add=1',
    );
    expect(paidAdminRedirectForHubPath('team', '?add=1')).toBe('/admin?section=bookings_blocks&add=1');
    expect(paidAdminRedirectForHubPath('products', 'view=x')).toBe('/admin?section=shop_products');
  });

  it('keeps the paid admin sidebar items and routes', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf8');
    expect(layout).toContain("title: 'Booking system'");
    expect(layout).toContain("section: 'bookings_dashboard', label: 'Bookings'");
    expect(layout).toContain("section: 'bookings_blocks', label: 'Team'");
    expect(layout).toContain("section: 'bookings_reports', label: 'Reports'");
    expect(layout).toContain("section: 'bookings_clients', label: 'Clients'");
    expect(layout).toContain("section: 'services', label: 'Services'");
    expect(layout).toContain("title: 'Shop / Retail'");
    expect(layout).toContain("section: 'shop_products', label: 'Products'");
    expect(layout).toContain("section: 'shop_orders', label: 'Orders'");
    expect(layout).toContain("section: 'shop_sales', label: 'Sales'");
    expect(layout).toContain("title: 'Assistant'");
    expect(layout).toContain("section: 'assistant', label: 'Assistant'");
    expect(layout).toContain("mode = 'full'");
    expect(layout).toContain('isPreviewChrome ? (');
  });
});
