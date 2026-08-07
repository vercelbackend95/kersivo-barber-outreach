/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClientOnboardingDomainMode, ClientOnboardingStatus } from '@prisma/client';
import ClientOnboardingWizard from './ClientOnboardingWizard';
import { AUTOSAVE_MS } from './useClientOnboardingDraft';
import type { ClientOnboardingState } from './types';

vi.mock('@/components/admin/PrivateDemoAuthPanel', () => ({
  default: function MockAuthPanel({ onSuccess }: { onSuccess?: () => void }) {
    return (
      <button type="button" onClick={() => onSuccess?.()}>
        Sign in again
      </button>
    );
  },
}));

function baseDraft(overrides: Partial<ClientOnboardingState['onboarding']> = {}) {
  return {
    id: 'onb_1',
    shopId: 'shop_1',
    status: ClientOnboardingStatus.DRAFT,
    currentStep: 0,
    submittedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalBusinessName: null,
    businessType: null,
    companyNumber: null,
    addressLine1: null,
    addressLine2: null,
    townCity: null,
    postcode: null,
    publicEmail: null,
    publicPhone: null,
    primaryContactName: null,
    primaryContactEmail: null,
    tagline: null,
    shopDescription: null,
    websiteNotes: null,
    currentWebsiteUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    tiktokUrl: null,
    otherSocialUrl: null,
    brandNotes: null,
    preferredPrimaryColour: null,
    preferredSecondaryColour: null,
    domainMode: ClientOnboardingDomainMode.UNDECIDED,
    existingDomain: null,
    domainRegistrar: null,
    preferredDomain1: null,
    preferredDomain2: null,
    preferredDomain3: null,
    domainRegistrationAuthorised: false,
    migrationRequested: null,
    migrationSource: null,
    migrationSourceOther: null,
    migrationNotes: null,
    migrationDataConfirmedLawful: false,
    launchRetail: null,
    launchDeposits: null,
    retailProductsDeferred: false,
    notificationReplyToEmail: null,
    additionalNotes: null,
    portfolioConsent: false,
    socialMediaConsent: false,
    advertisingConsent: false,
    caseStudyConsent: false,
    contentRightsConfirmed: false,
    informationAccuracyConfirmed: false,
    ...overrides,
  } satisfies ClientOnboardingState['onboarding'];
}

type StateOverrides = {
  onboarding?: Partial<ClientOnboardingState['onboarding']>;
  shop?: ClientOnboardingState['shop'];
  owner?: ClientOnboardingState['owner'];
  workspace?: ClientOnboardingState['workspace'];
  barbers?: ClientOnboardingState['barbers'];
  services?: ClientOnboardingState['services'];
  openingHours?: ClientOnboardingState['openingHours'];
  assets?: ClientOnboardingState['assets'];
  completion?: ClientOnboardingState['completion'];
};

function mockState(overrides: StateOverrides = {}): ClientOnboardingState {
  const { onboarding: onboardingOverrides, ...rest } = overrides;
  return {
    onboarding: baseDraft(onboardingOverrides),
    shop: {
      id: 'shop_1',
      name: 'Sharp Cuts',
      townCity: 'London',
      logoUrl: null,
      onboardingCompleted: true,
      shopPaidAt: '2026-01-01T00:00:00.000Z',
      retailEnabled: false,
      depositsEnabled: false,
    },
    owner: { id: 'user_1', name: 'Alex', email: 'alex@example.com' },
    workspace: {
      shopName: 'Sharp Cuts',
      activeBarberCount: 1,
      activeServiceCount: 1,
      activeShopOpenDayCount: 5,
      activeBarberAvailabilityDayCount: 5,
      productCount: 0,
    },
    barbers: [
      {
        id: 'barber_1',
        name: 'Jamie',
        active: true,
        avatarUrl: null,
        sortOrder: 0,
        bio: null,
        showOnWebsite: true,
      },
    ],
    services: [
      {
        id: 'svc_1',
        name: 'Skin Fade',
        isActive: true,
        pricePence: 2500,
        durationMinutes: 30,
      },
    ],
    openingHours: [
      { dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: true },
    ],
    assets: [],
    completion: {
      readyToSubmit: false,
      missing: [],
      submitted: false,
      writeLocked: false,
    },
    ...rest,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const defaultRules = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  active: dayOfWeek <= 5,
  startTime: '09:00',
  endTime: '18:00',
}));

