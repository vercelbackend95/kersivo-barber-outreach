/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClientOnboardingDomainMode, ClientOnboardingStatus } from '@prisma/client';
import ClientOnboardingWizard from './ClientOnboardingWizard';
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

describe('ClientOnboardingWizard', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function mockGet(state: ClientOnboardingState) {
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/api/admin/client-onboarding/submit') && method === 'POST') {
        return jsonResponse({
          onboarding: {
            ...state.onboarding,
            status: ClientOnboardingStatus.SUBMITTED,
            submittedAt: '2026-08-07T12:00:00.000Z',
          },
        });
      }

      if (url.includes('/api/admin/client-onboarding') && !url.includes('/assets') && !url.includes('/barber-profiles') && !url.includes('/submit')) {
        if (method === 'GET') return jsonResponse(state);
        if (method === 'PATCH' || method === 'PUT') {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          return jsonResponse({
            ok: true,
            onboarding: { ...state.onboarding, ...body },
          });
        }
      }

      if (url.includes('/api/admin/barbers/') && url.includes('/rules')) {
        return jsonResponse({
          rules: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
            dayOfWeek,
            active: dayOfWeek <= 5,
            startTime: '09:00',
            endTime: '18:00',
          })),
        });
      }

      return jsonResponse({ error: `Unhandled ${method} ${url}` }, 500);
    });
  }

  it('loads existing state and shows welcome', async () => {
    mockGet(mockState());
    render(<ClientOnboardingWizard />);
    expect(await screen.findByRole('heading', { name: /Let’s get your KERSIVO setup ready/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start setup/i })).toBeTruthy();
  });

  it('restores current step on load', async () => {
    mockGet(
      mockState({
        onboarding: {
          currentStep: 1,
          primaryContactName: 'Alex Owner',
          primaryContactEmail: 'alex@example.com',
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByRole('heading', { name: /Your business/i })).toBeTruthy();
    expect(screen.getByText(/Step 1 of 11/i)).toBeTruthy();
  });

  it('prefills existing values and shows brought-across note when meaningful', async () => {
    mockGet(mockState());
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText(/We’ve brought across the information you already added/i)).toBeTruthy();
  });

  it('does not show prefill note when nothing meaningful exists', async () => {
    mockGet(
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
        barbers: [],
        services: [],
        openingHours: [],
        onboarding: {
          primaryContactName: null,
          primaryContactEmail: null,
          addressLine1: null,
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Let’s get your KERSIVO setup ready/i });
    expect(screen.queryByText(/We’ve brought across the information you already added/i)).toBeNull();
  });

  it('Continue saves step via PATCH', async () => {
    const state = mockState({ onboarding: { currentStep: 1 } });
    mockGet(state);
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your business/i });

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      const patchCalls = fetchSpy.mock.calls.filter(
        ([url, init]) =>
          String(url).includes('/api/admin/client-onboarding') &&
          String((init as RequestInit | undefined)?.method ?? '').toUpperCase() === 'PATCH',
      );
      expect(patchCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(String((patchCalls.at(-1)?.[1] as RequestInit).body));
      expect(body.currentStep).toBe(2);
    });
    expect(await screen.findByRole('heading', { name: /Your brand/i })).toBeTruthy();
  });

  it('autosave eventually saves dirty field changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const state = mockState({ onboarding: { currentStep: 1 } });
    mockGet(state);
    render(<ClientOnboardingWizard />);
    await screen.findByLabelText(/Street address/i);

    fireEvent.change(screen.getByLabelText(/Street address/i), {
      target: { value: '12 High Street' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    await waitFor(() => {
      const patchCalls = fetchSpy.mock.calls.filter(
        ([url, init]) =>
          String(url).includes('/api/admin/client-onboarding') &&
          String((init as RequestInit | undefined)?.method ?? '').toUpperCase() === 'PATCH',
      );
      const bodies = patchCalls.map(([, init]) =>
        JSON.parse(String((init as RequestInit).body)),
      );
      expect(bodies.some((b) => b.addressLine1 === '12 High Street')).toBe(true);
    });
  });

  it('autosave failure shows error state and does not claim Saved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const state = mockState({ onboarding: { currentStep: 1 } });
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/api/admin/client-onboarding') && method === 'GET') {
        return jsonResponse(state);
      }
      if (method === 'PATCH') {
        return jsonResponse({ error: 'Save failed.' }, 500);
      }
      return jsonResponse({ error: 'nope' }, 500);
    });

    render(<ClientOnboardingWizard />);
    await screen.findByLabelText(/Street address/i);
    fireEvent.change(screen.getByLabelText(/Street address/i), {
      target: { value: '12 High Street' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(await screen.findByText(/Could not save|Save failed|Couldn’t save/i)).toBeTruthy();
    expect(screen.queryByText(/^Saved$/)).toBeNull();
  });

  it('optional marketing consents start unchecked', async () => {
    mockGet(mockState({ onboarding: { currentStep: 10 } }));
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Final details/i });
    const portfolio = screen.getByRole('checkbox', {
      name: /feature my business in its portfolio/i,
    });
    const social = screen.getByRole('checkbox', {
      name: /feature my business on social media/i,
    });
    const ads = screen.getByRole('checkbox', {
      name: /use my business in advertising/i,
    });
    const study = screen.getByRole('checkbox', {
      name: /use my business as a case study/i,
    });
    expect((portfolio as HTMLInputElement).checked).toBe(false);
    expect((social as HTMLInputElement).checked).toBe(false);
    expect((ads as HTMLInputElement).checked).toBe(false);
    expect((study as HTMLInputElement).checked).toBe(false);
  });

  it('migration has explicit Yes/No and Yes reveals lawful + CSV upload', async () => {
    mockGet(mockState({ onboarding: { currentStep: 8 } }));
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Moving from another system/i });
    expect(screen.getByRole('radio', { name: /^Yes/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^No/i })).toBeTruthy();
    expect(screen.queryByLabelText(/authorised to provide this customer data/i)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /^Yes/i }));
    expect(
      await screen.findByText(/authorised to provide this customer data/i),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Upload Customer export/i)).toBeTruthy();
  });

  it('KERSIVO domain registration reveals authorisation checkbox unchecked', async () => {
    mockGet(mockState({ onboarding: { currentStep: 3 } }));
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your domain/i });

    fireEvent.click(
      screen.getByRole('radio', { name: /I’d like KERSIVO to register a domain/i }),
    );
    const auth = await screen.findByRole('checkbox', {
      name: /authorise KERSIVO to register/i,
    });
    expect((auth as HTMLInputElement).checked).toBe(false);
    expect(screen.getByLabelText(/1st choice domain/i)).toBeTruthy();
  });

  it('existing domain mode shows domain input', async () => {
    mockGet(mockState({ onboarding: { currentStep: 3 } }));
    render(<ClientOnboardingWizard />);
    await screen.findByRole('heading', { name: /Your domain/i });
    fireEvent.click(screen.getByRole('radio', { name: /I already have a domain/i }));
    expect(await screen.findByLabelText(/^Your domain$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/registrar password/i)).toBeNull();
  });

  it('displays canonical barbers and services', async () => {
    mockGet(mockState({ onboarding: { currentStep: 4 } }));
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText('Jamie')).toBeTruthy();

    // jump via reload with step 5 — re-render with services step
    cleanup();
    mockGet(mockState({ onboarding: { currentStep: 5 } }));
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText('Skin Fade')).toBeTruthy();
    expect(screen.getByText(/£25/)).toBeTruthy();
  });

  it('submit loading prevents double submit', async () => {
    const state = mockState({
      onboarding: {
        currentStep: 11,
        contentRightsConfirmed: true,
        informationAccuracyConfirmed: true,
      },
    });
    let resolveSubmit: ((value: Response) => void) | null = null;
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/submit') && method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveSubmit = resolve;
        });
      }
      if (url.includes('/api/admin/client-onboarding') && method === 'GET') {
        return jsonResponse(state);
      }
      if (method === 'PATCH') {
        return jsonResponse({ ok: true, onboarding: state.onboarding });
      }
      return jsonResponse({ error: 'nope' }, 500);
    });

    render(<ClientOnboardingWizard />);
    const submit = await screen.findByRole('button', { name: /Submit setup details/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => {
      const submits = fetchSpy.mock.calls.filter(([url, init]) =>
        String(url).includes('/submit') &&
        String((init as RequestInit | undefined)?.method ?? '').toUpperCase() === 'POST',
      );
      expect(submits).toHaveLength(1);
    });

    await act(async () => {
      resolveSubmit?.(
        jsonResponse({
          onboarding: {
            ...state.onboarding,
            status: ClientOnboardingStatus.SUBMITTED,
            submittedAt: '2026-08-07T12:00:00.000Z',
          },
        }),
      );
    });
  });

  it('handles server validation errors and maps missing items', async () => {
    const state = mockState({ onboarding: { currentStep: 11 } });
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/submit') && method === 'POST') {
        return jsonResponse(
          { error: 'Please fix the highlighted details.', missing: ['Add at least one active service.'] },
          400,
        );
      }
      if (url.includes('/api/admin/client-onboarding') && method === 'GET') {
        return jsonResponse(state);
      }
      if (method === 'PATCH') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse({ ok: true, onboarding: { ...state.onboarding, ...body } });
      }
      return jsonResponse({ error: 'nope' }, 500);
    });

    render(<ClientOnboardingWizard />);
    fireEvent.click(await screen.findByRole('button', { name: /Submit setup details/i }));
    expect(await screen.findByText(/Add at least one active service/i)).toBeTruthy();
    expect(await screen.findByRole('heading', { name: /Your services/i })).toBeTruthy();
  });

  it('SUBMITTED shows read-only confirmation', async () => {
    mockGet(
      mockState({
        onboarding: {
          status: ClientOnboardingStatus.SUBMITTED,
          submittedAt: '2026-08-07T12:00:00.000Z',
          currentStep: 11,
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
    expect(
      await screen.findByRole('heading', { name: /Your setup details have been submitted/i }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue/i })).toBeNull();
  });

  it('NEEDS_CHANGES is editable with Resubmit CTA', async () => {
    mockGet(
      mockState({
        onboarding: {
          status: ClientOnboardingStatus.NEEDS_CHANGES,
          currentStep: 11,
        },
      }),
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText(/We need a few updates/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resubmit setup details/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Edit$/i }).length).toBeGreaterThan(0);
  });

  it('READY_FOR_BUILD is read-only confirmation', async () => {
    mockGet(
      mockState({
        onboarding: {
          status: ClientOnboardingStatus.READY_FOR_BUILD,
          currentStep: 11,
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
    expect(await screen.findByRole('heading', { name: /Your setup is being prepared/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continue/i })).toBeNull();
  });

  it('private asset UI never builds a public Blob URL from storagePath', async () => {
    mockGet(
      mockState({
        onboarding: { currentStep: 2 },
        assets: [
          {
            id: 'asset_1',
            kind: 'BRAND_LOGO',
            storagePath: 'private/onboarding/shop_1/logo.png',
            originalFileName: 'logo.png',
            contentType: 'image/png',
            sizeBytes: 1200,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText('logo.png')).toBeTruthy();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/https?:\/\/.*blob\.vercel-storage/i);
    expect(html).not.toContain('private/onboarding/shop_1/logo.png');
    expect(screen.queryByRole('img', { name: /logo/i })).toBeNull();
  });

  it('handles unpaid gate', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { error: 'Paid subscription required.', code: 'CLIENT_ONBOARDING_REQUIRES_PAID_SUBSCRIPTION' },
        403,
      ),
    );
    render(<ClientOnboardingWizard />);
    expect(
      await screen.findByText(/available after a successful KERSIVO subscription purchase/i),
    ).toBeTruthy();
  });

  it('handles forbidden non-owner gate', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'Owner only.' }, 403));
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText(/only be completed by the account owner/i)).toBeTruthy();
  });

  it('handles unauthorized with sign-in affordance', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));
    render(<ClientOnboardingWizard />);
    expect(await screen.findByText(/Sign in to continue/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign in again/i })).toBeTruthy();
  });
});
