/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHost } from './AppHost';
import { __resetHubStoreForTests } from '@/lib/adminHub/hubStore';
import { emitHubDataChanged, type AdminHubLiveState } from '@/lib/adminHub/liveState';
import { showHubToast } from '@/lib/adminHub/hubToast';
import type { AdminHubAppBodyProps } from './apps/types';
import type { AdminHubAppContext } from './apps/types';

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

const ctx = {
  apiBase: '/api/admin-hub',
  canUpload: true,
  canEditDetails: true,
  canReview: true,
  canEditLaunch: false,
  stage: 'review',
  details: { brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null },
  assets: [],
  reviews: { SERVICES: null, TEAM: null, HOURS: null },
  reviewShop: null,
  activity: [],
  setupItems: [],
  messages: [],
  initialDraft: '',
  viewer: 'owner',
  canAttach: true,
  shopName: 'Test Shop',
  websiteHref: '/admin/website',
  bookingHref: '/admin/website?view=booking',
  launch: null,
} as unknown as AdminHubAppContext;

function StubApp() {
  return <p>Logo body</p>;
}

async function loadStub() {
  return { default: StubApp };
}

function renderHost(initialApp: 'logo' | 'materials' | null = 'logo') {
  return render(
    <div className="admin-shell">
      <a href="/admin?app=logo">Open logo</a>
      <a href="/admin?app=materials&item=photos">Shop photos</a>
      <a href="/admin?app=about">Open about</a>
      <button type="button" data-admin-hub-app="materials">
        Add to your website
      </button>
      <AppHost initialApp={initialApp} ctx={ctx} loadApp={loadStub} />
    </div>,
  );
}

beforeEach(() => {
  __resetHubStoreForTests();
  stubMatchMedia(false);
  window.history.replaceState(null, '', '/admin');
});

afterEach(() => {
  cleanup();
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  vi.unstubAllGlobals();
});

