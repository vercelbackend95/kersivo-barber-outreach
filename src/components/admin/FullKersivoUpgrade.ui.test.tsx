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

const redirectToStripe = vi.hoisted(() => vi.fn());

vi.mock('@/lib/setup/fullKersivoUpgrade.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/setup/fullKersivoUpgrade.client')>();
  return { ...actual, redirectToStripe: (url: string) => redirectToStripe(url) };
});

import AdminPanel from './AdminPanel';
import FullKersivoUpgradeDialog, {
  FULL_KERSIVO_UPGRADE_COPY,
  FullKersivoUpgradePage,
} from './FullKersivoUpgradeDialog';
import { resolveAdminProductGate } from '@/lib/admin/productLocks';
import { accessForState, serializeKersivoAccess } from '@/lib/shop/kersivoAccess';

// Session payloads come from the authoritative server capability matrix (v1.18).
const FREE_ACCESS = serializeKersivoAccess(accessForState('FREE_BOOKING'));
const FULL_ACCESS = serializeKersivoAccess(accessForState('FULL_KERSIVO'));

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
const STARTER_LOCKED_LABELS = ['Reports', 'Products', 'Orders', 'Sales'];

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
  it('T: Bookings, Clients (Core), Team and Services stay unlocked for a Starter Owner', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')?.dataset.locked).toBe('true'));
    for (const label of ['Bookings', 'Clients', 'Team', 'Services']) {
      const link = sidebarLink(label);
      expect(link, label).toBeTruthy();
      expect(link!.dataset.locked).toBeUndefined();
      expect(link!.querySelector('.admin-sidebar-link-lock')).toBeNull();
    }
  });

  it('U: Full-only modules are visible but locked with a subtle lock icon', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')?.dataset.locked).toBe('true'));
    for (const label of STARTER_LOCKED_LABELS) {
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

  it('AB: the profile plan label reads "KERSIVO Starter"', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => {
      expect(document.querySelector('.admin-sidebar-profile__plan')?.textContent).toBe('KERSIVO Starter');
    });
    expect(document.body.textContent).not.toMatch(/trial|free forever|Free Booking|KERSIVO Free/i);
  });

  it('AB: Full keeps the existing plan label treatment', async () => {
    installSession({ productAccess: FULL_ACCESS });
    await renderAdmin();
    await waitFor(() => expect(document.querySelector('.admin-sidebar-profile__plan')).toBeTruthy());
    expect(document.querySelector('.admin-sidebar-profile__plan')?.textContent).not.toBe('KERSIVO Starter');
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

  it('X: clicking locked Products / Orders / Sales never mounts the Retail panels', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Products')?.dataset.locked).toBe('true'));
    for (const label of ['Products', 'Orders', 'Sales']) {
      fireEvent.click(sidebarLink(label)!);
      await screen.findByRole('dialog', { name: FULL_KERSIVO_UPGRADE_COPY.heading });
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    expect(screen.queryByTestId('shop-panel')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('X: Assistant stays visible on Starter; the live Assistant is locked inside the panel and by the API', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Assistant')).toBeTruthy());
    expect(sidebarLink('Assistant')!.dataset.locked).toBeUndefined();
    expect(FULL_ACCESS.capabilities.assistant).toBe(true);
    expect(FREE_ACCESS.capabilities.assistant).toBe(false);
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

  it('X: clicking Clients opens Clients Core for a Starter Owner without an upgrade dialog', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Clients')).toBeTruthy());
    expect(sidebarLink('Clients')!.dataset.locked).toBeUndefined();
    fireEvent.click(sidebarLink('Clients')!);
    await screen.findByTestId('clients-panel');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Y: back/forward into locked sections stays locked consistently', async () => {
    installSession();
    await renderAdmin('/admin?section=bookings_reports');
    await waitFor(() =>
      expect(document.querySelector('[data-locked-feature]')?.getAttribute('data-locked-feature')).toBe('reports'),
    );

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

  it('Z: the History affordance opens rolling 90-day History for Starter', async () => {
    installSession();
    await renderAdmin();
    await waitFor(() => expect(sidebarLink('Reports')?.dataset.locked).toBe('true'));
    const latest = panels.bookings[panels.bookings.length - 1]!;
    act(() => latest.onOpenHistoryWithinBookings?.());
    await waitFor(() => expect(panels.bookings.some((p) => p.mode === 'history')).toBe(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Z: a History deep link opens for Starter (server enforces the 90-day window)', async () => {
    installSession();
    await renderAdmin('/admin?section=bookings_history_tab');
    await waitFor(() => expect(panels.bookings.some((p) => p.mode === 'history')).toBe(true));
    expect(document.querySelector('[data-locked-feature]')).toBeNull();
  });

  it('Z: a History deep link stays locked for a tenant without recent history', async () => {
    const access = serializeKersivoAccess(accessForState('FREE_BOOKING'));
    installSession({
      productAccess: { ...access, capabilities: { ...access.capabilities, recentBookingHistory: false } },
    });
    await renderAdmin('/admin?section=bookings_history_tab');
    await waitFor(() =>
      expect(document.querySelector('[data-locked-feature]')?.getAttribute('data-locked-feature')).toBe('history'),
    );
    expect(panels.bookings.some((p) => p.mode === 'history')).toBe(false);
  });

  it('AA: a stale manual-bookings upgrade link never pitches Full to Starter, and strips the param', async () => {
    installSession();
    await renderAdmin('/admin?upgrade=manual_bookings');
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('AA: an upgrade link for a Full-only feature opens the lock and strips the param', async () => {
    installSession();
    await renderAdmin('/admin?upgrade=reports');
    const dialog = await screen.findByRole('dialog', { name: FULL_KERSIVO_UPGRADE_COPY.heading });
    expect(dialog.textContent).toContain('Reports');
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
    installSession({ via: 'preview', productAccess: serializeKersivoAccess(accessForState('SETUP')) });
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
        productAccess: serializeKersivoAccess(accessForState('SETUP')) as never,
      }),
    ).toBeNull();
  });
});

describe('FullKersivoUpgradeDialog', () => {
  it('renders the spec copy, closes on Escape and restores focus', async () => {
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
    expect(screen.getByRole('button', { name: 'Upgrade to Full KERSIVO' })).toBeTruthy();
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

describe('Authenticated Full KERSIVO checkout from the upgrade dialog', () => {
  const UPGRADE_ENDPOINT = '/api/admin/subscription/upgrade-checkout';
  let checkoutFetch: ReturnType<typeof vi.fn>;

  function respond(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  function stubCheckout(...responses: Array<{ status: number; body: unknown } | Promise<never>>) {
    let call = 0;
    checkoutFetch = vi.fn(async () => {
      const next = responses[Math.min(call, responses.length - 1)];
      call += 1;
      if (next instanceof Promise) return next;
      return respond(next!.status, next!.body);
    });
    vi.stubGlobal('fetch', checkoutFetch);
  }

  function upgradeCalls() {
    return checkoutFetch.mock.calls.filter((call) => String(call[0]) === UPGRADE_ENDPOINT);
  }

  function openDialog() {
    render(<FullKersivoUpgradeDialog feature="reports" onClose={() => undefined} />);
    return {
      terms: screen.getByRole('checkbox', { name: /I agree to the KERSIVO Terms of Service/ }) as HTMLInputElement,
      cta: screen.getByRole('button', { name: FULL_KERSIVO_UPGRADE_COPY.cta }) as HTMLButtonElement,
    };
  }

  beforeEach(() => {
    redirectToStripe.mockReset();
    window.sessionStorage.clear();
  });

  it('Z: the CTA is a checkout button, not a /pricing link', () => {
    stubCheckout({ status: 200, body: {} });
    openDialog();
    expect(screen.queryByRole('link', { name: FULL_KERSIVO_UPGRADE_COPY.cta })).toBeNull();
    expect(document.querySelector('a[href="/pricing"]')).toBeNull();
  });

  it('AA: the Terms checkbox starts unticked and links Terms; Privacy is linked separately', () => {
    stubCheckout({ status: 200, body: {} });
    const { terms } = openDialog();
    expect(terms.checked).toBe(false);
    expect(screen.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy');
  });

  it('AB: the CTA stays disabled and sends nothing until Terms are accepted', () => {
    stubCheckout({ status: 200, body: {} });
    const { terms, cta } = openDialog();
    expect(cta.disabled).toBe(true);
    fireEvent.click(cta);
    expect(checkoutFetch).not.toHaveBeenCalled();
    fireEvent.click(terms);
    expect(cta.disabled).toBe(false);
  });

  it('AC/AE: clicking the CTA POSTs the authenticated checkout and redirects to the Stripe URL', async () => {
    stubCheckout({
      status: 200,
      body: { ok: true, url: 'https://checkout.stripe.test/cs_up', reused: false, state: 'open' },
    });
    const { terms, cta } = openDialog();
    fireEvent.click(terms);
    fireEvent.click(cta);

    await waitFor(() => expect(redirectToStripe).toHaveBeenCalledWith('https://checkout.stripe.test/cs_up'));
    expect(upgradeCalls()).toHaveLength(1);
    const [, init] = upgradeCalls()[0]!;
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(payload.termsAccepted).toBe(true);
    expect(payload.checkoutAttemptId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(fetchedFromCheckout('/api/setup/subscription-checkout')).toBe(false);
    expect(cta.disabled).toBe(true);
    expect(cta.textContent).toBe(FULL_KERSIVO_UPGRADE_COPY.loading);
  });

  it('AD: a double click sends exactly one checkout request', async () => {
    let resolveCheckout: (value: unknown) => void = () => undefined;
    checkoutFetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCheckout = resolve;
        }),
    );
    vi.stubGlobal('fetch', checkoutFetch);
    const { terms, cta } = openDialog();
    fireEvent.click(terms);
    // Both clicks land before React re-renders the disabled button (same frame).
    act(() => {
      cta.click();
      cta.click();
    });
    fireEvent.click(cta);
    expect(upgradeCalls()).toHaveLength(1);
    expect(cta.getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      resolveCheckout(respond(200, { ok: true, url: 'https://checkout.stripe.test/once', state: 'open' }));
    });
    await waitFor(() => expect(redirectToStripe).toHaveBeenCalledTimes(1));
    expect(upgradeCalls()).toHaveLength(1);
  });

  it('reuses the same checkoutAttemptId on retry and rotates once on an expired attempt', async () => {
    stubCheckout(
      { status: 409, body: { code: 'CHECKOUT_ATTEMPT_EXPIRED', rotateAttempt: true, error: 'expired' } },
      { status: 200, body: { ok: true, url: 'https://checkout.stripe.test/rotated', state: 'open' } },
    );
    const { terms, cta } = openDialog();
    fireEvent.click(terms);
    fireEvent.click(cta);
    await waitFor(() => expect(redirectToStripe).toHaveBeenCalledWith('https://checkout.stripe.test/rotated'));
    const ids = upgradeCalls().map((call) => JSON.parse(String((call[1] as RequestInit).body)).checkoutAttemptId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('AF: a server error stays in the dialog and the user can retry', async () => {
    stubCheckout(
      { status: 503, body: { error: 'Unable to verify existing checkout session. Please try again shortly.' } },
      { status: 200, body: { ok: true, url: 'https://checkout.stripe.test/retry', state: 'open' } },
    );
    const { terms, cta } = openDialog();
    fireEvent.click(terms);
    fireEvent.click(cta);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Unable to verify existing checkout session');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(redirectToStripe).not.toHaveBeenCalled();
    expect(cta.disabled).toBe(false);

    fireEvent.click(cta);
    await waitFor(() => expect(redirectToStripe).toHaveBeenCalledWith('https://checkout.stripe.test/retry'));
    const ids = upgradeCalls().map((call) => JSON.parse(String((call[1] as RequestInit).body)).checkoutAttemptId);
    expect(ids[0]).toBe(ids[1]);
  });

  it('M: billing recovery offers Manage billing instead of a second checkout', async () => {
    stubCheckout({
      status: 409,
      body: { code: 'BILLING_RECOVERY_REQUIRED', billingPortal: true, error: 'Payment issue.' },
    });
    const { terms, cta } = openDialog();
    fireEvent.click(terms);
    fireEvent.click(cta);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeTruthy();
    expect(redirectToStripe).not.toHaveBeenCalled();
  });

  it('AG: the /admin/upgrade purchase page offers the same Terms + checkout flow', async () => {
    stubCheckout({ status: 200, body: { ok: true, url: 'https://checkout.stripe.test/page', state: 'open' } });
    render(<FullKersivoUpgradePage />);
    expect(screen.getByRole('heading', { name: FULL_KERSIVO_UPGRADE_COPY.heading })).toBeTruthy();
    const terms = screen.getByRole('checkbox', { name: /Terms of Service/ }) as HTMLInputElement;
    const cta = screen.getByRole('button', { name: FULL_KERSIVO_UPGRADE_COPY.cta }) as HTMLButtonElement;
    expect(terms.checked).toBe(false);
    expect(cta.disabled).toBe(true);
    fireEvent.click(terms);
    fireEvent.click(cta);
    await waitFor(() => expect(redirectToStripe).toHaveBeenCalledWith('https://checkout.stripe.test/page'));
    expect(upgradeCalls()).toHaveLength(1);
  });

  function fetchedFromCheckout(fragment: string) {
    return checkoutFetch.mock.calls.some((call) => String(call[0]).includes(fragment));
  }
});

describe('AH: Full shops see no upgrade CTA', () => {
  it('a Full Owner has no locks, no upgrade dialog and no checkout button in the dashboard', async () => {
    installSession({ productAccess: FULL_ACCESS });
    await renderAdmin('/admin?upgrade=reports');
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: FULL_KERSIVO_UPGRADE_COPY.cta })).toBeNull();
    expect(document.querySelector('.admin-sidebar-link--locked')).toBeNull();
  });
});
