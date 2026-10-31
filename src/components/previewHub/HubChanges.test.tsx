/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HUB_CHANGES_EMPTY, HUB_CHANGES_SEND, HUB_ROUND_USED } from '@/lib/freePreview/hubCopy';
import { HubChanges } from './HubChanges';

afterEach(() => cleanup());

describe('HubChanges', () => {
  it('shows the empty state and send control', () => {
    render(
      <HubChanges
        token={'A'.repeat(43)}
        initialItems={[]}
        includedChangeRounds={1}
        changeRoundsUsed={0}
        canDraft
        canSend
      />,
    );
    expect(screen.getByText(HUB_CHANGES_EMPTY)).toBeTruthy();
    expect((screen.getByRole('button', { name: HUB_CHANGES_SEND }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('blocks send with the included-round copy', () => {
    render(
      <HubChanges
        token={'A'.repeat(43)}
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
        changeRoundsUsed={1}
        canDraft
        canSend={false}
      />,
    );
    expect(screen.getByText(HUB_ROUND_USED)).toBeTruthy();
    expect((screen.getByRole('button', { name: HUB_CHANGES_SEND }) as HTMLButtonElement).disabled).toBe(true);
  });
});
