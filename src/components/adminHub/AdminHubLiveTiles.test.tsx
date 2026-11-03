/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetHubStoreForTests, refreshHubState } from '@/lib/adminHub/hubStore';
import type { AdminHubLiveState } from '@/lib/adminHub/liveState';
import {
  ADMIN_HUB_COLOURS_NONE,
  ADMIN_HUB_CONTENT_DONE,
  ADMIN_HUB_CONTENT_EMPTY,
  ADMIN_HUB_OVERVIEW_UPDATED,
} from '@/lib/adminHub/copy';
import { AdminHubColoursTile } from './AdminHubColoursTile';
import { AdminHubContentTile } from './AdminHubContentTile';
import { AdminHubOverviewAnnouncer } from './AdminHubOverviewAnnouncer';
import { AdminHubPreviewPhone } from './AdminHubPreviewPhone';
import type { HubCapabilities } from '@/lib/freePreview/hubStage';

const capabilities = { canUpload: true, canEditDetails: true } as unknown as HubCapabilities;

function asset(id: string, kind: string, createdAt = '2026-11-01T10:00:00.000Z') {
  return {
    id,
    kind,
    originalFileName: `${id}.png`,
    contentType: 'image/png',
    sizeBytes: 10,
    width: 100,
    height: 100,
    caption: null,
    sortOrder: 0,
    barberId: null,
    uploadedBy: 'OWNER',
    createdAt,
    hasThumb: true,
  } as AdminHubLiveState['assets'][number];
}

const empty: AdminHubLiveState = {
  assets: [],
  details: { brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null },
  currentLogo: null,
};

const withLogo: AdminHubLiveState = {
  assets: [asset('logo_1', 'LOGO'), asset('photo_1', 'SHOP_PHOTO')],
  details: {
    brandPrimaryColour: '#1F6F6B',
    brandSecondaryColour: null,
    styleNotes: null,
    aboutText: 'We cut hair.',
    brandColoursSentAt: '2026-11-02T10:00:00.000Z',
    brandLocked: true,
  },
  currentLogo: { id: 'logo_1', src: '/api/admin-hub/assets/logo_1?size=thumb' },
};

function matchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
}

async function pushState(next: AdminHubLiveState) {
  __resetHubStoreForTests({
    seed: empty,
    fetcher: async () => new Response(JSON.stringify({ ok: true, state: next })),
  });
}

beforeEach(() => {
  matchMedia();
  __resetHubStoreForTests();
});
afterEach(() => {
  cleanup();
  __resetHubStoreForTests();
});

describe('Overview live tiles', () => {
  it('server-render from the seeded state with the same hooks the Overview CSS and tests use', () => {
    const content = renderToString(<AdminHubContentTile initialState={empty} stage="requested" capabilities={capabilities} />);
    expect(content).toContain('data-testid="admin-hub-content-tile"');
    expect(content).toContain('data-tile="content"');
    expect(content).toContain(`<div class="admin-hub-content-empty"><p>${ADMIN_HUB_CONTENT_EMPTY.replace(/'/g, '&#x27;')}</p></div>`);

    const colours = renderToString(<AdminHubColoursTile initialState={empty} shopName="Fade Room" />);
    expect(colours).toMatch(/^<a class="admin-hub-tile admin-hub-bento__colours" data-tile="colours" href="\/admin\?app=colours"/);
    expect(colours).toContain('FR');
    expect(colours).toContain(ADMIN_HUB_COLOURS_NONE.replace(/'/g, '&#x27;'));

    const phone = renderToString(<AdminHubPreviewPhone initialState={withLogo} shopName="Fade Room" />);
    expect(phone).toContain('admin-hub-phone__logo');
    expect(phone).toContain('background:#1F6F6B');
  });

  it('update after the store refreshes, without remounting', async () => {
    await pushState(withLogo);
    render(
      <div>
        <AdminHubContentTile initialState={empty} stage="requested" capabilities={capabilities} />
        <AdminHubColoursTile initialState={empty} shopName="Fade Room" />
        <AdminHubPreviewPhone initialState={empty} shopName="Fade Room" />
        <AdminHubOverviewAnnouncer />
      </div>,
    );
    const tile = screen.getByTestId('admin-hub-content-tile');
    expect(tile.querySelector('.admin-hub-content-empty')).toBeTruthy();
    expect(document.querySelector('.admin-hub-phone__initials')?.textContent).toBe('FR');

    await act(async () => {
      await refreshHubState();
    });

    expect(screen.getByTestId('admin-hub-content-tile')).toBe(tile);
    const logoRow = tile.querySelector('[data-content-item="logo"]');
    expect(logoRow?.textContent).toContain(ADMIN_HUB_CONTENT_DONE);
    const thumb = tile.querySelector('[data-testid="admin-hub-content-photos"] li');
    expect(thumb?.className).toBe('admin-hub-photo admin-hub-thumb--new');
    expect(tile.querySelector('[data-testid="admin-hub-content-logo"] img')?.getAttribute('src')).toBe(
      '/api/admin-hub/assets/logo_1?size=thumb',
    );
    expect(document.querySelector('.admin-hub-logo-mini__mark img')?.getAttribute('src')).toBe(
      '/api/admin-hub/assets/logo_1?size=thumb',
    );
    expect(screen.getByTestId('admin-hub-colours-status').textContent).toMatch(/sent/i);
    expect(document.querySelector('.admin-hub-phone__logo')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('admin-hub-overview-live').textContent).toBe(ADMIN_HUB_OVERVIEW_UPDATED));
  });

  it('keeps the colours tile keyboard-operable with Space', () => {
    render(<AdminHubColoursTile initialState={empty} shopName="Fade Room" />);
    const link = document.querySelector('a[data-tile="colours"]') as HTMLAnchorElement;
    const click = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener('click', click);
    link.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(click).toHaveBeenCalledTimes(1);
  });
});
