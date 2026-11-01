/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminAddButton from './AdminAddButton';

afterEach(() => {
  cleanup();
});

describe('AdminAddButton', () => {
  it('renders a visible text label reachable by role and name', () => {
    const onClick = vi.fn();
    render(<AdminAddButton label="Add service" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Add service' });
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Add service');
    expect(button.getAttribute('aria-label')).toBeNull();
    expect(button.getAttribute('title')).toBeNull();
    expect(button.className).toContain('admin-add-btn');
    expect(button.className).toContain('btn--primary');
    expect(button.className).not.toContain('btn--icon');
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses the given labels for team and product actions', () => {
    const { rerender } = render(<AdminAddButton label="Add team member" onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Add team member' })).toBeTruthy();
    rerender(<AdminAddButton label="Add product" onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Add product' })).toBeTruthy();
  });

  it('honours disabled', () => {
    render(<AdminAddButton label="Add service" onClick={() => undefined} disabled />);
    expect((screen.getByRole('button', { name: 'Add service' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
