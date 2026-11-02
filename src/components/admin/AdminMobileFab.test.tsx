/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminMobileFab from './AdminMobileFab';

afterEach(() => {
  cleanup();
});

describe('AdminMobileFab', () => {
  it('is a labelled icon button with a decorative Plus', () => {
    const onClick = vi.fn();
    render(<AdminMobileFab label="Add service" onClick={onClick} context="services" />);
    const button = screen.getByRole('button', { name: 'Add service' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('title')).toBe('Add service');
    expect(button.getAttribute('data-admin-fab')).toBe('services');
    expect(button.getAttribute('data-testid')).toBe('admin-mobile-fab');
    expect(button.className).toContain('admin-mobile-fab');
    expect(button.className).toContain('admin-mobile-fab--mobile');
    expect(button.className).not.toContain('admin-mobile-fab--always');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.textContent?.replace(/\s/g, '')).toBe('');
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the Bookings control available on every viewport', () => {
    render(
      <AdminMobileFab
        label="New booking"
        onClick={() => undefined}
        visibility="always"
        className="admin-manual-booking-fab"
        context="bookings"
      />,
    );
    const button = screen.getByRole('button', { name: 'New booking' });
    expect(button.className).toContain('admin-mobile-fab--always');
    expect(button.className).toContain('admin-manual-booking-fab');
  });

  it('honours disabled and menu trigger semantics', () => {
    render(
      <AdminMobileFab
        label="Add to your website or shop"
        onClick={() => undefined}
        disabled
        expanded
        controls="menu-id"
        haspopup="menu"
        context="overview"
      />,
    );
    const button = screen.getByRole('button', { name: 'Add to your website or shop' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('menu-id');
  });
});
