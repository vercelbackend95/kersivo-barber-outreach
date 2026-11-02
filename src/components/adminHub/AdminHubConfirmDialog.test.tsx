/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminHubConfirmDialog } from './AdminHubConfirmDialog';

afterEach(() => {
  cleanup();
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
});

describe('AdminHubConfirmDialog', () => {
  it('closes on Escape and restores focus to the trigger', () => {
    const onClose = vi.fn();
    render(
      <button type="button" data-testid="opener">
        Open
      </button>,
    );
    const opener = screen.getByTestId('opener');
    opener.focus();
    const { unmount } = render(
      <AdminHubConfirmDialog
        title="Send your logo and colours to KERSIVO?"
        body="Once sent, your logo and brand colours are locked."
        primaryLabel="Yes, send to KERSIVO"
        secondaryLabel="Go back and review"
        onConfirm={() => undefined}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.activeElement).toBe(opener);
  });

  it('portals the confirm root to document.body', () => {
    render(
      <AdminHubConfirmDialog
        title="Send your logo and colours to KERSIVO?"
        body="Once sent, your logo and brand colours are locked."
        primaryLabel="Yes, send to KERSIVO"
        secondaryLabel="Go back and review"
        onConfirm={() => undefined}
        onClose={() => undefined}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('.admin-hub-confirm-root')?.parentElement).toBe(document.body);
  });

  it('disables both actions while busy and ignores Escape', () => {
    const onClose = vi.fn();
    render(
      <AdminHubConfirmDialog
        title="Send your logo and colours to KERSIVO?"
        body="Once sent, your logo and brand colours are locked."
        primaryLabel="Yes, send to KERSIVO"
        secondaryLabel="Go back and review"
        busy
        busyLabel="Sending…"
        onConfirm={() => undefined}
        onClose={onClose}
      />,
    );
    expect((screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Go back and review' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
