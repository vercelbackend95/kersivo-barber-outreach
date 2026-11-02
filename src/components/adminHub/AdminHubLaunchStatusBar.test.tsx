/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SETUP_LAUNCH_BAR_OPEN, setupPhase1Items, setupPhase2Items } from '@/lib/adminHub/setupCard';
import { AdminHubLaunchStatusBar } from './AdminHubLaunchStatusBar';

const none = { SERVICES: null, TEAM: null, HOURS: null };

afterEach(() => cleanup());

describe('AdminHubLaunchStatusBar', () => {
  it('shows status and the next setup step', () => {
    const card = setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: null, reviewStates: none });
    render(<AdminHubLaunchStatusBar card={card} onOpenMenu={() => undefined} />);
    expect(screen.getByTestId('admin-hub-launch-bar')).toBeTruthy();
    expect(screen.getByText('Your shop · 0 of 7')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Logo' });
    expect(link.getAttribute('href')).toBe('/admin?app=materials&item=logo');
  });

  it('opens the menu when every remaining step is blocked', () => {
    const onOpenMenu = vi.fn();
    const card = setupPhase1Items({
      stage: 'designing',
      assetKinds: ['LOGO', 'SHOP_PHOTO'],
      aboutText: 'Since 2014',
      reviewStates: none,
      shopCounts: { activeServices: 2, activeBarbers: 1, products: 1 },
    });
    /* Hours is fromLinks before review — pickNext skips it, so there is no next step. */
    expect(card.nextId).toBeNull();
    render(<AdminHubLaunchStatusBar card={card} onOpenMenu={onOpenMenu} />);
    fireEvent.click(screen.getByRole('button', { name: SETUP_LAUNCH_BAR_OPEN }));
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it('hides when every step is done', () => {
    const card = setupPhase2Items({
      businessDone: true,
      domainDone: true,
      paymentsDone: true,
      approveDone: true,
    });
    const { container } = render(<AdminHubLaunchStatusBar card={card} onOpenMenu={() => undefined} />);
    expect(container.querySelector('[data-testid="admin-hub-launch-bar"]')).toBeNull();
  });
});
