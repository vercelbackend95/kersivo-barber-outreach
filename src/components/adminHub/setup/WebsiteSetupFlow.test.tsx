/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppChromeProvider, emptyAppChrome, type AdminHubAppChrome } from '@/components/adminHub/apps/AppChrome';
import type { AdminHubAppContext } from '@/components/adminHub/apps/types';
import { HUB_WEBSITE_EXTRA_LABEL } from '@/lib/freePreview/hubCopy';
import { defaultOpeningWeek } from '@/lib/shopData/openingHours';
import { WebsiteSetupFlow } from './WebsiteSetupFlow';

vi.mock('@/lib/adminHub/hubToast', () => ({ showHubToast: vi.fn() }));
vi.mock('@/lib/adminHub/liveState', () => ({ emitHubDataChanged: vi.fn() }));
// Photos, logo and files is its own component with its own tests; a stub keeps this test on the flow.
vi.mock('@/components/previewHub/HubYourShop', () => ({
  HubYourShop: () => <div data-testid="hub-your-shop-stub">uploads</div>,
}));

function ctx(overrides: Partial<AdminHubAppContext> = {}): AdminHubAppContext {
  return {
    apiBase: '/api/admin-hub',
    canUpload: true,
    canEditDetails: true,
    canReview: true,
    canEditLaunch: false,
    stage: 'designing',
    details: { aboutText: null, websiteExtraText: null },
    assets: [],
    reviews: { SERVICES: null, TEAM: null, HOURS: null },
    reviewShop: null,
    activity: [],
    setupItems: [],
    messages: [],
    initialDraft: '',
    viewer: 'owner',
    canAttach: true,
    shopName: 'Fade Room',
    websiteHref: '/admin/website',
    bookingHref: '/admin/website?view=booking',
    launch: null,
    hasDraftShop: true,
    ...overrides,
  } as AdminHubAppContext;
}

function Harness({ overrides = {} }: { overrides?: Partial<AdminHubAppContext> }) {
  const [chrome, setChrome] = useState<AdminHubAppChrome>(emptyAppChrome);
  return (
    <AppChromeProvider setChrome={setChrome}>
      <WebsiteSetupFlow ctx={ctx(overrides)} />
      <div data-testid="chrome-footer">{chrome.footer}</div>
    </AppChromeProvider>
  );
}

const savedProfile = {
  shopName: 'Fade Room',
  townCity: 'Leeds',
  tagline: null,
  addressLine1: '1 High Street',
  addressLine2: null,
  postcode: 'LS1 1AA',
  phone: '0113 496 0000',
  email: null,
  facebookUrl: null,
  tiktokUrl: null,
};

type Route = (init?: RequestInit) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;

let routes: Record<string, Route>;
let calls: Array<{ method: string; url: string; body?: unknown }>;

function key(method: string, url: string) {
  return `${method} ${url}`;
}

