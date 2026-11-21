/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { buildAvailabilityExample } from '@/lib/barbershopOnlineBooking/availabilityExample';

const previewSpy = vi.fn();

vi.mock('@/components/barbershop-online-booking/OnlineBookingTimelinePreview', () => ({
  default: (props: { focus: { minute: number; label: string; caption: string } }) => {
    previewSpy(props);
    return <div data-testid="preview" data-focus={props.focus.label} />;
  },
}));

import OnlineBookingAvailabilitySync from './OnlineBookingAvailabilitySync';

const example = buildAvailabilityExample();
const times = example.offered.map(({ label, start, endLabel }) => ({ label, start, endLabel }));

function mount() {
  render(
    <OnlineBookingAvailabilitySync
      times={times}
      barber={{ name: example.barber.name, thumb: example.barber.thumb }}
      service={example.service}
      dayLabel={example.dayLabel}
      shopName="Cutstate Barbers"
    />,
  );
}

const pressed = () =>
  screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.getAttribute('data-boa-time'));

describe('OnlineBookingAvailabilitySync', () => {
  afterEach(() => {
    cleanup();
    previewSpy.mockClear();
  });

  it('offers the Heritage Grooming example times with 12:00 selected and shown in the owner view', () => {
    mount();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('data-boa-time'))).toEqual(['12:00', '12:15', '14:45', '15:00', '15:15', '15:30']);
    expect(pressed()).toEqual(['12:00']);
    expect(previewSpy.mock.calls.at(-1)?.[0].focus).toEqual({
      minute: 720,
      label: '12:00',
      caption: 'Kit free until 12:45',
    });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
  });

  it('moves the owner view to the chosen time without booking anything', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /15:30/ }));
    expect(pressed()).toEqual(['15:30']);
    expect(previewSpy.mock.calls.at(-1)?.[0].focus).toEqual({
      minute: 930,
      label: '15:30',
      caption: 'Kit free until 16:15',
    });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Owner view moved to 15:30. Kit is free 15:30 to 16:15 for a 45-minute Skin fade. Nothing has been booked.',
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /12:15/ }));
    fireEvent.click(screen.getByRole('button', { name: /12:15/ }));
    expect(pressed()).toEqual(['12:15']);
    expect(previewSpy.mock.calls.at(-1)?.[0].focus.minute).toBe(735);
  });
});
