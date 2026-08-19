/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { notifyAdminDemoBlocked } from './adminAuth';
import DemoActionLock from './DemoActionLock';

const trackSpy = vi.mocked(trackConsentedEvent);

describe('DemoActionLock', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps a single BLACKLINE conversion card and restores focus', async () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open lock';
    document.body.append(trigger);
    trigger.focus();

    render(<DemoActionLock variant="blackline" />);

    notifyAdminDemoBlocked();
    notifyAdminDemoBlocked();

    const dialog = await screen.findByRole('dialog', { name: /sample data/i });
    expect(document.querySelectorAll('.admin-demo-lock__card')).toHaveLength(1);
    expect(dialog.querySelector('.admin-demo-lock__card--blackline.auth-gate-card')).toBeTruthy();
    expect(screen.getByText('DEMO MODE')).toBeTruthy();
    expect(
      screen.getByText(
        'This BLACKLINE owner dashboard is read-only. Changes reset automatically and no real appointments, orders or payments are created.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Ready to make it yours?')).toBeTruthy();
    expect(
      screen.getByText(
        'Create your own KERSIVO barbershop and customise your services, products, team and opening hours.',
      ),
    ).toBeTruthy();

    const create = screen.getByRole('link', { name: /create my barbershop/i });
    expect(create.getAttribute('href')).toBe('/admin/launch');
    create.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(create);
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_admin_create_system_click,
      { source: 'admin_demo_lock' },
      'analytics',
    );

    const close = screen.getByRole('button', { name: 'Close demo message' });
    await waitFor(() => {
      expect(close).toBe(document.activeElement);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue exploring' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);

    notifyAdminDemoBlocked();
    await screen.findByRole('dialog', { name: /sample data/i });
    fireEvent.click(screen.getByRole('button', { name: 'Close demo message' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('does not add BLACKLINE conversion copy to the generic lock', async () => {
    render(<DemoActionLock variant="generic" />);
    notifyAdminDemoBlocked();
    await screen.findByRole('dialog', { name: /want to try this with your own shop/i });
    expect(screen.getByRole('button', { name: 'Build My Demo' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /create my barbershop/i })).toBeNull();
    expect(screen.queryByText('DEMO MODE')).toBeNull();
  });
});
