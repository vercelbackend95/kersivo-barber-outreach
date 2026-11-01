/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ColoursApp from './ColoursApp';
import { AppChromeProvider, emptyAppChrome, type AdminHubAppChrome } from './AppChrome';
import type { AdminHubAppContext } from './types';

vi.mock('@/lib/adminHub/colour/runExtract', () => ({
  extractFromLogoUrl: vi.fn(),
  logoDisplayUrl: () => '/api/admin-hub/assets/logo_1?size=thumb',
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

  it('sends colours and shows the thanks toast', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Send colours to KERSIVO' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain("Thanks — we'll use these colours"));
    expect(lastBody()).toMatchObject({ send: true });
  });

  it('sends Let KERSIVO choose with that source', async () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Let KERSIVO choose' })[0]!);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({
      send: true,
      brandColoursSource: 'KERSIVO_CHOOSES',
    });
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
});
