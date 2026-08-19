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

  it('renders the BLACKLINE BARBERS lockup without a raster image', () => {
    const { container } = render(<BlacklineWordmark />);
    expect(screen.getByRole('img', { name: 'BLACKLINE BARBERS' })).toBeTruthy();
    expect(container.querySelector('.bl-lockup__name')?.textContent).toBe('BLACKLINE');
    expect(container.querySelector('.bl-lockup__barbers')?.textContent).toBe('BARBERS');
    expect(container.querySelectorAll('.bl-lockup__rule')).toHaveLength(2);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.bl-lockup--default')).toBeTruthy();
  });

  it('supports compact and display sizes', () => {
    const { rerender, container } = render(<BlacklineWordmark size="compact" />);
    expect(container.querySelector('.bl-lockup--compact')).toBeTruthy();
    rerender(<BlacklineWordmark size="display" />);
    expect(container.querySelector('.bl-lockup--display')).toBeTruthy();
  });
});
