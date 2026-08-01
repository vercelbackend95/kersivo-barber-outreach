/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AdminMobileNextAppointmentsStrip from './AdminMobileNextAppointmentsStrip';

describe('AdminMobileNextAppointmentsStrip loading state', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows skeleton and never the empty copy while loading', () => {
    const { container } = render(
      <AdminMobileNextAppointmentsStrip
        appointments={[]}
        isExpanded={false}
        onToggleExpanded={() => undefined}
        formatStartTime={() => '10:00'}
        connectionStateLabel="CONNECTING…"
        isLoading
      />,
    );

    expect(screen.queryByText('No upcoming bookings')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('shows empty copy only after load with zero appointments', () => {
    render(
      <AdminMobileNextAppointmentsStrip
        appointments={[]}
        isExpanded={false}
        onToggleExpanded={() => undefined}
        formatStartTime={() => '10:00'}
        connectionStateLabel="LIVE"
        isLoading={false}
      />,
    );

    expect(screen.getByText('No upcoming bookings')).toBeTruthy();
  });
});
