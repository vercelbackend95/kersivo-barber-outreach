/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractFromLogoUrl } from '@/lib/adminHub/colour/runExtract';
import ColoursApp from './ColoursApp';
import { AppChromeProvider, emptyAppChrome, type AdminHubAppChrome } from './AppChrome';
import type { AdminHubAppContext } from './types';

vi.mock('@/lib/adminHub/colour/runExtract', () => ({
  extractFromLogoUrl: vi.fn().mockResolvedValue([]),
  logoDisplayUrl: (_apiBase: string, asset: { id: string }) => `/api/admin-hub/assets/${asset.id}?size=thumb`,
}));

const palette = [
  { hex: '#1F6F6B', share: 0.42 },
  { hex: '#C9A24A', share: 0.28 },
  { hex: '#141414', share: 0.18 },
  { hex: '#F2E8D5', share: 0.12 },
];

function ctx(overrides: Partial<AdminHubAppContext> = {}): AdminHubAppContext {
  return {
    apiBase: '/api/admin-hub',
    canUpload: true,
    canEditDetails: true,
    canReview: true,
    canEditLaunch: false,
    stage: 'review',
    details: {
      brandPrimaryColour: '#1F6F6B',
      brandSecondaryColour: '#C9A24A',
      styleNotes: null,
      aboutText: null,
      brandBackgroundTone: 'DARK',
      brandColoursSource: 'LOGO',
      brandPaletteExtracted: palette,
      brandColoursSentAt: null,
      brandLocked: false,
    },
    assets: [],
    reviews: { SERVICES: null, TEAM: null, HOURS: null },
    reviewShop: {
      shopId: 'shop_1',
      services: [
        { id: 's1', name: 'Skin fade', durationMinutes: 45, pricePence: 2200 },
        { id: 's2', name: 'Beard trim', durationMinutes: 20, pricePence: 1500 },
      ],
      barbers: [],
      hours: [],
    },
    activity: [],
    setupItems: [],
    messages: [],
    initialDraft: '',
    viewer: 'owner',
    canAttach: true,
    shopName: 'Hub QA Ready',
    websiteHref: '/admin/website',
    bookingHref: '/admin/website?view=booking',
    launch: null,
    ...overrides,
  } as AdminHubAppContext;
}

