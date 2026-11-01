/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BarberProfile from './BarberProfile';
import { teamAccountAccessLabel } from '@/lib/admin/teamCards';

vi.mock('./TeamInviteWizard', () => ({
  default: () => React.createElement('div', { 'data-testid': 'invite-wizard' }),
}));
vi.mock('./TeamDashboardAccountSheet', () => ({ default: () => null }));
vi.mock('./OnlineBookingsSheet', () => ({ default: () => null }));
vi.mock('./TeamChangeRoleSheet', () => ({ default: () => null }));
vi.mock('./TeamDeleteBarberSheet', () => ({ default: () => null }));
vi.mock('./barber-wizard/BarberWizard', () => ({ default: () => null }));
vi.mock('./AdminWizardSheetLayer', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const barber = {
  id: 'barber-1',
  name: 'Alex Reed',
  isActive: true,
  avatarUrl: null,
  sortOrder: 0,
  serviceIds: [],
};

function renderProfile(isHubAccess: boolean) {
  return render(
    <BarberProfile
      barber={barber}
      barberAvatarPreviewUrl={null}
      barberSaving={false}
      weekDays={['Mon']}
      isActive
      totalBookingsServed={0}
      services={[]}
      enabledServiceIds={new Set()}
      servicesSaving={false}
      workingHours={[]}
      workingHoursLoading={false}
      workingHoursSaving={false}
      blocks={[]}
      blockSuccessMessage=""
      blockErrorMessage=""
      getInitials={() => 'AR'}
      onClose={() => undefined}
      onBarberUpdated={() => undefined}
      onBarberAvatarChange={() => undefined}
      onSaveAvatar={() => undefined}
      onToggleService={() => undefined}
      barberSaveMessage=""
      barberSaveError=""
      onSetWorkingHours={() => undefined}
      onSaveWorkingHours={async () => true}
      onCreateBlock={() => undefined}
      onDeleteBlock={() => undefined}
      onDeleteBarber={() => undefined}
      role="BARBER"
      accountAccess="no_dashboard"
      canSendDashboardInvite
      dashboardAccountAction="send"
      actorRole="OWNER"
      isHubAccess={isHubAccess}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('BarberProfile hub invite actions', () => {
  it('hides invite actions when isHubAccess and keeps the no-dashboard badge copy', () => {
    expect(teamAccountAccessLabel('no_dashboard')).toBe('No dashboard account');
    renderProfile(true);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menuitem', { name: /invite/i })).toBeNull();
    expect(screen.queryByText('Send invite to dashboard')).toBeNull();
    expect(screen.queryByText('Resend invite')).toBeNull();
    expect(screen.queryByTestId('invite-wizard')).toBeNull();
  });

  it('still offers the invite action when not hub access', () => {
    renderProfile(false);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Send invite to dashboard' })).toBeTruthy();
  });
});
