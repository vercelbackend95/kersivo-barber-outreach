/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_HUB_MESSAGES_EMPTY, ADMIN_HUB_MESSAGES_SUB } from '@/lib/adminHub/copy';
import { HUB_KERSIVO, HUB_YOU } from '@/lib/freePreview/hubCopy';
import { AdminHubMessages } from './AdminHubMessages';

afterEach(() => cleanup());

describe('AdminHubMessages', () => {
  it('renders the Messages section, empty state and composer', () => {
    render(
      <AdminHubMessages token="" viewer="owner" shopName="Sharp Cuts" initialMessages={[]} />,
    );
    expect(screen.getByTestId('admin-hub-messages')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy();
    expect(screen.getByText(ADMIN_HUB_MESSAGES_SUB)).toBeTruthy();
    expect(screen.getByText(ADMIN_HUB_MESSAGES_EMPTY)).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
    expect(screen.getByTestId('hub-send-message')).toBeTruthy();
  });

  it('labels senders as You and KERSIVO', () => {
    render(
      <AdminHubMessages
        token=""
        viewer="owner"
        shopName="Sharp Cuts"
        initialMessages={[
          {
            id: '1',
            author: 'OWNER',
            body: 'Can you tweak the homepage photo?',
            createdAt: '2026-10-31T12:00:00.000Z',
            readByOwnerAt: '2026-10-31T12:00:00.000Z',
            readByOpsAt: null,
            attachments: [],
          },
          {
            id: '2',
            author: 'KERSIVO',
            body: 'Yes — we will update it.',
            createdAt: '2026-10-31T12:06:00.000Z',
            readByOwnerAt: null,
            readByOpsAt: '2026-10-31T12:06:00.000Z',
            attachments: [],
          },
        ]}
      />,
    );
    expect(screen.getByText(HUB_YOU)).toBeTruthy();
    expect(screen.getByText(HUB_KERSIVO)).toBeTruthy();
    expect(screen.getByText('Can you tweak the homepage photo?')).toBeTruthy();
    expect(screen.getByText('Yes — we will update it.')).toBeTruthy();
  });
});
