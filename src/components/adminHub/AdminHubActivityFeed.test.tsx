/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminHubActivityFeed } from './AdminHubActivityFeed';

afterEach(() => cleanup());

describe('AdminHubActivityFeed', () => {
  it('groups rows by day and shows compact relative time', () => {
    render(
      <AdminHubActivityFeed
        groups={[
          {
            label: 'Today',
            items: [
              {
                id: '1',
                label: 'Review',
                kind: 'status',
                at: '2026-10-31T15:00:00.000Z',
                relative: '2h ago',
                absolute: '31 Oct 2026, 16:00',
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('2h ago').getAttribute('title')).toBe('31 Oct 2026, 16:00');
  });

  it('shows the empty copy', () => {
    render(<AdminHubActivityFeed groups={[]} />);
    expect(screen.getByText('Nothing here yet. Updates on your website will appear here.')).toBeTruthy();
  });

  it('prepends an upload row after a successful upload event', async () => {
    render(<AdminHubActivityFeed groups={[]} />);
    window.dispatchEvent(
      new CustomEvent('admin-hub:asset-uploaded', {
        detail: { kind: 'LOGO', asset: { id: 'logo_1' } },
      }),
    );
    await waitFor(() => expect(screen.getByText('You added a logo')).toBeTruthy());
    expect(screen.getByText('just now')).toBeTruthy();
  });
});
