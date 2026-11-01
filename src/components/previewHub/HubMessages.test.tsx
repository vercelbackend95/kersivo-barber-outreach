/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_HUB_MESSAGES_EMPTY } from '@/lib/adminHub/copy';
import { HUB_KERSIVO, HUB_MESSAGES_EMPTY, HUB_SEEN, HUB_YOU } from '@/lib/freePreview/hubCopy';
import { HubMessageBody, HubMessages } from './HubMessages';

afterEach(() => cleanup());

describe('HubMessageBody XSS', () => {
  it('renders HTML in a message as text, not markup', () => {
    const { container } = render(<HubMessageBody body={'Hello <img src=x onerror="alert(1)">'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/Hello <img src=x onerror="alert\(1\)">/)).toBeTruthy();
  });

  it('linkifies https URLs with safe rel attributes', () => {
    render(<HubMessageBody body="Open https://kersivo.co.uk/preview" />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://kersivo.co.uk/preview');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow ugc');
  });
});

describe('HubMessages', () => {
  it('shows the empty state and composer', () => {
    render(
      <HubMessages
        token={'A'.repeat(43)}
        viewer="owner"
        shopName="Sharp Cuts"
        initialMessages={[]}
      />,
    );
    expect(screen.getByText(HUB_MESSAGES_EMPTY)).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
  });

  it('hides the page title and uses section empty copy on /admin/messages', () => {
    render(
      <HubMessages
        token={'A'.repeat(43)}
        viewer="owner"
        shopName="Sharp Cuts"
        initialMessages={[]}
        chrome="section"
        emptyLabel={ADMIN_HUB_MESSAGES_EMPTY}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Sharp Cuts' })).toBeNull();
    expect(screen.getByText(ADMIN_HUB_MESSAGES_EMPTY)).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
  });

  it('hides the page title when opened as an admin-hub app', () => {
    render(
      <HubMessages
        token={'A'.repeat(43)}
        viewer="owner"
        shopName="Sharp Cuts"
        initialMessages={[]}
        chrome="app"
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Sharp Cuts' })).toBeNull();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
  });

  it('shows You / KERSIVO and Seen on an owner message ops has read', () => {
    render(
      <HubMessages
        token={'A'.repeat(43)}
        viewer="owner"
        shopName="Sharp Cuts"
        initialMessages={[
          {
            id: '1',
            author: 'OWNER',
            body: 'Please reopen this preview.',
            createdAt: '2026-10-31T12:00:00.000Z',
            readByOwnerAt: '2026-10-31T12:00:00.000Z',
            readByOpsAt: '2026-10-31T12:05:00.000Z',
            attachments: [],
          },
          {
            id: '2',
            author: 'KERSIVO',
            body: 'We can reopen it.',
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
    expect(screen.getByText(HUB_SEEN)).toBeTruthy();
    expect(screen.getByText('Please reopen this preview.')).toBeTruthy();
  });
});
