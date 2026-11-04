/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SETUP_CARD_TITLE,
  SETUP_COMPLETE_LABEL,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_COMPLETE_VISIBLE_MS,
  SETUP_EXPAND_STORAGE_KEY,
  SETUP_HIDE_STEPS,
  SETUP_SHOW_ALL_STEPS,
  setupPhase1Items,
  setupPhase2Items,
  setupStorageKey,
} from '@/lib/adminHub/setupCard';
import { AdminHubSetupCard } from './AdminHubSetupCard';

const scope = 'jo@shop.test';

function incompleteCard() {
  return setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: null });
}

function completeCard() {
  return setupPhase2Items({
    businessDone: true,
    domainDone: true,
    paymentsDone: true,
    approveDone: true,
  });
}

afterEach(() => cleanup());

beforeEach(() => {
  localStorage.clear();
});

describe('AdminHubSetupCard', () => {
  it('shows the compact title, count and only the next step until expanded', () => {
    render(<AdminHubSetupCard placement="sidebar" card={incompleteCard()} storageScope={scope} />);
    expect(screen.getByRole('heading', { name: SETUP_CARD_TITLE })).toBeTruthy();
    expect(screen.getByText('0 of 5 done')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Logo, Next' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Shop photos/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: SETUP_SHOW_ALL_STEPS }));
    expect(screen.getByRole('link', { name: /Shop photos/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: SETUP_HIDE_STEPS })).toBeTruthy();
    expect(localStorage.getItem(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope))).toBe('1');
  });

  it('shows shop counts on done team, services and products rows', () => {
    localStorage.setItem(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope), '1');
    const card = setupPhase1Items({
      stage: 'review',
      assetKinds: ['LOGO'],
      aboutText: null,
      shopCounts: { activeServices: 2, activeBarbers: 1, products: 4, openingHoursSaved: false },
    });
    render(<AdminHubSetupCard placement="sidebar" card={card} storageScope={scope} />);
    expect(screen.getByRole('link', { name: 'Team, 1 team member' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Services & prices, 2 services' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Products, 4 products' })).toBeTruthy();
  });

  it('tags Products as optional and sends Opening hours to the hours section, not a window', () => {
    localStorage.setItem(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope), '1');
    render(<AdminHubSetupCard placement="sidebar" card={incompleteCard()} storageScope={scope} />);
    const products = screen.getByRole('link', { name: 'Products, Optional' });
    expect(products.textContent).toContain('Optional');
    const hours = screen.getByRole('link', { name: 'Opening hours, To do' });
    expect(hours.getAttribute('href')).toBe('/admin?app=materials&item=hours');
    expect(hours.className).toContain('is-todo');
  });

  it('shows saved opening hours as done with a check mark and Done label', () => {
    localStorage.setItem(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope), '1');
    const card = setupPhase1Items({
      stage: 'review',
      assetKinds: [],
      aboutText: null,
      shopCounts: { activeServices: 0, activeBarbers: 0, products: 0, openingHoursSaved: true },
    });
    render(<AdminHubSetupCard placement="sidebar" card={card} storageScope={scope} />);
    const hours = screen.getByRole('link', { name: 'Opening hours, Done' });
    expect(hours.className).toContain('is-done');
    expect(hours.querySelector('.admin-hub-setup__mark svg')).toBeTruthy();
    expect(screen.getByText('1 of 5 done')).toBeTruthy();
  });

  it('remembers the expand toggle from localStorage', () => {
    localStorage.setItem(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope), '1');
    render(<AdminHubSetupCard placement="sidebar" card={incompleteCard()} storageScope={scope} />);
    expect(screen.getByRole('link', { name: /Shop photos/ })).toBeTruthy();
  });

  it('shows Setup complete while the stored date is fresh and hides after 7 days', async () => {
    const key = setupStorageKey(SETUP_COMPLETE_STORAGE_KEY, scope);
    localStorage.setItem(key, String(Date.now()));
    const first = render(
      <AdminHubSetupCard placement="sidebar" card={completeCard()} storageScope={scope} />,
    );
    await waitFor(() => expect(screen.getByText(SETUP_COMPLETE_LABEL)).toBeTruthy());
    first.unmount();

    localStorage.setItem(key, String(Date.now() - SETUP_COMPLETE_VISIBLE_MS));
    render(<AdminHubSetupCard placement="sidebar" card={completeCard()} storageScope={scope} />);
    await waitFor(() => {
      expect(screen.queryByText(SETUP_COMPLETE_LABEL)).toBeNull();
      expect(screen.queryByRole('heading', { name: SETUP_CARD_TITLE })).toBeNull();
    });
  });
});
