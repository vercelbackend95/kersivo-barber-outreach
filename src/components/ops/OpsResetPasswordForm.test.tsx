/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    resetPassword: (...args: unknown[]) => resetPassword(...args),
  },
}));

import OpsResetPasswordForm, {
  INVALID_TOKEN_MESSAGE,
  SUCCESS_REDIRECT,
} from './OpsResetPasswordForm';

const here = dirname(fileURLToPath(import.meta.url));

function setSearch(search: string) {
  window.history.pushState({}, '', `/ops/reset-password${search}`);
}

describe('OpsResetPasswordForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    setSearch('');
  });

  it('handles missing token safely', () => {
    setSearch('');
    render(<OpsResetPasswordForm />);
    expect(screen.getByRole('alert').textContent).toBe(INVALID_TOKEN_MESSAGE);
    expect(screen.queryByPlaceholderText('New password')).toBeNull();
  });

  it('handles invalid/expired token query safely', () => {
    setSearch('?error=INVALID_TOKEN');
    render(<OpsResetPasswordForm />);
    expect(screen.getByRole('alert').textContent).toBe(INVALID_TOKEN_MESSAGE);
  });

  it('requires matching passwords of at least 8 characters', async () => {
    setSearch('?token=valid-token');
    render(<OpsResetPasswordForm />);

    fireEvent.change(screen.getByPlaceholderText('New password'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/at least 8/i);
    expect(resetPassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('New password'), {
      target: { value: 'long-enough' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'different!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/do not match/i);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('shows safe error for invalid token from API', async () => {
    setSearch('?token=expired-token');
    resetPassword.mockResolvedValue({
      data: null,
      error: { message: 'INVALID_TOKEN' },
    });

    render(<OpsResetPasswordForm />);

    fireEvent.change(screen.getByPlaceholderText('New password'), {
      target: { value: 'new-password-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'new-password-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect((await screen.findByRole('alert')).textContent).toBe(INVALID_TOKEN_MESSAGE);
  });

  it('redirects to /ops/recommendations on successful reset', async () => {
    setSearch('?token=valid-token');
    resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        search: '?token=valid-token',
        assign,
      },
    });

    try {
      render(<OpsResetPasswordForm />);

      fireEvent.change(screen.getByPlaceholderText('New password'), {
        target: { value: 'new-password-1' },
      });
      fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
        target: { value: 'new-password-1' },
      });
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(resetPassword).toHaveBeenCalledWith({
          newPassword: 'new-password-1',
          token: 'valid-token',
        });
        expect(assign).toHaveBeenCalledWith(SUCCESS_REDIRECT);
      });
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});

describe('ops reset-password page source gates', () => {
  it('uses noindex and private no-store', () => {
    const src = readFileSync(join(here, '../../pages/ops/reset-password.astro'), 'utf8');
    expect(src).toContain("Cache-Control', 'private, no-store'");
    expect(src).toContain('noindex={true}');
    expect(src).toContain('OpsResetPasswordForm');
  });
});
