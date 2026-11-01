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

const none = { SERVICES: null, TEAM: null, HOURS: null };
const scope = 'jo@shop.test';

function incompleteCard() {
  return setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: null, reviewStates: none });
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
    expect(screen.getByText('0 of 6 done')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Logo, Next' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Shop photos/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: SETUP_SHOW_ALL_STEPS }));
    expect(screen.getByRole('link', { name: /Shop photos/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: SETUP_HIDE_STEPS })).toBeTruthy();
    expect(localStorage.getItem(setupStorageKey(SETUP_EXPAND_STORAGE_KEY, scope))).toBe('1');
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
