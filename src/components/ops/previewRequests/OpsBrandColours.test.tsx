/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpsBrandColours } from './OpsBrandColours';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OpsBrandColours', () => {
  it('shows hex, role, source, tone and copies a hex', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(
      <OpsBrandColours
        primary="#1F6F6B"
        secondary="#C9A24A"
        tone="DARK"
        source="LOGO"
        sentAt="2026-10-31T12:00:00.000Z"
        palette={[
          { hex: '#1F6F6B', share: 0.4 },
          { hex: '#C9A24A', share: 0.3 },
          { hex: '#141414', share: 0.2 },
        ]}
      />,
    );
    expect(screen.getByText('#1F6F6B').closest('span')?.textContent).toContain('Main');
    expect(screen.getByText('#C9A24A').closest('span')?.textContent).toContain('Accent');
    expect(screen.getByText(/From your logo/)).toBeTruthy();
    expect(screen.getByText(/Dark/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('#1F6F6B'));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('labels KERSIVO’s choice and an unsent draft', () => {
    render(
      <OpsBrandColours
        primary={null}
        secondary={null}
        tone="LIGHT"
        source="KERSIVO_CHOOSES"
        sentAt={null}
        palette={null}
      />,
    );
    expect(screen.getByText(/KERSIVO's choice/)).toBeTruthy();
    expect(screen.getByText(/Not sent yet/)).toBeTruthy();
    expect(screen.getByText(/Light/)).toBeTruthy();
  });
});
