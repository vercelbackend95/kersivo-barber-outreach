/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminHubSwatches } from './AdminHubSwatches';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminHubSwatches', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('binds the stored colour and copies the hex', async () => {
    render(
      <AdminHubSwatches
        swatches={[{ hex: '#1F6F6B', css: '#1F6F6B', role: 'Main', light: false }]}
      />,
    );
    const button = screen.getByRole('button', { name: 'Copy Main #1F6F6B' });
    expect(button.style.getPropertyValue('--admin-hub-swatch')).toBe('#1F6F6B');
    fireEvent.click(button);
    await waitFor(() => expect(screen.getAllByText('Copied').length).toBeGreaterThan(0));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('#1F6F6B');
  });

  it('still marks Copied when the Clipboard API is missing', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', {});
    const exec = vi.fn().mockReturnValue(true);
    vi.stubGlobal('document', document);
    document.execCommand = exec;
    render(
      <AdminHubSwatches
        swatches={[{ hex: '#1F6F6B', css: '#1F6F6B', role: 'Main', light: false }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy Main #1F6F6B' }));
    await waitFor(() => expect(screen.getAllByText('Copied').length).toBeGreaterThan(0));
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('shows the empty copy and a materials link instead of frames', () => {
    const { container } = render(<AdminHubSwatches swatches={[]} />);
    expect(screen.getByText(/No brand colours yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add your logo' }).getAttribute('href')).toBe('/admin?app=materials');
    expect(container.querySelector('.admin-hub-sw--empty')).toBeNull();
    expect(container.querySelectorAll('.admin-hub-sw')).toHaveLength(0);
  });
});
