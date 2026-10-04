/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const panels = vi.hoisted(() => ({
  bookings: [] as Array<{ isActive: boolean; mode: string; onOpenHistoryWithinBookings?: () => void }>,
}));

vi.mock('./BookingsAdminPanel', async () => {
  const R = await import('react');
  return {
    default: (props: { isActive: boolean; mode: string; onOpenHistoryWithinBookings?: () => void }) => {
      panels.bookings.push(props);
      return R.createElement('div', {
        'data-testid': 'bookings-panel',
        'data-active': String(props.isActive),
        'data-mode': props.mode,
      });
    },
  };
});

function stubPanel(testId: string) {
  return async () => {
    const R = await import('react');
    return { default: () => R.createElement('div', { 'data-testid': testId }) };
  };
}

vi.mock('./ClientsAdminPanel', stubPanel('clients-panel'));
vi.mock('./ShopAdminPanel', stubPanel('shop-panel'));
vi.mock('./AiAssistantPanel', stubPanel('assistant-panel'));
vi.mock('./ServicesAdminPanel', stubPanel('services-panel'));
vi.mock('./BarbershopSettingsPanel', stubPanel('settings-panel'));
vi.mock('./SiteLaunchHubPanel', stubPanel('site-launch-panel'));
vi.mock('./AdminGlobalMobileNextStripHost', () => ({ default: () => null }));

vi.mock('./useAdminTodayBookingsLive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useAdminTodayBookingsLive')>();
  return {
    ...actual,
    AdminTodayBookingsLiveProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('./adminAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adminAuth')>();
  return { ...actual, installAdminFetchInterceptor: () => undefined };
});

vi.mock('@/lib/auth-client', () => ({
  authClient: { getSession: vi.fn(async () => null), signOut: vi.fn(async () => undefined) },
}));

import AdminPanel from './AdminPanel';
import FullKersivoUpgradeDialog, { FULL_KERSIVO_UPGRADE_COPY } from './FullKersivoUpgradeDialog';
import { resolveAdminProductGate } from '@/lib/admin/productLocks';

const NO_PAID = {
  reports: false,
  clients: false,
  fullBookingHistory: false,
  retail: false,
  assistant: false,
  smsReminders: false,
  automatedEmailReminders: false,
  brandedSite: false,
  manualBookings: false,
};
const CORE = { bookingCore: true, publicBooking: true, bookingPayments: true, team: true, services: true };
const FREE_ACCESS = { state: 'FREE_BOOKING', capabilities: { ...CORE, ...NO_PAID } };
const FULL_ACCESS = {
  state: 'FULL_KERSIVO',
  capabilities: Object.fromEntries(Object.keys({ ...CORE, ...NO_PAID }).map((k) => [k, true])),
};

const OWNER_PERMISSIONS = [
  'bookings.manage',
  'catalog.manage',
  'members.manage',
  'team.read',
  'reports.view',
  'clients.read',
  'retail.manage',
  'ai.use',
  'billing.manage',
  'shop.settings',
  'onboarding.manage',
];

type SessionOverrides = {
  via?: string;
  productAccess?: unknown;
  permissions?: string[];
};

let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body, clone() { return this; } };
}

function installSession({ via = 'session', productAccess = FREE_ACCESS, permissions = OWNER_PERMISSIONS }: SessionOverrides = {}) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/admin/session')) {
      return json({
        ok: true,
        via,
        shopId: 'shop-1',
        onboardingCompleted: true,
        onboardingRequired: false,
        onboardingGate: 'dashboard',
        permissions,
        productAccess,
        shop: { name: 'Fade Lab', logoUrl: null },
        user: { name: 'Olivia Owner', email: 'owner@example.com', image: null },
      });
    }
    if (url.startsWith('/api/setup/launch-context')) {
      return json({
        paid: false,
        pending: null,
        paidHref: null,
        progress: {
          steps: [
            { id: 'barbershop', label: 'Barbershop created', done: true },
            { id: 'team', label: 'First barber added', done: true },
            { id: 'services', label: 'Services added', done: true },
            { id: 'retail', label: 'Set up your retail shop', done: true },
          ],
          complete: true,
          nextHref: null,
        },
      });
    }
    if (url.startsWith('/api/setup/billing-status')) return json({ hasSubscription: false });
    return json({});
  });
  vi.stubGlobal('fetch', fetchMock);
}

