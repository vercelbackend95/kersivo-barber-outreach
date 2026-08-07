/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SetupSuccessSaasContinue from './SetupSuccessSaasContinue';

const assignMock = vi.fn();

vi.mock('@/components/admin/PrivateDemoAuthPanel', () => ({
  default: function MockAuthPanel({
    callbackURL,
    title,
  }: {
    callbackURL?: string;
    title?: string;
  }) {
    return (
      <div data-testid="auth-panel" data-callback-url={callbackURL ?? ''}>
        {title}
      </div>
    );
  },
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SetupSuccessSaasContinue', () => {
  const sessionId = 'cs_test_saas_cutover_1';

  beforeEach(() => {
    assignMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: assignMock, href: `/setup/success?session_id=${sessionId}` },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ authenticated: false }, 401)),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not render Tally / external onboarding form CTA', async () => {
    render(<SetupSuccessSaasContinue stripeSessionId={sessionId} customerEmail="buyer@example.com" />);
    expect(screen.getByRole('button', { name: /continue your setup/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /complete your onboarding/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/We’ve sent your onboarding form/i);
    expect(document.body.textContent).not.toMatch(/tally\.so/i);
  });

  it('shows auth panel with session_id callbackURL on 401', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/session')) {
        return jsonResponse({ authenticated: false }, 401);
      }
      if (url.includes('/api/setup/claim-paid-subscription')) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      return jsonResponse({}, 500);
    });

    render(<SetupSuccessSaasContinue stripeSessionId={sessionId} customerEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /continue your setup/i }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-panel')).toBeTruthy();
    });
    expect(screen.getByTestId('auth-panel').getAttribute('data-callback-url')).toBe(
      `/setup/success?session_id=${sessionId}`,
    );
  });

  it('calls claim with original session id and redirects on success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/admin/session')) {
        return jsonResponse({ authenticated: true }, 200);
      }
      if (url.includes('/api/setup/claim-paid-subscription')) {
        expect(init?.method).toBe('POST');
        expect(init?.credentials).toBe('include');
        const body = JSON.parse(String(init?.body ?? '{}')) as { stripeSessionId?: string };
        expect(body.stripeSessionId).toBe(sessionId);
        return jsonResponse({ ok: true }, 200);
      }
      return jsonResponse({}, 500);
    });

    render(<SetupSuccessSaasContinue stripeSessionId={sessionId} customerEmail="buyer@example.com" />);

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/admin/client-onboarding');
    });
  });

  it('shows EMAIL_MISMATCH friendly copy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/session')) {
        return jsonResponse({ authenticated: false }, 401);
      }
      if (url.includes('/api/setup/claim-paid-subscription')) {
        return jsonResponse({ code: 'EMAIL_MISMATCH', error: 'mismatch' }, 403);
      }
      return jsonResponse({}, 500);
    });

    render(<SetupSuccessSaasContinue stripeSessionId={sessionId} customerEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /continue your setup/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Please sign in with the same email address you used when purchasing KERSIVO.',
        ),
      ).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('offers retry on temporary claim failure without losing session id', async () => {
    const fetchMock = vi.mocked(fetch);
    let claimCalls = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/admin/session')) {
        return jsonResponse({ authenticated: false }, 401);
      }
      if (url.includes('/api/setup/claim-paid-subscription')) {
        claimCalls += 1;
        const body = JSON.parse(String(init?.body ?? '{}')) as { stripeSessionId?: string };
        expect(body.stripeSessionId).toBe(sessionId);
        if (claimCalls === 1) {
          return jsonResponse({ code: 'MARK_SHOP_PAID_FAILED' }, 503);
        }
        return jsonResponse({ ok: true }, 200);
      }
      return jsonResponse({}, 500);
    });

    render(<SetupSuccessSaasContinue stripeSessionId={sessionId} customerEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /continue your setup/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/admin/client-onboarding');
    });
    expect(claimCalls).toBe(2);
  });

  it('is retry-safe when claim succeeds again after remount (idempotent UX)', async () => {
    const fetchMock = vi.mocked(fetch);
    let claimCalls = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/session')) {
        return jsonResponse({ authenticated: false }, 401);
      }
      if (url.includes('/api/setup/claim-paid-subscription')) {
        claimCalls += 1;
        return jsonResponse({ ok: true }, 200);
      }
      return jsonResponse({}, 500);
    });

    render(<SetupSuccessSaasContinue stripeSessionId={sessionId} customerEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /continue your setup/i }));
    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));

    cleanup();
    assignMock.mockClear();
    claimCalls = 0;
    render(<SetupSuccessSaasContinue stripeSessionId={sessionId} customerEmail="buyer@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /continue your setup/i }));
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/admin/client-onboarding'));
    expect(claimCalls).toBe(1);
  });
});