beforeEach(() => {
  calls = [];
  routes = {
    [key('GET', '/api/admin-hub/profile')]: () => ({ body: { ok: true, ready: true, profile: savedProfile } }),
    [key('GET', '/api/admin-hub/opening-hours')]: () => ({
      body: { ok: true, ready: true, saved: true, days: defaultOpeningWeek() },
    }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ method, url, body: init?.body ? JSON.parse(init.body as string) : undefined });
      const route = routes[key(method, url)];
      const result = route ? await route(init) : { status: 404, body: { ok: false, error: 'Not found.' } };
      const status = result.status ?? 200;
      return { ok: status >= 200 && status < 300, status, json: async () => result.body };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const sectionTitles = () =>
  Array.from(screen.getByTestId('website-setup').querySelectorAll(':scope > section, :scope > .ks-setup-files')).map(
    (el) => el.querySelector('h2')?.textContent,
  );

describe('WebsiteSetupFlow (Overview › Add to your website)', () => {
  it('renders Business details → Opening hours → Website text → Photos, logo and files', async () => {
    render(<Harness />);
    await screen.findByLabelText('Barbershop name');
    expect(sectionTitles()).toEqual(['Business details', 'Opening hours', 'Website text', 'Photos, logo and files']);
    expect(screen.queryByText('Services')).toBeNull();
    expect(screen.queryByText('Team')).toBeNull();
    expect(screen.queryByText('Products')).toBeNull();
    expect(screen.getByTestId('setup-progress').textContent).toContain('2 of 2 sections complete');
  });

  it('shows the business fields in order, prefilled from saved data, with labels tied to inputs', async () => {
    render(<Harness />);
    const card = within(await screen.findByTestId('setup-business'));
    await card.findByDisplayValue('Fade Room');
    const labels = Array.from(screen.getByTestId('setup-business').querySelectorAll('label')).map((l) => l.textContent);
    expect(labels).toEqual([
      'Barbershop name',
      'Town or city (optional)',
      'Address line 1',
      'Address line 2 (optional)',
      'Postcode',
      'Phone',
      'Email',
    ]);
    expect((card.getByLabelText('Barbershop name') as HTMLInputElement).required).toBe(true);
    expect((card.getByLabelText('Town or city (optional)') as HTMLInputElement).value).toBe('Leeds');
    expect(card.getByLabelText('Email').getAttribute('type')).toBe('email');
    expect(card.getByLabelText('Phone').getAttribute('type')).toBe('tel');
    expect(card.getByLabelText('Postcode').getAttribute('autocomplete')).toBe('postal-code');
    expect(card.queryByLabelText('Tagline')).toBeNull();
    expect(card.queryByLabelText(/Instagram/)).toBeNull();
    expect(card.queryByLabelText(/About your shop/)).toBeNull();
  });

  it('never calls the paid dashboard /api/admin/* routes', async () => {
    render(<Harness />);
    await screen.findByLabelText('Barbershop name');
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0113 496 0001' } });
    routes[key('PATCH', '/api/admin-hub/profile')] = () => ({ body: { ok: true, profile: savedProfile } });
    fireEvent.click(within(screen.getByTestId('chrome-footer')).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.url.startsWith('/api/admin/'))).toEqual([]);
    expect(new Set(calls.map((c) => c.url))).toEqual(new Set(['/api/admin-hub/profile', '/api/admin-hub/opening-hours']));
  });

  it('keeps the other cards usable when one section fails to load, and retries only that card', async () => {
    let profileFails = true;
    routes[key('GET', '/api/admin-hub/profile')] = () =>
      profileFails ? { status: 500, body: { ok: false } } : { body: { ok: true, profile: savedProfile } };
    render(<Harness />);
    const business = within(await screen.findByTestId('setup-business'));
    const alert = await business.findByRole('alert');
    expect(alert.textContent).toContain('We could not load your business details.');
    // Hours, website text and uploads still work.
    const hours = within(screen.getByTestId('setup-hours'));
    expect((await hours.findAllByRole('combobox')).some((el) => !(el as HTMLSelectElement).disabled)).toBe(true);
    expect(hours.queryByRole('alert')).toBeNull();
    expect((screen.getByLabelText(HUB_WEBSITE_EXTRA_LABEL) as HTMLTextAreaElement).disabled).toBe(false);
    expect(screen.getByTestId('hub-your-shop-stub')).toBeTruthy();
    expect(screen.queryByText('We could not load your shop details. Please try again.')).toBeNull();

    profileFails = false;
    const hoursCallsBefore = calls.filter((c) => c.url.endsWith('/opening-hours')).length;
    fireEvent.click(business.getByRole('button', { name: 'Try again' }));
    expect(await business.findByDisplayValue('Fade Room')).toBeTruthy();
    expect(calls.filter((c) => c.url.endsWith('/opening-hours')).length).toBe(hoursCallsBefore);
  });

  it('without a draft shop shows the fields straight away and creates the shop on save', async () => {
    routes[key('GET', '/api/admin-hub/profile')] = () => ({
      body: { ok: true, ready: false, profile: { ...savedProfile, addressLine1: null, postcode: null, phone: null } },
    });
    routes[key('GET', '/api/admin-hub/opening-hours')] = () => ({ body: { ok: true, ready: false, saved: false, days: null } });
    routes[key('POST', '/api/admin-hub/draft-shop')] = () => ({ body: { shopId: 'shop_1' } });
    routes[key('PATCH', '/api/admin-hub/profile')] = () => ({ body: { ok: true, profile: savedProfile } });
    routes[key('PUT', '/api/admin-hub/opening-hours')] = () => ({ body: { ok: true, saved: true, days: defaultOpeningWeek() } });
    render(<Harness overrides={{ hasDraftShop: false }} />);

    const business = within(await screen.findByTestId('setup-business'));
    expect(await business.findByDisplayValue('Fade Room')).toBeTruthy();
    expect(screen.queryByText(/Set up my shop/)).toBeNull();
    expect(screen.getByTestId('setup-hours').textContent).toContain("We've filled in common hours. Check them and save.");

    fireEvent.change(business.getByLabelText('Postcode'), { target: { value: 'LS1 1AA' } });
    fireEvent.click(within(screen.getByTestId('chrome-footer')).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const writes = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url}`);
    expect(writes).toEqual([
      'POST /api/admin-hub/draft-shop',
      'PATCH /api/admin-hub/profile',
      'PUT /api/admin-hub/opening-hours',
    ]);
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ postcode: 'LS1 1AA' });
  });

  it('shows a draft-shop failure in Business details and keeps what the owner typed', async () => {
    routes[key('GET', '/api/admin-hub/profile')] = () => ({ body: { ok: true, ready: false, profile: { shopName: 'Fade Room' } } });
    routes[key('POST', '/api/admin-hub/draft-shop')] = () => ({ status: 403, body: { ok: false, error: 'Not available in your preview.' } });
    render(<Harness overrides={{ hasDraftShop: false }} />);
    const business = within(await screen.findByTestId('setup-business'));
    await business.findByDisplayValue('Fade Room');
    fireEvent.change(business.getByLabelText('Phone'), { target: { value: '0113 496 0000' } });
    fireEvent.click(within(screen.getByTestId('chrome-footer')).getByRole('button', { name: 'Save changes' }));
    expect((await business.findByRole('alert')).textContent).toBe('Not available in your preview.');
    expect((business.getByLabelText('Phone') as HTMLInputElement).value).toBe('0113 496 0000');
    expect(calls.some((c) => c.method === 'PATCH' || c.method === 'PUT')).toBe(false);
  });

  it('blocks saving without a name or with a malformed email, with the error tied to the field', async () => {
    render(<Harness />);
    const business = within(await screen.findByTestId('setup-business'));
    await business.findByDisplayValue('Fade Room');
    fireEvent.change(business.getByLabelText('Barbershop name'), { target: { value: ' ' } });
    fireEvent.change(business.getByLabelText('Email'), { target: { value: 'nope' } });
    fireEvent.click(within(screen.getByTestId('chrome-footer')).getByRole('button', { name: 'Save changes' }));
    expect((await business.findByRole('alert')).textContent).toBe('Check the highlighted fields.');
    const name = business.getByLabelText('Barbershop name');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(name.getAttribute('aria-describedby')!)?.textContent).toBe('Enter your barbershop name.');
    expect(business.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(calls.some((c) => c.method !== 'GET')).toBe(false);
  });

  it('shows saved values read-only, without an error, at a stage past editing', async () => {
    render(<Harness overrides={{ stage: 'live' }} />);
    const business = within(await screen.findByTestId('setup-business'));
    const name = (await business.findByDisplayValue('Fade Room')) as HTMLInputElement;
    expect(name.disabled).toBe(true);
    expect(screen.getByText('These details are managed from your KERSIVO dashboard now.')).toBeTruthy();
    expect(business.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('setup-savebar')).toBeNull();
  });
});
