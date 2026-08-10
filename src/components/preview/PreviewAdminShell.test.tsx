/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/admin/AdminPanel', () => ({
  default: function MockAdminPanel() {
    return React.createElement('div', { 'data-testid': 'real-admin-panel' }, 'AdminPanel');
  },
}));

import PreviewAdminShell from './PreviewAdminShell';

describe('PreviewAdminShell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('gates when preview cookie is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    render(React.createElement(PreviewAdminShell));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /preview session expired/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /build my barbershop/i }).getAttribute('href')).toBe(
      '/preview/onboarding',
    );
  });

  it('mounts real AdminPanel when session ok', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, via: 'preview', shopId: 'shop_1' }), { status: 200 }),
    );
    render(React.createElement(PreviewAdminShell));
    await waitFor(() => {
      expect(screen.getByTestId('real-admin-panel')).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /get started — £39\/month/i }).getAttribute('href')).toBe(
      '/admin/launch',
    );
  });
});
