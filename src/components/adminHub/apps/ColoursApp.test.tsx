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

vi.mock('@/lib/adminHub/hubStore', () => ({ refreshHubState: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/adminHub/hubToast', () => ({ showHubToast: vi.fn() }));
vi.mock('@/lib/adminHub/colour/runExtract', () => ({
  extractFromLogoUrl: vi.fn().mockResolvedValue([]),
  logoDisplayUrl: (_apiBase: string, asset: { id: string }) => `/api/admin-hub/assets/${asset.id}?size=thumb`,
}));

function logoAsset(id: string, createdAt = '2026-11-01T12:00:00.000Z') {
  return {
    id,
    kind: 'LOGO',
    originalFileName: `${id}.png`,
    contentType: 'image/png',
    sizeBytes: 8,
    width: 120,
    height: 80,
    caption: null,
    sortOrder: 0,
    barberId: null,
    uploadedBy: 'OWNER',
    createdAt,
    hasThumb: true,
  } as AdminHubAppContext['assets'][number];
}

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
    const contrast = screen.getAllByTestId('admin-hub-colours-contrast');
    expect(contrast).toHaveLength(1);
    expect(contrast[0]!.textContent).toMatch(/Button text on accent — \d+\.\d:1 ✓/);
    expect(contrast[0]!.textContent).toMatch(/Main colour on background — \d+\.\d:1 ✓/);
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

  it('exposes slider valuetext in words and changes depth', async () => {
    render(<Harness />);
    const depth = screen.getByRole('slider', { name: /Depth/i });
    expect(depth.getAttribute('aria-valuetext')).toMatch(/^(Deeper|Lighter), \d+ %$/);
    fireEvent.change(depth, { target: { value: '80' } });
    await waitFor(() => expect(depth.getAttribute('aria-valuetext')).toMatch(/^Deeper, (79|80|81) %$/));
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
    for (const link of screen.getAllByRole('link', { name: 'Message us' })) {
      expect(link.getAttribute('href')).toBe('/admin/messages');
    }
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
    // Read-only summary: no editing controls at all, a copy button per hex.
    expect(screen.queryByRole('button', { name: /Teal/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Swap main and accent' })).toBeNull();
    const summary = screen.getByTestId('admin-hub-colours-sent');
    expect(summary.textContent).toContain('#1F6F6B');
    expect(summary.textContent).toContain('#C9A24A');
    expect(summary.textContent).toContain('Dark');
    expect(summary.textContent).toContain('2 November 2026');
    expect(screen.getByRole('button', { name: 'Copy #1F6F6B' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy #141414' })).toBeTruthy();
  });

  it('offers Make accent deeper when button text fails, and re-checks both lines', async () => {
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
    const line = () => document.querySelector('[data-line="button"]')!;
    expect(line().getAttribute('data-pass')).toBe('false');
    expect(line().textContent).toMatch(/^Button text on accent — \d\.\d:1 ✗/);
    fireEvent.click(screen.getByRole('button', { name: 'Make accent deeper' }));
    await waitFor(() => expect(line().getAttribute('data-pass')).toBe('true'));
    expect(document.querySelector('[data-line="main"]')!.getAttribute('data-pass')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Make / })).toBeNull();
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

  it('shows the selected logo once, in the Your logo panel', () => {
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
    const mobile = screen.getByTestId('admin-hub-colours-logo');
    expect(mobile?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_1?size=thumb');
    // Exactly one copy of the logo (O7): no top preview, no dark/light pair.
    expect(document.querySelectorAll('img[src="/api/admin-hub/assets/logo_1?size=thumb"]')).toHaveLength(1);
    expect(document.querySelector('.admin-hub-logo-pair')).toBeNull();
    expect(screen.queryByText('No logo uploaded yet')).toBeNull();
  });

  it('shows and extracts from the newest logo, not the first in the list', async () => {
    render(
      <Harness
        overrides={{
          details: { ...ctx().details, brandPrimaryColour: null, brandSecondaryColour: null, brandPaletteExtracted: null },
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
    const mobile = screen.getByTestId('admin-hub-colours-logo');
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
    const mobile = screen.getByTestId('admin-hub-colours-logo');
    expect(mobile?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_old?size=thumb');
  });
});

describe('ColoursApp (O5)', () => {
  const base = () => ctx().details;
  const swatchHexes = () =>
    [...document.querySelectorAll('.admin-hub-extract__row')].map((row) =>
      row.getAttribute('data-testid')!.replace('admin-hub-swatch-', '#'),
    );

  beforeEach(() => {
    vi.mocked(extractFromLogoUrl).mockReset();
    vi.mocked(extractFromLogoUrl).mockResolvedValue([]);
  });

  it('shows the saved palette instantly and does not re-extract for the same logo', async () => {
    render(
      <Harness
        overrides={{
          details: { ...base(), brandPaletteExtracted: [...palette, { hex: '#22AA88', share: 0 }], brandPaletteLogoAssetId: 'logo_1' },
          assets: [logoAsset('logo_1')],
        }}
      />,
    );
    expect(swatchHexes()).toEqual(['#1F6F6B', '#C9A24A', '#141414', '#F2E8D5', '#22AA88']);
    expect(screen.queryByRole('button', { name: 'Find colours again' })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(extractFromLogoUrl).not.toHaveBeenCalled();
    expect(document.querySelector('.hub-skel')).toBeNull();
  });

  it('offers Find colours again after a new logo and merges instead of overwriting', async () => {
    const { swatchFromHex } = await import('@/lib/adminHub/colour');
    vi.mocked(extractFromLogoUrl).mockResolvedValue([swatchFromHex('#8A2D2D', 0.6)!, swatchFromHex('#1F6F6B', 0.4)!]);
    render(
      <Harness
        overrides={{
          details: {
            ...base(),
            brandPrimaryColour: '#22AA88',
            brandPaletteExtracted: [...palette, { hex: '#22AA88', share: 0 }],
            brandPaletteLogoAssetId: 'logo_old',
          },
          assets: [logoAsset('logo_new')],
        }}
      />,
    );
    expect(extractFromLogoUrl).not.toHaveBeenCalled();
    expect(screen.getByText('You have a new logo. Find its colours?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Find colours again' }));
    await waitFor(() => expect(swatchHexes()[0]).toBe('#8A2D2D'));
    // Logo clusters first, then saved rows that are not duplicates; the manual Main is kept; cap 6.
    expect(swatchHexes()).toEqual(['#8A2D2D', '#1F6F6B', '#C9A24A', '#141414', '#F2E8D5', '#22AA88']);
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#22AA88');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ brandPaletteLogoAssetId: 'logo_new', brandPrimaryColour: '#22AA88' });
    expect(lastBody().brandPaletteExtracted).toHaveLength(6);
  });

  it('first extraction keeps the saved colours and retry re-runs extraction', async () => {
    vi.mocked(extractFromLogoUrl).mockRejectedValueOnce(new Error('decode'));
    render(<Harness overrides={{ details: { ...base(), brandPaletteExtracted: null }, assets: [logoAsset('logo_1')] }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(extractFromLogoUrl).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull());
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#1F6F6B');
    expect(screen.getByTestId('admin-hub-role-accent').textContent).toContain('#C9A24A');
  });

  it('never shows made-up colours: no Main means a neutral preview and a prompt', () => {
    render(
      <Harness
        overrides={{ details: { ...base(), brandPrimaryColour: null, brandSecondaryColour: null, brandPaletteExtracted: null } }}
      />,
    );
    expect(screen.getAllByText('Pick a main colour').length).toBeGreaterThan(0);
    const html = document.querySelector('[data-testid="admin-hub-colours-preview"]')!.outerHTML.toLowerCase();
    expect(html).not.toContain('1f6f6b');
    expect(html).not.toContain('c9a24a');
    expect(html).not.toContain('0b1f1e');
  });

  it('uses the Main hue for the background and readable text on the Main slot chip', async () => {
    const { betterButtonText, siteBackgroundHex } = await import('@/lib/adminHub/colour');
    render(<Harness overrides={{ details: { ...base(), brandPrimaryColour: '#C9A24A', brandSecondaryColour: '#1F6F6B' } }} />);
    const preview = screen.getByTestId('admin-hub-colours-preview');
    const body = preview.querySelector<HTMLElement>('.admin-hub-livep__body')!;
    const slot = preview.querySelector<HTMLElement>('.admin-hub-livep__slot')!;
    const toRgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    expect(body.style.background).toBe(toRgb(siteBackgroundHex('DARK', '#C9A24A')));
    expect(slot.style.color).toBe(toRgb(betterButtonText('#C9A24A')));
    expect(slot.style.color).not.toBe('rgb(255, 255, 255)');
  });

  it('one role control with pressed state (no tabs), Swap, No accent and the same-hex guard', () => {
    render(<Harness />);
    expect(document.querySelector('[role="tablist"], [role="tab"]')).toBeNull();
    expect(screen.getAllByRole('group', { name: 'Colour to edit' })).toHaveLength(2);
    expect(screen.getByTestId('admin-hub-role-main').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Swap main and accent' }));
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#C9A24A');
    expect(screen.getByTestId('admin-hub-role-accent').textContent).toContain('#1F6F6B');

    // Accent cannot take the Main hex: note shown, value kept.
    fireEvent.click(screen.getByTestId('admin-hub-role-accent'));
    fireEvent.click(screen.getByTestId('admin-hub-swatch-C9A24A'));
    expect(screen.getByTestId('admin-hub-colours-note').textContent).toBe("Main and accent can't be the same colour.");
    expect(screen.getByTestId('admin-hub-role-accent').textContent).toContain('#1F6F6B');

    fireEvent.click(screen.getByRole('button', { name: 'No accent' }));
    expect(screen.getByTestId('admin-hub-role-accent').textContent).toContain('Not set');
    expect(document.querySelector('[data-line="button"]')).toBeNull();
    expect(document.querySelector('[data-line="main"]')).not.toBeNull();
  });

  it('Undo reverts the last change only', () => {
    render(<Harness />);
    const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap main and accent' }));
    fireEvent.click(undo);
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#1F6F6B');
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');
    expect(undo.disabled).toBe(true);
  });

  it('hex box: prefilled, validated while typing, Enter applies, Esc closes and returns focus', async () => {
    render(<Harness />);
    const open = screen.getByRole('button', { name: '# Hex' });
    fireEvent.click(open);
    const input = screen.getByLabelText('Hex') as HTMLInputElement;
    expect(input.value).toBe('#1F6F6B');
    fireEvent.change(input, { target: { value: '#12zz' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Use 0–9 and A–F only, like #1F6F6B.')).toBeTruthy();
    fireEvent.change(input, { target: { value: '#1234' } });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Use 3 or 6 characters, like #1F6F6B.')).toBeTruthy();
    fireEvent.change(input, { target: { value: '2a8' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#22AA88');
    expect(screen.queryByLabelText('Hex')).toBeNull();
    expect(document.activeElement).toBe(open);
    expect(screen.getByTestId('admin-hub-swatch-22AA88')).toBeTruthy();

    fireEvent.click(open);
    const again = screen.getByLabelText('Hex');
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    again.dispatchEvent(esc);
    await waitFor(() => expect(screen.queryByLabelText('Hex')).toBeNull());
    expect(esc.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(open);
  });

  it('labels the screen picker honestly where EyeDropper exists', () => {
    vi.stubGlobal('EyeDropper', class {});
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Pick from your screen' })).toBeTruthy();
    expect(screen.queryByText('Pick from a photo')).toBeNull();
  });

  it('PageUp / PageDown move a slider by 10 %', async () => {
    render(<Harness />);
    const depth = screen.getByRole('slider', { name: 'Depth' }) as HTMLInputElement;
    const start = Number(depth.value);
    fireEvent.keyDown(depth, { key: 'PageUp' });
    await waitFor(() => expect(Math.abs(Number(depth.value) - (start + 10))).toBeLessThanOrEqual(1));
  });

  it('vivid colours start at 100 % intensity and keep their chroma when touched', async () => {
    render(<Harness overrides={{ details: { ...base(), brandPrimaryColour: '#FF0000', brandSecondaryColour: '#141414' } }} />);
    const intensity = screen.getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
    expect(Number(intensity.value)).toBeGreaterThanOrEqual(99);
    fireEvent.change(intensity, { target: { value: '100' } });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#FF0000');
  });

  it('an edit after Saved turns the button back into Save draft', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeTruthy();
  });

  it('keeps the edits and shows an inline error when saving fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Swap main and accent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe("Couldn't save. Your changes are still here — try again."),
    );
    expect(screen.getByTestId('admin-hub-role-main').textContent).toContain('#C9A24A');
  });

  it('closing with unsaved edits saves a draft (never sends), refreshes the hub and shows a toast', async () => {
    const { refreshHubState } = await import('@/lib/adminHub/hubStore');
    const { showHubToast } = await import('@/lib/adminHub/hubToast');
    const changed = vi.fn();
    window.addEventListener('admin-hub:data-changed', changed);
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    view.unmount();
    await waitFor(() => expect(showHubToast).toHaveBeenCalledWith('Draft saved'));
    expect(lastBody()).toMatchObject({ send: false, brandBackgroundTone: 'LIGHT' });
    expect((changed.mock.calls[0]![0] as CustomEvent).detail).toEqual({ reason: 'colours-saved' });
    expect(refreshHubState).toHaveBeenCalled();
    window.removeEventListener('admin-hub:data-changed', changed);
  });

  it('closing without edits does not save', async () => {
    const view = render(<Harness />);
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetch).not.toHaveBeenCalled();
  });
});
