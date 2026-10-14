/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BlacklineWordmark from './BlacklineWordmark';

describe('BlacklineWordmark', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the approved CUTSTATE BARBERS logo with intrinsic dimensions', () => {
    const { container } = render(<BlacklineWordmark />);
    const logo = screen.getByRole('img', { name: 'CUTSTATE BARBERS' }) as HTMLImageElement;
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('src')).toBe('/demo/cutstate-logo.png');
    expect(logo.getAttribute('width')).toBe('2172');
    expect(logo.getAttribute('height')).toBe('724');
    expect(container.querySelector('.bl-lockup--default')).toBe(logo);
    expect(container.textContent).not.toContain('BLACKLINE');
  });

  it('supports compact and display sizes', () => {
    const { rerender, container } = render(<BlacklineWordmark size="compact" />);
    expect(container.querySelector('.bl-lockup--compact')).toBeTruthy();
    rerender(<BlacklineWordmark size="display" />);
    expect(container.querySelector('.bl-lockup--display')).toBeTruthy();
  });
});
