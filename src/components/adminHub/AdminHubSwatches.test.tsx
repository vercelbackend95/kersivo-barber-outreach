/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_HUB_COLOURS_NONE } from '@/lib/adminHub/copy';
import { AdminHubSwatches } from './AdminHubSwatches';

afterEach(() => {
  cleanup();
});

describe('AdminHubSwatches', () => {
  it('renders stored colours as non-interactive chips', () => {
    const { container } = render(
      <AdminHubSwatches
        swatches={[{ hex: '#1F6F6B', css: '#1F6F6B', role: 'Main', light: false }]}
      />,
    );
    const chip = container.querySelector('.admin-hub-sw') as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.tagName).toBe('DIV');
    expect(chip.style.getPropertyValue('--admin-hub-swatch')).toBe('#1F6F6B');
    expect(screen.getByText('Main')).toBeTruthy();
    expect(screen.getByText('#1F6F6B')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows the empty copy without a nested materials link', () => {
    const { container } = render(<AdminHubSwatches swatches={[]} />);
    expect(screen.getByText(ADMIN_HUB_COLOURS_NONE)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('.admin-hub-sw--empty')).toBeNull();
    expect(container.querySelectorAll('.admin-hub-sw')).toHaveLength(0);
  });
});
