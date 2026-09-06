/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { requestPasswordReset, signInEmail, signUpEmail, signInSocial } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    requestPasswordReset,
    signIn: {
      email: (...args: unknown[]) => signInEmail(...args),
      social: (...args: unknown[]) => signInSocial(...args),
    },
    signUp: {
      email: (...args: unknown[]) => signUpEmail(...args),
    },
  },
}));

import PrivateDemoAuthPanel, {
  PASSWORD_RESET_SENT_MESSAGE,
} from './PrivateDemoAuthPanel';

describe('PrivateDemoAuthPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('defaults keep Google and Create account for shop-admin auth', async () => {
    render(<PrivateDemoAuthPanel embedded />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByRole('button', { name: /create account/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /forgot password/i })).toBeNull();
  });

  it('hides Google and Create account for operator props', async () => {
    render(
      <PrivateDemoAuthPanel
        embedded
        initialMode="login"
        showGoogle={false}
        allowSignup={false}
        passwordResetRedirectTo="/ops/reset-password"
      />,
    );

    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
    expect(screen.queryByText(/^or$/i)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'hello@kersivo.co.uk' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /create account/i })).toBeNull();
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeTruthy();
  });

  it('requests password reset with hello email and same-origin reset path', async () => {
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });

    render(
      <PrivateDemoAuthPanel
        embedded
        initialMode="login"
        showGoogle={false}
        allowSignup={false}
        passwordResetRedirectTo="/ops/reset-password"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'hello@kersivo.co.uk' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /forgot password/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    });

    const arg = requestPasswordReset.mock.calls[0][0] as {
      email: string;
      redirectTo: string;
    };
    expect(arg.email).toBe('hello@kersivo.co.uk');
    expect(arg.redirectTo).toContain('/ops/reset-password');
    expect(new URL(arg.redirectTo).origin).toBe(window.location.origin);

    const status = await screen.findByRole('status');
    expect(status.textContent).toBe(PASSWORD_RESET_SENT_MESSAGE);
  });

  it('shows the same neutral confirmation when reset request fails', async () => {
    requestPasswordReset.mockRejectedValue(new Error('network'));

    render(
      <PrivateDemoAuthPanel
        embedded
        initialMode="login"
        showGoogle={false}
        allowSignup={false}
        passwordResetRedirectTo="/ops/reset-password"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'unknown@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /forgot password/i }));

    const status = await screen.findByRole('status');
    expect(status.textContent).toBe(PASSWORD_RESET_SENT_MESSAGE);
    expect(screen.queryByText(/does not exist|not found|no account/i)).toBeNull();
  });

  it('blocks double-submit while forgot-password request is pending', async () => {
    let resolveRequest!: (value: unknown) => void;
    requestPasswordReset.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(
      <PrivateDemoAuthPanel
        embedded
        initialMode="login"
        showGoogle={false}
        allowSignup={false}
        passwordResetRedirectTo="/ops/reset-password"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'hello@kersivo.co.uk' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    const forgot = await screen.findByRole('button', { name: /forgot password/i });
    fireEvent.click(forgot);
    fireEvent.click(forgot);

    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    resolveRequest({ data: { status: true }, error: null });
    await screen.findByRole('status');
  });
});
