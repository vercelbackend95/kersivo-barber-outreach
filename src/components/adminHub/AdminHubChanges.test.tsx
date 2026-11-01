/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_HUB_CHANGES_DRAFTS, ADMIN_HUB_CHANGES_WITH } from '@/lib/adminHub/copy';
import { HUB_CHANGES_ADD, HUB_CHANGES_SEND } from '@/lib/freePreview/hubCopy';
import { AdminHubChanges } from './AdminHubChanges';

afterEach(() => cleanup());

describe('AdminHubChanges', () => {
  it('shows counters, chips and a sticky send control', () => {
    render(
      <AdminHubChanges
        token=""
        initialItems={[
          {
            id: 'c1',
            page: 'HOME',
            pageLabel: 'Home',
            body: 'Bigger logo',
            attachmentId: null,
            status: 'DRAFT',
            opsNote: null,
            round: null,
            createdAt: '2026-10-31T12:00:00.000Z',
            sentAt: null,
            resolvedAt: null,
          },
        ]}
        includedChangeRounds={1}
        changeRoundsUsed={0}
        canDraft
        canSend
      />,
    );
    expect(screen.getByText(ADMIN_HUB_CHANGES_DRAFTS)).toBeTruthy();
    expect(screen.getByText(ADMIN_HUB_CHANGES_WITH)).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect((screen.getByRole('button', { name: HUB_CHANGES_SEND }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('opens the composer as a sheet', () => {
    render(
      <AdminHubChanges
        token=""
        initialItems={[]}
        includedChangeRounds={1}
        changeRoundsUsed={0}
        canDraft
        canSend
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(HUB_CHANGES_ADD) }));
    expect(screen.getByTestId('admin-hub-suggest')).toBeTruthy();
    expect(screen.getByTestId('hub-change-body')).toBeTruthy();
  });
});
