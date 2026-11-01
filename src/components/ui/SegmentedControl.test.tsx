/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

afterEach(() => cleanup());

describe('SegmentedControl keyboard', () => {
  it('moves the radio selection with arrow keys and Home/End', () => {
    function Harness() {
      const [value, setValue] = useState<'phone' | 'desktop'>('phone');
      return (
        <SegmentedControl
          ariaLabel="Device"
          value={value}
          onChange={setValue}
          options={[
            { value: 'phone', label: 'Phone' },
            { value: 'desktop', label: 'Desktop' },
          ]}
        />
      );
    }
    render(<Harness />);
    const group = screen.getByRole('radiogroup', { name: 'Device' });
    screen.getByRole('radio', { name: 'Phone' }).focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect((screen.getByRole('radio', { name: 'Desktop' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(group, { key: 'Home' });
    expect((screen.getByRole('radio', { name: 'Phone' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(group, { key: 'End' });
    expect((screen.getByRole('radio', { name: 'Desktop' }) as HTMLInputElement).checked).toBe(true);
  });

  it('keeps Website/Booking as links with aria-current on the active page', () => {
    render(
      <SegmentedControl
        ariaLabel="Preview pages"
        value="website"
        options={[
          { value: 'website', label: 'Website', href: '/admin?section=website' },
          { value: 'booking', label: 'Booking', href: '/admin?section=website&view=booking' },
        ]}
      />,
    );
    const website = screen.getByRole('link', { name: 'Website' });
    expect(website.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Booking' }).getAttribute('href')).toContain('view=booking');
  });
});
