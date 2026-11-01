/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminHubAddMenu } from './AdminHubAddMenu';
import type { HubCapabilities, HubStage } from '@/lib/freePreview/hubStage';

function stubMatchMedia(mobile = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width') ? mobile : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    }),
  });
}

function caps(overrides: Partial<HubCapabilities> = {}): HubCapabilities {
  return {
    canUpload: true,
    canEditDetails: true,
    canReview: false,
    canDraftChanges: false,
    canSendChanges: false,
    canMessage: true,
    canCheckout: false,
    showPreview: false,
    ...overrides,
  };
}

function renderMenu(input: {
  stage?: HubStage;
  capabilities?: HubCapabilities;
  canAddShop?: boolean;
  tone?: 'primary' | 'outline';
  mobile?: boolean;
} = {}) {
  stubMatchMedia(input.mobile ?? false);
  return render(
    <AdminHubAddMenu
      stage={input.stage ?? 'requested'}
      capabilities={input.capabilities ?? caps()}
      canAddShop={input.canAddShop ?? true}
      tone={input.tone}
    />,
  );
}

beforeEach(() => {
  stubMatchMedia(false);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminHubAddMenu', () => {
  it('renders website and shop items with the right hrefs', () => {
    renderMenu();
    fireEvent.click(screen.getByTestId('admin-hub-add'));
    expect(screen.getByRole('menu', { name: 'Add to your website or shop' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Shop photos/ }).getAttribute('href')).toBe(
      '/admin?app=materials&item=photos',
    );
    expect(screen.getByRole('menuitem', { name: /Logo/ }).getAttribute('href')).toBe(
      '/admin?app=materials&item=logo',
    );
    expect(screen.getByRole('menuitem', { name: /Text for your website/ }).getAttribute('href')).toBe(
      '/admin?app=materials&item=text',
    );
    expect(screen.getByRole('menuitem', { name: /Team photos/ }).getAttribute('href')).toBe(
      '/admin?app=materials&item=team-photos',
    );
    expect(screen.getByRole('menuitem', { name: /Price list/ }).getAttribute('href')).toBe(
      '/admin?app=materials&item=price-list',
    );
    expect(screen.getByRole('menuitem', { name: /Other files/ }).getAttribute('href')).toBe(
      '/admin?app=materials&item=other',
    );
    expect(screen.getByRole('menuitem', { name: /Team member/ }).getAttribute('href')).toBe('/admin/team?add=1');
    expect(screen.getByRole('menuitem', { name: /Service/ }).getAttribute('href')).toBe('/admin/services?add=1');
    expect(screen.getByRole('menuitem', { name: /Product/ }).getAttribute('href')).toBe('/admin/products?add=1');
    expect(screen.getByText('Your website')).toBeTruthy();
    expect(screen.getByText('Your shop')).toBeTruthy();
  });

  it('hides website or shop groups by capability and does not render when empty', () => {
    const { rerender } = renderMenu({
      capabilities: caps({ canUpload: false, canEditDetails: false }),
      canAddShop: false,
    });
    expect(screen.queryByTestId('admin-hub-add')).toBeNull();

    rerender(
      <AdminHubAddMenu
        stage="launch"
        capabilities={caps({ canUpload: true, canEditDetails: false })}
        canAddShop={false}
      />,
    );
    fireEvent.click(screen.getByTestId('admin-hub-add'));
    expect(screen.getByRole('menuitem', { name: /Shop photos/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Text for your website/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Service/ })).toBeNull();
  });

  it('uses a primary Add on requested and an outline Add on review', () => {
    const { rerender } = renderMenu({ stage: 'requested', tone: 'primary' });
    expect(screen.getByTestId('admin-hub-add').className).toContain('btn--primary');
    rerender(
      <AdminHubAddMenu stage="review" capabilities={caps()} canAddShop tone="outline" />,
    );
    expect(screen.getByTestId('admin-hub-add').className).toContain('btn--outline');
  });

  it('moves with arrow keys and Home/End', async () => {
    renderMenu();
    const trigger = screen.getByTestId('admin-hub-add');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const first = await screen.findByRole('menuitem', { name: /Shop photos/ });
    await waitFor(() => expect(document.activeElement).toBe(first));
    fireEvent.keyDown(screen.getByTestId('admin-hub-add-menu'), { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Product/ }));
    fireEvent.keyDown(screen.getByTestId('admin-hub-add-menu'), { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(screen.getByTestId('admin-hub-add-menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Logo/ }));
  });

  it('returns focus to the trigger on Escape', () => {
    renderMenu();
    const trigger = screen.getByTestId('admin-hub-add');
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders a bottom sheet on mobile', () => {
    renderMenu({ mobile: true });
    fireEvent.click(screen.getByTestId('admin-hub-add'));
    expect(screen.getByTestId('admin-hub-add-sheet')).toBeTruthy();
    expect(screen.getByTestId('admin-hub-add-sheet').className).toContain('admin-hub-app--sheet');
    expect(screen.getByRole('menuitem', { name: /Shop photos/ })).toBeTruthy();
  });

  it('fires allowlisted hub events without extra fields', async () => {
    renderMenu();
    fireEvent.click(screen.getByTestId('admin-hub-add'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin-hub/event',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'hub_add_menu_open' }),
      }),
    );
    const service = screen.getByRole('menuitem', { name: /Service/ });
    service.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(service);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin-hub/event',
        expect.objectContaining({
          body: JSON.stringify({ name: 'hub_add_menu_item', item: 'service' }),
        }),
      ),
    );
  });

  it('renders an inline Add text button that opens the same menu', () => {
    render(
      <AdminHubAddMenu
        stage="review"
        capabilities={caps()}
        canAddShop
        variant="inline"
      />,
    );
    const trigger = screen.getByTestId('admin-hub-add-inline');
    expect(trigger.textContent).toBe('Add');
    expect(trigger.className).toContain('btn--ghost');
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: /Shop photos/ }).getAttribute('href')).toBe(
      '/admin?app=materials&item=photos',
    );
  });

  it('falls back to the materials app when the inline menu is empty', () => {
    render(
      <AdminHubAddMenu
        stage="launch"
        capabilities={caps({ canUpload: false, canEditDetails: false })}
        canAddShop={false}
        variant="inline"
      />,
    );
    const fallback = screen.getByRole('link', { name: 'Add' });
    expect(fallback.getAttribute('href')).toBe('/admin?app=materials');
  });

  it('has popup semantics on the trigger', () => {
    renderMenu();
    const trigger = screen.getByTestId('admin-hub-add');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(screen.getByTestId('admin-hub-add-menu').id);
  });
});
