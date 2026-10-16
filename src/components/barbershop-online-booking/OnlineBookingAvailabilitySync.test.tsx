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

  it('offers the CUTSTATE example times with 12:00 selected and shown in the owner view', () => {
    mount();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('data-boa-time'))).toEqual(['12:00', '12:15', '18:00', '18:15']);
    expect(pressed()).toEqual(['12:00']);
    expect(previewSpy.mock.calls.at(-1)?.[0].focus).toEqual({
      minute: 720,
      label: '12:00',
      caption: 'Marcus free until 12:45',
    });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
  });

  it('moves the owner view to the chosen time without booking anything', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /18:15/ }));
    expect(pressed()).toEqual(['18:15']);
    expect(previewSpy.mock.calls.at(-1)?.[0].focus).toEqual({
      minute: 1095,
      label: '18:15',
      caption: 'Marcus free until 19:00',
    });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Owner view moved to 18:15. Marcus is free 18:15 to 19:00 for a 45-minute Skin Fade. Nothing has been booked.',
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /12:15/ }));
    fireEvent.click(screen.getByRole('button', { name: /12:15/ }));
    expect(pressed()).toEqual(['12:15']);
    expect(previewSpy.mock.calls.at(-1)?.[0].focus.minute).toBe(735);
  });
});
