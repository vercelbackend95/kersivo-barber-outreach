/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultOpeningWeek, OPENING_HOURS_CLOSE_AFTER_OPEN, type OpeningDay } from '@/lib/shopData/openingHours';
import { OpeningHoursEditor, OPENING_HOURS_COPY_MONDAY } from './OpeningHoursEditor';

afterEach(cleanup);

function Harness(props: { initial?: OpeningDay[]; onWeek?: (week: OpeningDay[]) => void }) {
  const [week, setWeek] = useState<OpeningDay[]>(props.initial ?? defaultOpeningWeek());
  return (
    <OpeningHoursEditor
      value={week}
      label="Opening hours"
      onChange={(next) => {
        setWeek(next);
        props.onWeek?.(next);
      }}
    />
  );
}

describe('OpeningHoursEditor', () => {
  it('lists seven days Monday first, with a named switch and labelled 24-hour selects', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Opening hours' })).toBeTruthy();
    const days = Array.from(document.querySelectorAll('.ks-hours__day')).map((li) => li.getAttribute('data-day'));
    expect(days).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(screen.getByRole('switch', { name: 'Open on Monday' })).toBeTruthy();
    const opens = screen.getByLabelText('Opens on Monday') as HTMLSelectElement;
    expect(opens.value).toBe('09:00');
    expect(opens.options).toHaveLength(96);
    expect(opens.options[52]!.textContent).toBe('13:00');
  });

  it('shows a closed day as Closed with its times disabled', () => {
    render(<Harness />);
    const sunday = document.querySelector('[data-day="7"]')!;
    expect(sunday.textContent).toContain('Closed');
    expect((screen.getByLabelText('Opens on Sunday') as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Open on Sunday' }));
    expect((screen.getByLabelText('Opens on Sunday') as HTMLSelectElement).disabled).toBe(false);
    expect(sunday.textContent).toContain('Open');
  });

  it('explains an invalid day inline and links the message to its fields', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Closes on Tuesday'), { target: { value: '08:00' } });
    const closes = screen.getByLabelText('Closes on Tuesday');
    expect(closes.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(closes.getAttribute('aria-describedby')!);
    expect(message?.textContent).toBe(OPENING_HOURS_CLOSE_AFTER_OPEN);
    expect(message?.getAttribute('aria-live')).toBe('polite');
  });

  it('copies Monday to all weekdays', () => {
    let last: OpeningDay[] = [];
    render(<Harness onWeek={(w) => (last = w)} />);
    fireEvent.change(screen.getByLabelText('Opens on Monday'), { target: { value: '08:15' } });
    fireEvent.click(screen.getByRole('button', { name: OPENING_HOURS_COPY_MONDAY }));
    expect(last.slice(0, 5).map((d) => d.opens)).toEqual(['08:15', '08:15', '08:15', '08:15', '08:15']);
    expect(last[5]!.opens).toBe('09:00');
  });

  it('lays out seven columns from 1024 px, rows below, with 44 px targets and reduced motion', () => {
    const css = readFileSync('src/styles/components/opening-hours-editor.css', 'utf8');
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.ks-hours__grid \{\s*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/,
    );
    expect(css).toMatch(/\.ks-hours__switch \{[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.ks-hours \.ks-hours__select \{[^}]*min-height: 44px;/);
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
