/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OWNER_LAUNCH_HREF } from '@/lib/admin/launchCtaProgress';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import BlacklineConversionCard from './BlacklineConversionCard';

describe('BlacklineConversionCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the static launch CTA, not a promotional card or setup checklist', () => {
    const { container } = render(<BlacklineConversionCard />);

    const cta = screen.getByRole('link', {
      name: 'Launch my barbershop. Review your setup and go live',
    });
    expect(cta.getAttribute('href')).toBe(OWNER_LAUNCH_HREF);
    expect(cta.getAttribute('href')).toBe('/admin/launch');
    expect(cta.getAttribute('aria-label')).toBe(
      'Launch my barbershop. Review your setup and go live',
    );
    expect(cta.className).toContain('admin-sidebar-launch-cta');
    expect(cta.className).toContain('admin-sidebar-launch-cta--conversion');
    expect(cta.getAttribute('data-track')).toBe(FUNNEL_EVENTS.blackline_admin_create_system_click);
    expect(cta.querySelector('.admin-sidebar-launch-cta__icon svg')).toBeTruthy();
    expect(cta.querySelector('.admin-sidebar-launch-cta__arrow svg')).toBeTruthy();
    expect(cta.querySelector('.admin-sidebar-launch-cta__status')?.textContent).toBe(
      'YOUR SHOP IS READY',
    );
    expect(cta.querySelector('.admin-sidebar-launch-cta__title')?.textContent).toBe(
      'Launch my barbershop',
    );
    expect(cta.querySelector('.admin-sidebar-launch-cta__supporting')?.textContent).toBe(
      'Review your setup & go live',
    );

    expect(screen.queryByText(/choose your plan/i)).toBeNull();
    expect(container.textContent).not.toMatch(/choose your plan/i);
    expect(screen.queryByText('MAKE IT YOURS')).toBeNull();
    expect(screen.queryByText('CREATE MY SYSTEM')).toBeNull();
    expect(screen.queryByText('VIEW PLANS')).toBeNull();
    expect(screen.queryByText('IN PROGRESS')).toBeNull();
    expect(screen.queryByText('READY TO LAUNCH')).toBeNull();
    expect(container.querySelector('.admin-sidebar-launch-cta__checklist')).toBeNull();
    expect(container.querySelector('.admin-blackline-status-card')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('progress')).toBeNull();
    expect(container.querySelector('[type="checkbox"]')).toBeNull();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.textContent).not.toMatch(/callback|book a demo|contact us|sales call/i);
  });
});
