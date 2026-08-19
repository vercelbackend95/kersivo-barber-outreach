/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyLaunchProgress } from '@/lib/admin/launchCtaProgress';
import AdminSidebarLaunchCta from './AdminSidebarLaunchCta';

describe('AdminSidebarLaunchCta', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders status and checklist from launch-context', async () => {
    const progress = emptyLaunchProgress();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ progress, pending: false, paid: false, paidHref: null }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSidebarLaunchCta />);

    await waitFor(() => {
      expect(screen.getByText('IN PROGRESS')).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/setup/launch-context', { credentials: 'include' });
    expect(screen.getByText('Continue Setup')).toBeTruthy();
    expect(screen.getByText('Barbershop created')).toBeTruthy();
    expect(screen.getByText('First barber added')).toBeTruthy();
    expect(screen.getByText('Services added')).toBeTruthy();
    expect(screen.getByText('Set up your retail shop')).toBeTruthy();

    const cta = screen.getByRole('button');
    expect(cta.className).toContain('admin-sidebar-launch-cta');
    expect(cta.className).not.toContain('--conversion');
    expect(cta.querySelector('.admin-sidebar-launch-cta__checklist')).toBeTruthy();
  });
});
