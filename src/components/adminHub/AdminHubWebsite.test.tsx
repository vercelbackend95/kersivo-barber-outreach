/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_STORAGE_KEY } from '@/lib/adminHub/previewStage';
import { HUB_WEBSITE_DESKTOP, HUB_WEBSITE_PHONE } from '@/lib/freePreview/hubCopy';

vi.mock('@/components/booking/BookingFlow', () => ({
  default: () => <div>Booking flow</div>,
}));
vi.mock('@/components/freePreview/PreviewTopBar', () => ({
  default: () => <button type="button">Launch this website</button>,
}));

import { AdminHubWebsite } from './AdminHubWebsite';

const draft = {
  sitePreviewUrl: 'https://preview.example.test/shop',
  timezone: 'Europe/London',
  cancellationWindowHours: 24,
  rescheduleWindowHours: 24,
  services: [{ id: 's1', name: 'Cut', durationMinutes: 30, pricePence: 2000, category: null, description: null }],
  barbers: [{ id: 'b1', name: 'Alex', serviceIds: ['s1'] }],
  hours: [{ dayOfWeek: 1, open: true }],
};

function renderWebsite(view: 'website' | 'booking' = 'website') {
  return render(
    <AdminHubWebsite
      token=""
      shopName="Hub QA Ready"
      townCity="Leeds"
      firstName="Jo"
      checkoutEmail="jo@example.test"
      hasOwnDomain="not_sure"
      existingWebsiteHost=""
      isOperator={false}
      converted={false}
      view={view}
      websiteHref="/admin?section=website"
      bookingHref="/admin?section=website&view=booking"
      draft={draft}
      changeItems={[]}
      includedChangeRounds={1}
      changeRoundsUsed={0}
      canDraft
      canSend
      canCheckout
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('1024') ? false : window.innerWidth >= 1024,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
  class RO {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: RO });
});

afterEach(() => cleanup());

describe('AdminHubWebsite device toggle', () => {
  it('defaults to phone under 1024 and remembers Desktop in localStorage', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    renderWebsite();
    const desktop = screen.getByRole('radio', { name: HUB_WEBSITE_DESKTOP });
    fireEvent.click(desktop);
    expect(screen.getByTestId('admin-hub-website').getAttribute('data-ready')).toBe('true');
    expect(screen.getByTestId('admin-hub-website').getAttribute('data-device')).toBe('desktop');
    expect(localStorage.getItem(DEVICE_STORAGE_KEY)).toBe('desktop');
  });

  it('restores the remembered device', () => {
    localStorage.setItem(DEVICE_STORAGE_KEY, 'desktop');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    renderWebsite();
    expect(screen.getByTestId('admin-hub-website').getAttribute('data-device')).toBe('desktop');
    expect(screen.getByRole('radio', { name: HUB_WEBSITE_PHONE })).toBeTruthy();
  });

  it('opens the suggest composer as a sheet', () => {
    renderWebsite();
    fireEvent.click(screen.getAllByRole('button', { name: /Suggest/ })[0]!);
    expect(screen.getByTestId('admin-hub-suggest')).toBeTruthy();
    expect(screen.getByTestId('hub-change-body')).toBeTruthy();
  });
});