describe('AppHost', () => {
  it('keeps one polite toast region mounted while apps open and close', async () => {
    renderHost('logo');
    await waitFor(() => expect(screen.getByText('Logo body')).toBeTruthy());
    const region = screen.getByTestId('admin-hub-toast');
    expect(region.getAttribute('role')).toBe('status');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('Logo body')).toBeNull());
    expect(screen.getByTestId('admin-hub-toast')).toBe(region);
    showHubToast('Draft saved');
    await waitFor(() => expect(region.textContent).toBe('Draft saved'));
  });

  it('opens from ?app= with a labelled modal and returns focus on close', async () => {
    renderHost(null);
    const opener = screen.getByRole('link', { name: 'Open logo' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Logo' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Logo body')).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.popState(window);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('closes from a deep-linked ?app= with Escape and no extra history entry', async () => {
    window.history.replaceState(null, '', '/admin?app=logo');
    renderHost('logo');
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(new URL(window.location.href).searchParams.get('app')).toBeNull();
  });

  it('closes on the back button after a history entry per open', async () => {
    renderHost(null);
    fireEvent.click(screen.getByRole('link', { name: 'Open logo' }));
    await screen.findByRole('dialog');
    expect(new URL(window.location.href).searchParams.get('app')).toBe('logo');
    window.history.back();
    fireEvent.popState(window);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens from a data-admin-hub-app button and returns focus on close', async () => {
    renderHost(null);
    const opener = screen.getByRole('button', { name: 'Add to your website' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toContain('admin-hub-app--window');
    expect(screen.getByRole('heading', { name: 'Add to your website' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.popState(window);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('opens the materials app as a full-screen sheet below 640px', async () => {
    stubMatchMedia(true);
    window.history.replaceState(null, '', '/admin?app=materials');
    renderHost('materials');
    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toContain('admin-hub-app--sheet');
    expect(dialog.className).toContain('admin-hub-app--fullscreen');
  });

  it('rewrites ?app=about to materials on the text card', async () => {
    renderHost(null);
    fireEvent.click(screen.getByRole('link', { name: 'Open about' }));
    await screen.findByRole('dialog');
    expect(new URL(window.location.href).searchParams.get('app')).toBe('materials');
    expect(new URL(window.location.href).searchParams.get('item')).toBe('text');
    expect(screen.getByRole('heading', { name: 'Add to your website' })).toBeTruthy();
  });

  it('keeps item= on materials links so the app can focus that block', async () => {
    renderHost(null);
    fireEvent.click(screen.getByRole('link', { name: 'Shop photos' }));
    await screen.findByRole('dialog');
    expect(new URL(window.location.href).searchParams.get('app')).toBe('materials');
    expect(new URL(window.location.href).searchParams.get('item')).toBe('photos');
  });

  it('returns focus to the Add trigger when the menu item that opened the app unmounts', async () => {
    function MenuHost() {
      const [open, setOpen] = useState(true);
      return (
        <div className="admin-shell">
          <button
            type="button"
            data-testid="admin-hub-add"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="add-menu"
          >
            Add
          </button>
          {open ? (
            <div id="add-menu" role="menu" aria-label="Add to your website or shop">
              <a
                role="menuitem"
                href="/admin?app=materials&item=photos"
                onClick={() => queueMicrotask(() => setOpen(false))}
              >
                Shop photos
              </a>
            </div>
          ) : null}
          <AppHost initialApp={null} ctx={ctx} loadApp={loadStub} />
        </div>
      );
    }

    render(<MenuHost />);
    const item = screen.getByRole('menuitem', { name: 'Shop photos' });
    item.focus();
    fireEvent.click(item);
    await screen.findByRole('dialog');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Shop photos' })).toBeNull());

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.popState(window);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId('admin-hub-add'));
  });

  it('returns focus to the Website content "+" and no longer targets the removed empty-state button', async () => {
    function MenuHost() {
      const [open, setOpen] = useState(true);
      return (
        <div className="admin-shell">
          <button type="button" data-testid="admin-hub-content-add">
            Add to your website
          </button>
          <button
            type="button"
            data-testid="admin-hub-add-inline"
            aria-label="Add"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="add-menu"
          >
            +
          </button>
          {open ? (
            <div id="add-menu" role="menu" aria-label="Add to your website or shop">
              <a
                role="menuitem"
                href="/admin?app=materials&item=photos"
                onClick={() => queueMicrotask(() => setOpen(false))}
              >
                Shop photos
              </a>
            </div>
          ) : null}
          <AppHost initialApp={null} ctx={ctx} loadApp={loadStub} />
        </div>
      );
    }

    render(<MenuHost />);
    const item = screen.getByRole('menuitem', { name: 'Shop photos' });
    item.focus();
    fireEvent.click(item);
    await screen.findByRole('dialog');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Shop photos' })).toBeNull());

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.popState(window);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId('admin-hub-add-inline'));
  });

  it('traps tab inside the window', async () => {
    renderHost('logo');
    const dialog = await screen.findByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
  });

  it('renders the app root as a child of document.body', async () => {
    renderHost('logo');
    const dialog = await screen.findByRole('dialog');
    expect(dialog.closest('.admin-hub-app-root')?.parentElement).toBe(document.body);
  });

  it('opens from a portaled [data-admin-hub-item] link on document.body', async () => {
    renderHost(null);
    render(
      createPortal(
        <a href="/admin?app=colours" data-admin-hub-item="logo" data-testid="portaled-add">
          Brand colours
        </a>,
        document.body,
      ),
    );
    fireEvent.click(screen.getByTestId('portaled-add'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('data-app')).toBe('colours');
    expect(new URL(window.location.href).searchParams.get('app')).toBe('colours');
    expect(dialog.closest('.admin-hub-app-root')?.parentElement).toBe(document.body);
  });

  it('opens the next app with fresh hub data after a change, with one state request per close', async () => {
    const fresh: AdminHubLiveState = {
      assets: [
        {
          id: 'logo_1',
          kind: 'LOGO',
          originalFileName: 'logo.png',
          contentType: 'image/png',
          sizeBytes: 10,
          width: 100,
          height: 100,
          caption: null,
          sortOrder: 0,
          barberId: null,
          uploadedBy: 'OWNER',
          createdAt: '2026-11-01T10:00:00.000Z',
          hasThumb: true,
        },
      ],
      details: { brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: 'New text' },
      currentLogo: { id: 'logo_1', src: '/api/admin-hub/assets/logo_1?size=thumb' },
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, state: fresh })));
    __resetHubStoreForTests({ fetcher, seed: { assets: [], details: ctx.details, currentLogo: null } });
    const seen: string[] = [];
    function CountingApp({ ctx: appCtx }: AdminHubAppBodyProps) {
      seen.push(`${appCtx.assets.length}:${appCtx.details.aboutText ?? ''}`);
      return <p>Counting body</p>;
    }
    render(
      <div>
        <a href="/admin?app=logo">Open logo</a>
        <AppHost initialApp={null} ctx={ctx} loadApp={async () => ({ default: CountingApp })} />
      </div>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Open logo' }));
    await screen.findByText('Counting body');
    expect(seen.at(-1)).toBe('0:');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(new URL(window.location.href).searchParams.get('app')).toBeNull());
    expect(fetcher).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'Open logo' }));
    await screen.findByText('Counting body');
    emitHubDataChanged('asset-added');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(new URL(window.location.href).searchParams.get('app')).toBeNull());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    seen.length = 0;
    fireEvent.click(screen.getByRole('link', { name: 'Open logo' }));
    await waitFor(() => expect(seen.at(-1)).toBe('1:New text'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