function sidebarLink(label: string): HTMLButtonElement | null {
  const nav = document.querySelector('.admin-sidebar-nav');
  if (!nav) return null;
  return (
    [...nav.querySelectorAll<HTMLButtonElement>('button.admin-sidebar-link')].find(
      (button) => button.querySelector('.admin-sidebar-link-label')?.textContent === label,
    ) ?? null
  );
}

async function renderAdmin(url = '/admin', props: React.ComponentProps<typeof AdminPanel> = {}) {
  window.history.replaceState(null, '', url);
  const view = render(<AdminPanel {...props} />);
  await screen.findByTestId('bookings-panel');
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/session', expect.anything()));
  return view;
}

function fetchedUrls(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

const PAID_LABELS = ['Reports', 'Clients', 'Products', 'Orders', 'Sales', 'Assistant'];

beforeEach(() => {
  panels.bookings.length = 0;
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('Free Booking dashboard sidebar', () => {
  it('T: Bookings, Team and Services stay unlocked for a Free Owner', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')?.dataset.locked).toBe('true'));
    for (const label of ['Bookings', 'Team', 'Services']) {
      const link = sidebarLink(label);
      expect(link, label).toBeTruthy();
      expect(link!.dataset.locked).toBeUndefined();
      expect(link!.querySelector('.admin-sidebar-link-lock')).toBeNull();
    }
  });

  it('U: the six paid modules are visible but locked with a subtle lock icon', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')?.dataset.locked).toBe('true'));
    for (const label of PAID_LABELS) {
      const link = sidebarLink(label);
      expect(link, label).toBeTruthy();
      expect(link!.dataset.locked).toBe('true');
      expect(link!.className).toContain('admin-sidebar-link--locked');
      expect(link!.querySelector('.admin-sidebar-link-lock svg')).toBeTruthy();
      expect(link!.getAttribute('aria-label')).toBe(`${label} (Full KERSIVO)`);
    }
    expect(document.body.textContent).not.toMatch(/\bPRO\b/);
  });

  it('V: a Full Owner sees every module normally and can open Reports', async () => {
    installSession({ productAccess: FULL_ACCESS });
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')).toBeTruthy());
    for (const label of ['Bookings', 'Team', 'Services', ...PAID_LABELS]) {
      expect(sidebarLink(label)!.dataset.locked, label).toBeUndefined();
    }
    fireEvent.click(sidebarLink('Reports')!);
    await waitFor(() => {
      const panel = screen.getByTestId('bookings-panel');
      expect(panel.dataset.mode).toBe('reports');
      expect(panel.dataset.active).toBe('true');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('W: a role without the RBAC permission sees the item hidden, never locked', async () => {
    installSession({ permissions: ['bookings.self', 'team.read'] });
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Bookings')).toBeTruthy());
    await waitFor(() => expect(sidebarLink('Reports')).toBeNull());
    for (const label of PAID_LABELS) {
      expect(sidebarLink(label), label).toBeNull();
    }
    expect(sidebarLink('Team')!.dataset.locked).toBeUndefined();
  });

  it('AB: the profile plan label reads "Free Booking"', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => {
      expect(document.querySelector('.admin-sidebar-profile__plan')?.textContent).toBe('Free Booking');
    });
    expect(document.body.textContent).not.toMatch(/trial|free forever/i);
  });

  it('AB: Full keeps the existing plan label treatment', async () => {
    installSession({ productAccess: FULL_ACCESS });
    await renderAdmin();
    await waitFor(() => expect(document.querySelector('.admin-sidebar-profile__plan')).toBeTruthy());
    expect(document.querySelector('.admin-sidebar-profile__plan')?.textContent).not.toBe('Free Booking');
  });
});

describe('Locked module interactions', () => {
  it('X: clicking locked Reports opens the upgrade dialog without navigating or mounting the panel', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')?.dataset.locked).toBe('true'));
    const callsBefore = fetchedUrls().length;

    fireEvent.click(sidebarLink('Reports')!);

    const dialog = await screen.findByRole('dialog', { name: FULL_KERSIVO_UPGRADE_COPY.heading });
    expect(dialog.textContent).toContain(FULL_KERSIVO_UPGRADE_COPY.body);
    expect(dialog.textContent).toContain('£39/month per location');
    expect(dialog.textContent).toContain(
      '0% KERSIVO platform fee on booking and retail payments. Stripe processing fees apply.',
    );
    expect(window.location.search).toBe('');
    expect(panels.bookings.every((p) => p.mode !== 'reports')).toBe(true);
    expect(fetchedUrls().slice(callsBefore).some((url) => url.includes('/api/admin/reports'))).toBe(false);
  });

  it('X: clicking locked Clients / Products / Assistant never mounts those panels', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Clients')?.dataset.locked).toBe('true'));
    for (const label of ['Clients', 'Products', 'Orders', 'Sales', 'Assistant']) {
      fireEvent.click(sidebarLink(label)!);
      await screen.findByRole('dialog', { name: FULL_KERSIVO_UPGRADE_COPY.heading });
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    expect(screen.queryByTestId('clients-panel')).toBeNull();
    expect(screen.queryByTestId('shop-panel')).toBeNull();
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('Y: a Free deep link keeps the chrome, shows the lock and never mounts the paid panel', async () => {
    installSession();
    await renderAdmin('/admin?section=bookings_reports');
    const locked = await waitFor(() => {
      const node = document.querySelector('[data-locked-feature]');
      expect(node).toBeTruthy();
      return node as HTMLElement;
    });
    expect(locked.dataset.lockedFeature).toBe('reports');
    expect(locked.textContent).toContain(FULL_KERSIVO_UPGRADE_COPY.heading);
    expect(document.querySelector('.admin-sidebar-nav')).toBeTruthy();
    expect(window.location.search).toBe('?section=bookings_reports');
    const latest = panels.bookings[panels.bookings.length - 1]!;
    expect(latest.isActive).toBe(false);
    expect(latest.mode).toBe('dashboard');
    expect(panels.bookings.some((p) => p.isActive && p.mode === 'reports')).toBe(false);
    expect(fetchedUrls().some((url) => url.includes('/api/admin/reports'))).toBe(false);
  });

  it('Y: back/forward into locked sections stays locked consistently', async () => {
    installSession();
    await renderAdmin('/admin?section=bookings_clients');
    await waitFor(() =>
      expect(document.querySelector('[data-locked-feature]')?.getAttribute('data-locked-feature')).toBe('clients'),
    );
    expect(screen.queryByTestId('clients-panel')).toBeNull();

    act(() => {
      window.history.pushState(null, '', '/admin?section=shop_products');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() =>
      expect(document.querySelector('[data-locked-feature]')?.getAttribute('data-locked-feature')).toBe('retail'),
    );
    expect(screen.queryByTestId('shop-panel')).toBeNull();

    act(() => {
      window.history.pushState(null, '', '/admin?section=bookings_dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(document.querySelector('[data-locked-feature]')).toBeNull());
    expect(screen.getByTestId('bookings-panel').dataset.active).toBe('true');
  });

  it('Z: the History affordance opens the lock instead of navigating', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')?.dataset.locked).toBe('true'));
    const latest = panels.bookings[panels.bookings.length - 1]!;
    act(() => latest.onOpenHistoryWithinBookings?.());
    await screen.findByRole('dialog', { name: FULL_KERSIVO_UPGRADE_COPY.heading });
    expect(window.location.search).toBe('');
    expect(panels.bookings.some((p) => p.mode === 'history')).toBe(false);
  });

  it('Z: a History deep link is locked for Free', async () => {
    installSession();
    await renderAdmin('/admin?section=bookings_history_tab');
    await waitFor(() =>
      expect(document.querySelector('[data-locked-feature]')?.getAttribute('data-locked-feature')).toBe('history'),
    );
    expect(panels.bookings.some((p) => p.mode === 'history')).toBe(false);
  });

  it('AA: the manual booking entry point (upgrade redirect) opens the lock and strips the param', async () => {
    installSession();
    await renderAdmin('/admin?upgrade=manual_bookings');
    const dialog = await screen.findByRole('dialog', { name: FULL_KERSIVO_UPGRADE_COPY.heading });
    expect(dialog.textContent).toContain('Manual bookings');
    expect(window.location.search).toBe('');
  });

  it('AA: Full ignores a stale upgrade param', async () => {
    installSession({ productAccess: FULL_ACCESS });
    await renderAdmin('/admin?upgrade=manual_bookings');
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the Free launch CTA opens the upgrade dialog instead of the guest subscription wizard', async () => {
    installSession();
    await renderAdmin();
    const cta = await screen.findByRole('button', { name: /Launch My Barbershop/ });
    fireEvent.click(cta);
    await screen.findByRole('dialog', { name: FULL_KERSIVO_UPGRADE_COPY.heading });
    expect(fetchedUrls().some((url) => url.includes('subscription-checkout'))).toBe(false);
  });
});

describe('AC: demo, BLACKLINE, showcase and preview do not regress', () => {
  it.each([
    ['public demo', { demoMode: true }],
    ['BLACKLINE demo', { demoMode: true, demoTenant: 'blackline' as const }],
    ['landing showcase', { demoMode: true, showcaseMode: true }],
  ])('%s keeps every module unlocked', async (_label, props) => {
    installSession();
    window.history.replaceState(null, '', '/admin-demo');
    render(<AdminPanel {...props} />);
    await screen.findByTestId('bookings-panel');
    for (const label of PAID_LABELS) {
      const link = sidebarLink(label);
      if (link) expect(link.dataset.locked, label).toBeUndefined();
    }
    expect(document.querySelector('.admin-sidebar-link--locked')).toBeNull();
  });

  it('guest preview keeps showcasing Full even though it resolves to SETUP', async () => {
    installSession({ via: 'preview', productAccess: { state: 'SETUP', capabilities: { ...CORE, ...NO_PAID } } });
    await renderAdmin('/admin?section=bookings_reports');
    await waitFor(() => expect(screen.getByTestId('bookings-panel').dataset.mode).toBe('reports'));
    expect(document.querySelector('.admin-sidebar-link--locked')).toBeNull();
    expect(document.querySelector('[data-locked-feature]')).toBeNull();
  });

  it('resolveAdminProductGate only locks real Free Booking sessions', () => {
    expect(resolveAdminProductGate({ demoMode: false, via: 'session', productAccess: FREE_ACCESS as never })).toBe(
      FREE_ACCESS,
    );
    expect(resolveAdminProductGate({ demoMode: true, via: 'session', productAccess: FREE_ACCESS as never })).toBeNull();
    expect(resolveAdminProductGate({ demoMode: false, via: 'preview', productAccess: FREE_ACCESS as never })).toBeNull();
    expect(resolveAdminProductGate({ demoMode: false, via: 'secret', productAccess: null })).toBeNull();
    expect(resolveAdminProductGate({ demoMode: false, via: 'session', productAccess: FULL_ACCESS as never })).toBeNull();
    expect(
      resolveAdminProductGate({
        demoMode: false,
        via: 'session',
        productAccess: { state: 'SETUP', capabilities: { ...CORE, ...NO_PAID } } as never,
      }),
    ).toBeNull();
  });
});

describe('FullKersivoUpgradeDialog', () => {
  it('renders the spec copy with a non-destructive pricing CTA, closes on Escape and restores focus', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Reports';
    document.body.append(trigger);
    trigger.focus();
    const onClose = vi.fn();

    const { rerender } = render(<FullKersivoUpgradeDialog feature="reports" onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Unlock Full KERSIVO' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(
      screen.getByText('Upgrade to access Reports, Clients, Retail, Assistant and your full booking history.'),
    ).toBeTruthy();
    const cta = screen.getByRole('link', { name: 'Upgrade to Full KERSIVO' });
    expect(cta.getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<FullKersivoUpgradeDialog feature={null} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