function Harness({ overrides = {} }: { overrides?: Partial<AdminHubAppContext> }) {
  const [chrome, setChrome] = useState<AdminHubAppChrome>(emptyAppChrome);
  return (
    <AppChromeProvider setChrome={setChrome}>
      <ColoursApp ctx={ctx(overrides)} />
      <div data-testid="admin-hub-colours-chrome">
        {chrome.headerAction}
        {chrome.footer}
      </div>
    </AppChromeProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function lastBody() {
  const fn = fetch as unknown as ReturnType<typeof vi.fn>;
  return JSON.parse(fn.mock.calls[0][1].body as string);
}

describe('ColoursApp', () => {
  it('renders roles, extracted swatches and the live preview', () => {
    render(<Harness />);
    expect(screen.getByTestId('admin-hub-colours')).toBeTruthy();
    expect(screen.getByText('Found in your logo')).toBeTruthy();
    expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Accent').length).toBeGreaterThan(0);
    expect(screen.getByText('Fine-tune main colour')).toBeTruthy();
    expect(screen.getByText('How it looks on your site')).toBeTruthy();
    expect(screen.getAllByText('Hub QA Ready').length).toBeGreaterThan(0);
    expect(screen.getByText('Skin fade')).toBeTruthy();
    expect(screen.getAllByText('Text on your buttons is easy to read').length).toBeGreaterThan(0);
  });

  it('assigns a clicked swatch to the selected role', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('admin-hub-role-accent'));
    fireEvent.click(screen.getByTestId('admin-hub-swatch-141414'));
    expect(screen.getByTestId('admin-hub-role-accent').textContent).toContain('#141414');
  });

  it('applies a typed hex as a manual colour', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '# Hex' }));
    fireEvent.change(screen.getByLabelText('Hex'), { target: { value: '#22aa88' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#22AA88');
  });

  it('exposes slider valuetext and changes depth', () => {
    render(<Harness />);
    const depth = screen.getByRole('slider', { name: /Depth/i });
    expect(depth.getAttribute('aria-valuetext')).toMatch(/^Depth \d+%$/);
    fireEvent.change(depth, { target: { value: '80' } });
    expect(depth.getAttribute('aria-valuetext')).toBe('Depth 80%');
  });

  it('saves a draft without marking it sent', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({
      send: false,
      brandPrimaryColour: '#1F6F6B',
      brandColoursSource: 'LOGO',
    });
  });

  it('opens a confirmation dialog before sending', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Send colours to KERSIVO' }));
    expect(fetch).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Send your logo and colours to KERSIVO?' });
    expect(dialog.textContent).toContain("Once sent, your logo and brand colours are locked");
    expect(dialog.textContent).toContain('#1F6F6B');
    expect(dialog.textContent).toContain('#C9A24A');
    fireEvent.click(screen.getByRole('button', { name: 'Go back and review' }));
    expect(screen.queryByRole('dialog', { name: 'Send your logo and colours to KERSIVO?' })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send colours to KERSIVO' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Send your logo and colours to KERSIVO?' })).toBeNull();
  });

  it('sends colours after confirm and shows the locked notice', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        colours: { brandLocked: true, brandColoursSentAt: '2026-11-02T12:00:00.000Z' },
      }),
    } as Response);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Send colours to KERSIVO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send to KERSIVO' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Sent to KERSIVO on 2 November 2026. Your logo and colours are locked while we build your site. Need a change?',
      ),
    );
    expect(lastBody()).toMatchObject({ send: true });
    expect(screen.getByRole('link', { name: 'Message us' }).getAttribute('href')).toBe('/admin/messages');
    expect(screen.queryByRole('button', { name: 'Send colours to KERSIVO' })).toBeNull();
    expect(screen.queryByRole('slider', { name: /Depth/i })).toBeNull();
  });

  it('disables both confirm buttons while sending', async () => {
    let finish: (value: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Send colours to KERSIVO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send to KERSIVO' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sending…' })).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Go back and review' }) as HTMLButtonElement).disabled).toBe(true);
    finish({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        colours: { brandLocked: true, brandColoursSentAt: '2026-11-02T12:00:00.000Z' },
      }),
    } as Response);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sent to KERSIVO on 2 November 2026'));
  });

  it('sends Let KERSIVO choose after confirm with that source', async () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Let KERSIVO choose' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send to KERSIVO' }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({
      send: true,
      brandColoursSource: 'KERSIVO_CHOOSES',
    });
  });

  it('shows a retryable error in the confirm dialog when send fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: 'Could not save. Try again.' }),
    } as Response);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Send colours to KERSIVO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send to KERSIVO' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not save. Try again.'));
    const yes = screen.getByRole('button', { name: 'Yes, send to KERSIVO' }) as HTMLButtonElement;
    const back = screen.getByRole('button', { name: 'Go back and review' }) as HTMLButtonElement;
    expect(yes.disabled).toBe(false);
    expect(back.disabled).toBe(false);
  });

  it('locks the view on 409 BRAND_LOCKED instead of showing a generic error', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/brand-colours')) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            ok: false,
            code: 'BRAND_LOCKED',
            submittedAt: '2026-11-02T12:00:00.000Z',
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          details: {
            brandPrimaryColour: '#1F6F6B',
            brandSecondaryColour: '#C9A24A',
            brandColoursSentAt: '2026-11-02T12:00:00.000Z',
          },
        }),
      } as Response;
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Send colours to KERSIVO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send to KERSIVO' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Sent to KERSIVO on 2 November 2026'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send colours to KERSIVO' })).toBeNull();
  });

  it('renders a read-only locked view when colours were already sent', () => {
    render(
      <Harness
        overrides={{
          details: {
            brandPrimaryColour: '#1F6F6B',
            brandSecondaryColour: '#C9A24A',
            styleNotes: null,
            aboutText: null,
            brandBackgroundTone: 'DARK',
            brandColoursSource: 'LOGO',
            brandPaletteExtracted: palette,
            brandColoursSentAt: '2026-11-02T12:00:00.000Z',
            brandLocked: true,
          },
        }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Sent to KERSIVO on 2 November 2026');
    expect(screen.queryByRole('button', { name: 'Send colours to KERSIVO' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upload logo' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Upload logo' })).toBeNull();
    expect(screen.queryByRole('slider', { name: /Depth/i })).toBeNull();
    expect((screen.getAllByRole('button', { name: /Teal/i })[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers Make it deeper when the accent fails contrast', async () => {
    render(
      <Harness
        overrides={{
          details: {
            brandPrimaryColour: '#1F6F6B',
            brandSecondaryColour: '#7A7A7A',
            styleNotes: null,
            aboutText: null,
            brandBackgroundTone: 'DARK',
            brandColoursSource: 'MANUAL',
            brandPaletteExtracted: palette,
            brandColoursSentAt: null,
            brandLocked: false,
          },
        }}
      />,
    );
    expect(screen.getAllByText('Hard to read on buttons').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Make it deeper' })[0]!);
    await waitFor(() => expect(screen.queryAllByText('Hard to read on buttons')).toHaveLength(0));
    expect(screen.getAllByText('Text on your buttons is easy to read').length).toBeGreaterThan(0);
  });

  it('locks controls when the stage cannot edit details', () => {
    render(<Harness overrides={{ canEditDetails: false }} />);
    expect((screen.getByRole('slider', { name: /Depth/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getAllByRole('button', { name: /Teal/i })[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a no-logo placeholder and upload action when no logo is uploaded', () => {
    render(<Harness />);
    expect(screen.getAllByText('No logo uploaded yet').length).toBeGreaterThan(0);
    const upload = screen.getAllByRole('link', { name: 'Upload logo' });
    expect(upload.length).toBeGreaterThan(0);
    expect(upload[0]!.getAttribute('href')).toBe('/admin?app=materials&item=logo');
  });

  it('shows the selected logo in the mobile preview and desktop pair', () => {
    render(
      <Harness
        overrides={{
          assets: [
            {
              id: 'logo_1',
              kind: 'LOGO',
              originalFileName: 'logo.png',
              contentType: 'image/png',
              sizeBytes: 8,
              width: 120,
              height: 80,
              caption: null,
              sortOrder: 0,
              barberId: null,
              uploadedBy: 'OWNER',
              createdAt: '2026-11-01T12:00:00.000Z',
              hasThumb: true,
            },
          ],
        }}
      />,
    );
    const mobile = screen.getByTestId('admin-hub-colours-logo').querySelector('img');
    expect(mobile?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_1?size=thumb');
    expect(document.querySelectorAll('.admin-hub-logo-pair img')).toHaveLength(2);
    expect(screen.queryByText('No logo uploaded yet')).toBeNull();
  });

  it('shows and extracts from the newest logo, not the first in the list', async () => {
    render(
      <Harness
        overrides={{
          assets: [
            {
              id: 'logo_old',
              kind: 'LOGO',
              originalFileName: 'old.png',
              contentType: 'image/png',
              sizeBytes: 8,
              width: 120,
              height: 80,
              caption: null,
              sortOrder: 0,
              barberId: null,
              uploadedBy: 'OWNER',
              createdAt: '2026-11-01T10:00:00.000Z',
              hasThumb: true,
            },
            {
              id: 'logo_new',
              kind: 'LOGO',
              originalFileName: 'new.png',
              contentType: 'image/png',
              sizeBytes: 8,
              width: 120,
              height: 80,
              caption: null,
              sortOrder: 1,
              barberId: null,
              uploadedBy: 'OWNER',
              createdAt: '2026-11-01T12:00:00.000Z',
              hasThumb: true,
            },
          ],
        }}
      />,
    );
    const mobile = screen.getByTestId('admin-hub-colours-logo').querySelector('img');
    expect(mobile?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_new?size=thumb');
    await waitFor(() => {
      expect(extractFromLogoUrl).toHaveBeenCalledWith('/api/admin-hub/assets/logo_new?size=thumb');
    });
  });

  it('shows the snapshot logo after brand lock even if a newer file is in the list', () => {
    render(
      <Harness
        overrides={{
          details: {
            brandPrimaryColour: '#1F6F6B',
            brandSecondaryColour: '#C9A24A',
            styleNotes: null,
            aboutText: null,
            brandBackgroundTone: 'DARK',
            brandColoursSource: 'LOGO',
            brandPaletteExtracted: palette,
            brandColoursSentAt: '2026-11-02T12:00:00.000Z',
            brandLocked: true,
            snapshotLogoAssetId: 'logo_old',
          },
          assets: [
            {
              id: 'logo_old',
              kind: 'LOGO',
              originalFileName: 'old.png',
              contentType: 'image/png',
              sizeBytes: 8,
              width: 120,
              height: 80,
              caption: null,
              sortOrder: 0,
              barberId: null,
              uploadedBy: 'OWNER',
              createdAt: '2026-11-01T10:00:00.000Z',
              hasThumb: true,
            },
            {
              id: 'logo_new',
              kind: 'LOGO',
              originalFileName: 'new.png',
              contentType: 'image/png',
              sizeBytes: 8,
              width: 120,
              height: 80,
              caption: null,
              sortOrder: 1,
              barberId: null,
              uploadedBy: 'OWNER',
              createdAt: '2026-11-01T12:00:00.000Z',
              hasThumb: true,
            },
          ],
        }}
      />,
    );
    const mobile = screen.getByTestId('admin-hub-colours-logo').querySelector('img');
    expect(mobile?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_old?size=thumb');
  });
});