describe('ClientOnboardingWizard hardening', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function mockApis(state: ClientOnboardingState, opts?: {
    onPatch?: (body: Record<string, unknown>) => void;
    deferPatch?: { resolve: (r: Response) => void }[];
    hoursFail?: boolean;
    profilesFail?: boolean;
    rulesFail?: boolean;
    deleteFail?: boolean;
    barbersFail?: boolean;
    servicesFail?: boolean;
  }) {
    let live = structuredClone(state);
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/api/admin/client-onboarding/assets') && method === 'POST') {
        return jsonResponse({
          ok: true,
          asset: {
            id: 'asset_new',
            kind: 'BRAND_LOGO',
            storagePath: 'private/onboarding/shop_1/logo.png',
            originalFileName: 'logo.png',
            contentType: 'image/png',
            sizeBytes: 10,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        });
      }
      if (url.includes('/api/admin/client-onboarding/assets') && method === 'DELETE') {
        if (opts?.deleteFail) return jsonResponse({ error: 'Blob delete failed.' }, 503);
        return jsonResponse({ ok: true });
      }
      if (url.includes('/api/admin/client-onboarding/barber-profiles') && method === 'PUT') {
        if (opts?.profilesFail) return jsonResponse({ error: 'Profiles failed.' }, 500);
        return jsonResponse({ ok: true });
      }
      if (url.includes('/api/admin/barbershop-settings/hours') && method === 'PUT') {
        if (opts?.hoursFail) return jsonResponse({ error: 'Hours failed.' }, 400);
        return jsonResponse({ hours: [] });
      }
      if (url.includes('/api/admin/barbers/') && url.includes('/rules')) {
        if (method === 'PUT' && opts?.rulesFail) {
          return jsonResponse({ error: 'Rules failed.' }, 400);
        }
        if (method === 'PUT') return jsonResponse({ ok: true });
        return jsonResponse({ rules: defaultRules });
      }
      if (url.endsWith('/api/admin/barbers') && method === 'GET') {
        return jsonResponse({
          barbers: live.barbers.map((b) => ({ ...b, serviceIds: ['svc_1'], isActive: b.active })),
        });
      }
      if (url.endsWith('/api/admin/barbers') && method === 'POST') {
        if (opts?.barbersFail) return jsonResponse({ error: 'Barber save failed.' }, 500);
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse({
          barber: {
            id: body.id ?? 'barber_new',
            name: body.name,
            active: body.isActive ?? true,
            avatarUrl: null,
            sortOrder: 1,
          },
        });
      }
      if (url.includes('/api/admin/services/') && method === 'PATCH') {
        if (opts?.servicesFail) return jsonResponse({ error: 'Service save failed.' }, 500);
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse({ service: { id: 'svc_1', ...body } });
      }
      if (url.endsWith('/api/admin/services') && method === 'GET') {
        return jsonResponse({
          services: live.services.map((s) => ({
            ...s,
            barberServices: [{ barber: { id: 'barber_1', name: 'Jamie', active: true } }],
          })),
          categories: [],
        });
      }
      if (url.endsWith('/api/admin/services') && method === 'POST') {
        return jsonResponse({
          service: {
            id: 'svc_new',
            name: 'Beard',
            isActive: true,
            pricePence: 1500,
            durationMinutes: 20,
          },
          categories: [],
        });
      }
      if (url.includes('/submit') && method === 'POST') {
        return jsonResponse({
          onboarding: {
            ...live.onboarding,
            status: ClientOnboardingStatus.SUBMITTED,
            submittedAt: '2026-08-07T12:00:00.000Z',
          },
        });
      }
      if (
        url.includes('/api/admin/client-onboarding') &&
        !url.includes('/assets') &&
        !url.includes('/barber-profiles') &&
        !url.includes('/submit')
      ) {
        if (method === 'GET') return jsonResponse(live);
        if (method === 'PATCH' || method === 'PUT') {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          opts?.onPatch?.(body);
          live = {
            ...live,
            onboarding: { ...live.onboarding, ...body },
          };
          if (opts?.deferPatch) {
            return new Promise<Response>((resolve) => {
              opts.deferPatch!.push({ resolve });
            });
          }
          return jsonResponse({ ok: true, onboarding: live.onboarding });
        }
      }
      return jsonResponse({ error: `Unhandled ${method} ${url}` }, 500);
    });
    return {
      getLive: () => live,
      setLive: (next: ClientOnboardingState) => {
        live = next;
      },
    };
  }

  it('loads welcome and restores step', async () => {
    mockApis(mockState());
    render(<ClientOnboardingWizard />);
    expect(await screen.findByRole('heading', { name: /Let’s get your KERSIVO setup ready/i })).toBeTruthy();
    cleanup();
    mockApis(mockState({ onboarding: { currentStep: 1, primaryContactName: 'Alex', primaryContactEmail: 'a@b.c' } }));
    render(<ClientOnboardingWizard />);
    expect(await screen.findByRole('heading', { name: /Your business/i })).toBeTruthy();
  });

  it('seeds blank contact and townCity from owner/shop once without overwrite', async () => {
    const patches: Record<string, unknown>[] = [];
    mockApis(
      mockState({
        onboarding: {
          townCity: null,
          primaryContactName: null,
          primaryContactEmail: null,
        },
      }),
      { onPatch: (b) => patches.push(b) },
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Let’s get your KERSIVO setup ready/i });
    await waitFor(() => {
      expect(patches.some((p) => p.townCity === 'London' && p.primaryContactName === 'Alex')).toBe(
        true,
      );
    });
    expect(screen.getByText(/brought across the information you already added/i)).toBeTruthy();

    cleanup();
    patches.length = 0;
    mockApis(
      mockState({
        onboarding: {
          townCity: 'Manchester',
          primaryContactName: 'Sam',
          primaryContactEmail: 'sam@example.com',
          currentStep: 1,
        },
      }),
      { onPatch: (b) => patches.push(b) },
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByDisplayValue('Manchester')).toBeTruthy();
    expect(screen.getByDisplayValue('Sam')).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(patches.some((p) => p.townCity === 'London')).toBe(false);
  });

  it('shows canonical-only prefill copy and no banner when empty', async () => {
    mockApis(
      mockState({
        shop: {
          id: 'shop_1',
          name: null,
          townCity: null,
          logoUrl: null,
          onboardingCompleted: false,
          shopPaidAt: '2026-01-01T00:00:00.000Z',
          retailEnabled: false,
          depositsEnabled: false,
        },
        owner: { id: 'u', name: null, email: null },
        onboarding: {
          townCity: null,
          primaryContactName: null,
          primaryContactEmail: null,
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText(/team, services and opening hours/i)).toBeTruthy();

    cleanup();
    mockApis(
      mockState({
        shop: {
          id: 'shop_1',
          name: null,
          townCity: null,
          logoUrl: null,
          onboardingCompleted: false,
          shopPaidAt: null,
          retailEnabled: false,
          depositsEnabled: false,
        },
        owner: null,
        barbers: [],
        services: [],
        openingHours: [],
        onboarding: {
          townCity: null,
          primaryContactName: null,
          primaryContactEmail: null,
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Let’s get your KERSIVO setup ready/i });
    expect(screen.queryByText(/brought across/i)).toBeNull();
  });

  it('revision-safe autosave keeps newer edits dirty until second save', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deferred: Array<{ resolve: (r: Response) => void }> = [];
    const patches: Record<string, unknown>[] = [];
    let patchCount = 0;

    const state = mockState({
      onboarding: {
        currentStep: 1,
        townCity: 'London',
        primaryContactName: 'Alex',
        primaryContactEmail: 'alex@example.com',
      },
    });

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/api/admin/client-onboarding') && method === 'GET') {
        return jsonResponse(state);
      }
      if (method === 'PATCH') {
        const body = JSON.parse(String(init?.body));
        patches.push(body);
        patchCount += 1;
        if (patchCount === 1) {
          return new Promise<Response>((resolve) => {
            deferred.push({
              resolve: (r) => resolve(r),
            });
          });
        }
        return jsonResponse({ ok: true, onboarding: { ...state.onboarding, ...body } });
      }
      return jsonResponse({ error: 'nope' }, 500);
    });

    render(<ClientOnboardingWizard />);
    await screen.findByLabelText(/Street address/i);

    fireEvent.change(screen.getByLabelText(/Street address/i), {
      target: { value: 'Address A' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    });
    await waitFor(() => expect(deferred.length).toBe(1));

    fireEvent.change(screen.getByLabelText(/Street address/i), {
      target: { value: 'Address B' },
    });

    await act(async () => {
      deferred[0].resolve(
        jsonResponse({
          ok: true,
          onboarding: { ...state.onboarding, addressLine1: 'Address A' },
        }),
      );
    });

    expect(screen.queryByText(/^Saved$/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    });

    await waitFor(() => {
      expect(patches.some((p) => p.addressLine1 === 'Address B')).toBe(true);
    });
    expect(await screen.findByText(/^Saved$/)).toBeTruthy();
  });

  it('Continue saves opening hours before advancing; failure stays on hours', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 6,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Opening hours/i });
    fireEvent.click(screen.getByRole('switch', { name: /Tue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/barbershop-settings/hours') &&
            String((init as RequestInit)?.method).toUpperCase() === 'PUT',
        ),
      ).toBe(true);
    });
    expect(await screen.findByRole('heading', { name: /Barber availability/i })).toBeTruthy();

    cleanup();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 6,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
      { hoursFail: true },
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Opening hours/i });
    fireEvent.click(screen.getByRole('switch', { name: /Wed/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(await screen.findAllByText(/Hours failed|Could not save/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Opening hours/i })).toBeTruthy();
  });

  it('Continue saves team profiles; availability switch and Continue persist rules', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 4,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
        barbers: [
          {
            id: 'barber_1',
            name: 'Jamie',
            active: true,
            avatarUrl: null,
            sortOrder: 0,
            bio: null,
            showOnWebsite: true,
          },
          {
            id: 'barber_2',
            name: 'Sam',
            active: true,
            avatarUrl: null,
            sortOrder: 1,
            bio: null,
            showOnWebsite: true,
          },
        ],
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your team/i });
    const bio = await screen.findByLabelText((_, el) => el?.id === 'bio-barber_1');
    fireEvent.change(bio, { target: { value: 'Fade specialist' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/barber-profiles') &&
            String((init as RequestInit)?.method).toUpperCase() === 'PUT',
        ),
      ).toBe(true);
    });

    cleanup();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 7,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
        barbers: [
          {
            id: 'barber_1',
            name: 'Jamie',
            active: true,
            avatarUrl: null,
            sortOrder: 0,
            bio: null,
            showOnWebsite: true,
          },
          {
            id: 'barber_2',
            name: 'Sam',
            active: true,
            avatarUrl: null,
            sortOrder: 1,
            bio: null,
            showOnWebsite: true,
          },
        ],
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Barber availability/i });
    await waitFor(() => expect(screen.getByLabelText(/Barber/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('switch', { name: /Sat/i }));
    fireEvent.change(screen.getByLabelText(/Barber/i), { target: { value: 'barber_2' } });
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/barbers/barber_1/rules') &&
            String((init as RequestInit)?.method).toUpperCase() === 'PUT',
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('switch', { name: /Sun/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/barbers/barber_2/rules') &&
            String((init as RequestInit)?.method).toUpperCase() === 'PUT',
        ),
      ).toBe(true);
    });
  });

  it('failed availability save prevents barber switch', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 7,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
        barbers: [
          {
            id: 'barber_1',
            name: 'Jamie',
            active: true,
            avatarUrl: null,
            sortOrder: 0,
            bio: null,
            showOnWebsite: true,
          },
          {
            id: 'barber_2',
            name: 'Sam',
            active: true,
            avatarUrl: null,
            sortOrder: 1,
            bio: null,
            showOnWebsite: true,
          },
        ],
      }),
      { rulesFail: true },
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Barber availability/i });
    await waitFor(() => expect(screen.getByLabelText(/Barber/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('switch', { name: /Sat/i }));
    fireEvent.change(screen.getByLabelText(/Barber/i), { target: { value: 'barber_2' } });
    expect(await screen.findByText(/Rules failed|Could not save/i)).toBeTruthy();
    expect((screen.getByLabelText(/Barber/i) as HTMLSelectElement).value).toBe('barber_1');
  });

  it('migration Yes+CSV → No deletes CSV; delete failure keeps Yes', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 8,
          migrationRequested: true,
          migrationSource: 'Booksy',
          migrationNotes: 'Move my Booksy clients',
          migrationDataConfirmedLawful: true,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
        assets: [
          {
            id: 'csv_1',
            kind: 'MIGRATION_CSV',
            storagePath: 'private/onboarding/shop_1/export.csv',
            originalFileName: 'export.csv',
            contentType: 'text/csv',
            sizeBytes: 12,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Moving from another system/i });
    fireEvent.click(screen.getByRole('radio', { name: /^No/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/assets') &&
            String((init as RequestInit)?.method).toUpperCase() === 'DELETE',
        ),
      ).toBe(true);
    });
    expect(screen.queryByText('export.csv')).toBeNull();
    expect(screen.queryByDisplayValue('Booksy')).toBeNull();

    cleanup();
    fetchSpy.mockClear();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 8,
          migrationRequested: true,
          migrationSource: 'Booksy',
          migrationDataConfirmedLawful: true,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
        assets: [
          {
            id: 'csv_1',
            kind: 'MIGRATION_CSV',
            storagePath: 'private/x.csv',
            originalFileName: 'export.csv',
            contentType: 'text/csv',
            sizeBytes: 12,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      { deleteFail: true },
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Moving from another system/i });
    expect(screen.getByText('export.csv')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /^No/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/assets') &&
            String((init as RequestInit)?.method).toUpperCase() === 'DELETE',
        ),
      ).toBe(true);
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Yes/i }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('export.csv')).toBeTruthy();
  });

  it('preserves spaces while typing migration notes', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 8,
          migrationRequested: true,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    const notes = await screen.findByLabelText(/Migration notes/i);
    fireEvent.change(notes, { target: { value: 'Move my Booksy clients' } });
    expect((notes as HTMLTextAreaElement).value).toBe('Move my Booksy clients');
  });

  it('upload does not wipe dirty brand text', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const patches: Record<string, unknown>[] = [];
    mockApis(
      mockState({
        onboarding: {
          currentStep: 2,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
      { onPatch: (b) => patches.push(b) },
    );
    render(<ClientOnboardingWizard />);
    const tagline = await screen.findByLabelText(/Tagline/i);
    fireEvent.change(tagline, { target: { value: 'Sharp & Clean' } });
    const fileInput = screen.getByLabelText(/Upload Logo/i);
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('logo.png')).toBeTruthy());
    expect((tagline as HTMLInputElement).value).toBe('Sharp & Clean');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    });
    await waitFor(() => {
      expect(patches.some((p) => p.tagline === 'Sharp & Clean')).toBe(true);
    });
  });

  it('edits existing barber name and service price via canonical APIs', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 4,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    const nameInput = await screen.findByLabelText((_, el) => el?.id === 'barber-name-barber_1');
    await screen.findByLabelText((_, el) => el?.id === 'barber-svc-barber_1-svc_1');
    fireEvent.change(nameInput, { target: { value: 'Jamie Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save team member/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([url, init]) => {
          if (!String(url).endsWith('/api/admin/barbers')) return false;
          if (String((init as RequestInit)?.method).toUpperCase() !== 'POST') return false;
          const body = JSON.parse(String((init as RequestInit).body));
          return body.id === 'barber_1' && body.name === 'Jamie Updated';
        }),
      ).toBe(true);
    });

    cleanup();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 5,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your services/i });
    const price = document.getElementById('svc-price-svc_1') as HTMLInputElement;
    const duration = document.getElementById('svc-duration-svc_1') as HTMLInputElement;
    expect(price).toBeTruthy();
    fireEvent.change(price, { target: { value: '30' } });
    fireEvent.change(duration, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /Save service/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([url, init]) => {
          if (!String(url).includes('/api/admin/services/svc_1')) return false;
          if (String((init as RequestInit)?.method).toUpperCase() !== 'PATCH') return false;
          const body = JSON.parse(String((init as RequestInit).body));
          return body.pricePence === 3000 && body.durationMinutes === 45;
        }),
      ).toBe(true);
    });
  });

  it('Team leave saves dirty name on Continue and serviceIds on Back; POST fail stays', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 4,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your team/i });
    await screen.findByLabelText((_, el) => el?.id === 'barber-svc-barber_1-svc_1');
    const nameInput = await screen.findByLabelText((_, el) => el?.id === 'barber-name-barber_1');
    fireEvent.change(nameInput, { target: { value: 'Jamie Leave' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([url, init]) => {
          if (!String(url).endsWith('/api/admin/barbers')) return false;
          if (String((init as RequestInit)?.method).toUpperCase() !== 'POST') return false;
          const body = JSON.parse(String((init as RequestInit).body));
          return body.id === 'barber_1' && body.name === 'Jamie Leave';
        }),
      ).toBe(true);
    });
    expect(await screen.findByRole('heading', { name: /Your services/i })).toBeTruthy();

    cleanup();
    fetchSpy.mockClear();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 4,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
        services: [
          {
            id: 'svc_1',
            name: 'Skin Fade',
            isActive: true,
            pricePence: 2500,
            durationMinutes: 30,
          },
          {
            id: 'svc_2',
            name: 'Beard Trim',
            isActive: true,
            pricePence: 1500,
            durationMinutes: 20,
          },
        ],
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your team/i });
    await screen.findByLabelText((_, el) => el?.id === 'barber-svc-barber_1-svc_2');
    // Mock GET barbers only returns svc_1 linked; uncheck svc_1 and check svc_2
    const svc1 = await screen.findByLabelText((_, el) => el?.id === 'barber-svc-barber_1-svc_1');
    const svc2 = await screen.findByLabelText((_, el) => el?.id === 'barber-svc-barber_1-svc_2');
    fireEvent.click(svc1);
    fireEvent.click(svc2);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([url, init]) => {
          if (!String(url).endsWith('/api/admin/barbers')) return false;
          if (String((init as RequestInit)?.method).toUpperCase() !== 'POST') return false;
          const body = JSON.parse(String((init as RequestInit).body));
          return (
            body.id === 'barber_1' &&
            Array.isArray(body.serviceIds) &&
            body.serviceIds.length === 1 &&
            body.serviceIds[0] === 'svc_2'
          );
        }),
      ).toBe(true);
    });

    cleanup();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 4,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
      { barbersFail: true },
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your team/i });
    await screen.findByLabelText((_, el) => el?.id === 'barber-svc-barber_1-svc_1');
    fireEvent.change(await screen.findByLabelText((_, el) => el?.id === 'barber-name-barber_1'), {
      target: { value: 'Will Fail' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(await screen.findAllByText(/Barber save failed|Could not save/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Your team/i })).toBeTruthy();
  });

  it('Services leave saves dirty price on Continue and barberIds on Back; PATCH fail stays', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 5,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your services/i });
    await screen.findByLabelText((_, el) => el?.id === 'svc-barber-svc_1-barber_1');
    fireEvent.change(document.getElementById('svc-price-svc_1') as HTMLInputElement, {
      target: { value: '40' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([url, init]) => {
          if (!String(url).includes('/api/admin/services/svc_1')) return false;
          if (String((init as RequestInit)?.method).toUpperCase() !== 'PATCH') return false;
          const body = JSON.parse(String((init as RequestInit).body));
          return body.pricePence === 4000;
        }),
      ).toBe(true);
    });
    expect(await screen.findByRole('heading', { name: /Opening hours/i })).toBeTruthy();

    cleanup();
    fetchSpy.mockClear();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 5,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your services/i });
    const barberBox = await screen.findByLabelText((_, el) => el?.id === 'svc-barber-svc_1-barber_1');
    fireEvent.click(barberBox);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([url, init]) => {
          if (!String(url).includes('/api/admin/services/svc_1')) return false;
          if (String((init as RequestInit)?.method).toUpperCase() !== 'PATCH') return false;
          const body = JSON.parse(String((init as RequestInit).body));
          return Array.isArray(body.barberIds) && body.barberIds.length === 0;
        }),
      ).toBe(true);
    });

    cleanup();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 5,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
      { servicesFail: true },
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your services/i });
    await screen.findByLabelText((_, el) => el?.id === 'svc-barber-svc_1-barber_1');
    fireEvent.change(document.getElementById('svc-price-svc_1') as HTMLInputElement, {
      target: { value: '55' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(await screen.findAllByText(/Service save failed|Could not save/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Your services/i })).toBeTruthy();
  });

  it('Hours and Availability Back persist dirty edits', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 6,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Opening hours/i });
    fireEvent.click(screen.getByRole('switch', { name: /Thu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/barbershop-settings/hours') &&
            String((init as RequestInit)?.method).toUpperCase() === 'PUT',
        ),
      ).toBe(true);
    });

    cleanup();
    fetchSpy.mockClear();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 7,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Barber availability/i });
    await waitFor(() => expect(screen.getByLabelText(/Barber/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('switch', { name: /Sat/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/barbers/barber_1/rules') &&
            String((init as RequestInit)?.method).toUpperCase() === 'PUT',
        ),
      ).toBe(true);
    });
  });

  it('unfinished Add barber / Add service fields do not auto-create on leave', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 4,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your team/i });
    await screen.findByLabelText((_, el) => el?.id === 'barber-svc-barber_1-svc_1');
    fireEvent.change(screen.getByLabelText((_, el) => el?.id === 'newBarberName'), {
      target: { value: 'Unfinished Barber' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Your services/i });
    expect(
      fetchSpy.mock.calls.some(([url, init]) => {
        if (!String(url).endsWith('/api/admin/barbers')) return false;
        if (String((init as RequestInit)?.method).toUpperCase() !== 'POST') return false;
        const body = JSON.parse(String((init as RequestInit).body));
        return body.name === 'Unfinished Barber' && !body.id;
      }),
    ).toBe(false);

    cleanup();
    fetchSpy.mockClear();
    mockApis(
      mockState({
        onboarding: {
          currentStep: 5,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your services/i });
    fireEvent.change(document.getElementById('newServiceName') as HTMLInputElement, {
      target: { value: 'Unfinished Service' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Opening hours/i });
    expect(
      fetchSpy.mock.calls.some(([url, init]) => {
        if (!String(url).endsWith('/api/admin/services')) return false;
        if (String((init as RequestInit)?.method).toUpperCase() !== 'POST') return false;
        const body = JSON.parse(String((init as RequestInit).body));
        return body.name === 'Unfinished Service';
      }),
    ).toBe(false);
  });

  it('Review shows neutral availability summary without stale day count', async () => {
    mockApis(
      mockState({
        onboarding: {
          currentStep: 11,
          townCity: 'London',
          primaryContactName: 'Alex',
          primaryContactEmail: 'a@b.c',
        },
        workspace: {
          shopName: 'Sharp Cuts',
          activeBarberCount: 1,
          activeServiceCount: 1,
          activeShopOpenDayCount: 5,
          activeBarberAvailabilityDayCount: 99,
          productCount: 0,
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText(/Availability set for Jamie/i)).toBeTruthy();
    expect(screen.queryByText(/99 barber availability/i)).toBeNull();
  });

  it('handles unpaid and SUBMITTED gates', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { error: 'Paid required', code: 'CLIENT_ONBOARDING_REQUIRES_PAID_SUBSCRIPTION' },
        403,
      ),
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText(/after a successful KERSIVO subscription purchase/i)).toBeTruthy();

    cleanup();
    mockApis(
      mockState({
        onboarding: {
          status: ClientOnboardingStatus.SUBMITTED,
          submittedAt: '2026-08-07T12:00:00.000Z',
        },
        completion: {
          readyToSubmit: true,
          missing: [],
          submitted: true,
          writeLocked: true,
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByRole('heading', { name: /have been submitted/i })).toBeTruthy();
  });
});
