/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultOpeningWeek, OPENING_HOURS_NONE_OPEN, type OpeningDay } from '@/lib/shopData/openingHours';
import { OpeningHoursEditor } from './OpeningHoursEditor';

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let last: OpeningDay[] = [];

function Harness(props: { initial?: OpeningDay[]; disabled?: boolean; suggested?: boolean; onConfirm?: () => void }) {
  const [week, setWeek] = useState<OpeningDay[]>(props.initial ?? defaultOpeningWeek());
  return (
    <OpeningHoursEditor
      value={week}
      label="Opening hours"
      disabled={props.disabled}
      suggested={props.suggested}
      onConfirmSuggested={props.onConfirm}
      onChange={(next) => {
        last = next;
        setWeek(next);
      }}
    />
  );
}

const status = () => screen.getByTestId('opening-hours-status').textContent;
const monday = () => last.find((d) => d.dayOfWeek === 1)!;

describe('OpeningHoursEditor (Week at a glance)', () => {
  it('lists seven day rows Monday first with named switches', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Opening hours' })).toBeTruthy();
    const days = Array.from(document.querySelectorAll('.ks-hours__day')).map((li) => li.getAttribute('data-day'));
    expect(days).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(document.querySelector('.ks-hours__list')?.tagName).toBe('OL');
    const sw = screen.getByRole('switch', { name: 'Open on Monday' });
    expect(sw.tagName).toBe('BUTTON');
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('shows a closed day as Closed with no time button, and the switch opens it', () => {
    render(<Harness />);
    const sunday = document.querySelector('[data-day="7"]') as HTMLElement;
    expect(within(sunday).getByText('Closed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Change Sunday hours/ })).toBeNull();
    const sw = screen.getByRole('switch', { name: 'Open on Sunday' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Change Sunday hours, now 09:00 to 18:00' })).toBeTruthy();
  });

  it('opens the picker and choosing 08 then :15 updates Monday', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Change Monday hours, now 09:00 to 18:00' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const picker = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(picker).toBeTruthy();
    const openHours = within(picker).getByRole('group', { name: 'Opening hour on Monday' });
    expect(within(openHours).getByRole('button', { name: '09' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(openHours).getByRole('button', { name: '08' }));
    fireEvent.click(within(within(picker).getByRole('group', { name: 'Opening minutes on Monday' })).getByRole('button', { name: ':15' }));
    expect(monday().opens).toBe('08:15');
    expect(monday().closes).toBe('18:00');
  });

  it('only one row is expanded at a time; the copy panel closes the picker', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Change Monday hours/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Change Tuesday hours/ }));
    expect(screen.getAllByTestId('opening-hours-picker')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Tuesday hours' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Tuesday hours to other days' }));
    expect(screen.queryByTestId('opening-hours-picker')).toBeNull();
    expect(screen.getByTestId('opening-hours-copy')).toBeTruthy();
  });

  it('disables closing hours and minutes that are not after opening', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Change Monday hours/ }));
    const closeHours = screen.getByRole('group', { name: 'Closing hour on Monday' });
    expect((within(closeHours).getByRole('button', { name: '08' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(closeHours).getByRole('button', { name: '09' }) as HTMLButtonElement).disabled).toBe(false);
    // Closing 09:xx: only :15 and later are after 09:00.
    fireEvent.click(within(closeHours).getByRole('button', { name: '09' }));
    expect(monday().closes).toBe('09:15');
    const closeMinutes = screen.getByRole('group', { name: 'Closing minutes on Monday' });
    expect((within(closeMinutes).getByRole('button', { name: ':00' }) as HTMLButtonElement).disabled).toBe(true);
    // Latest opening is 23:30.
    fireEvent.click(within(screen.getByRole('group', { name: 'Opening hour on Monday' })).getByRole('button', { name: '23' }));
    const openMinutes = screen.getByRole('group', { name: 'Opening minutes on Monday' });
    expect((within(openMinutes).getByRole('button', { name: ':45' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('moves closing forward when opening reaches it, and says so', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Change Monday hours/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Opening hour on Monday' })).getByRole('button', { name: '18' }));
    // 09:00–18:00 was nine hours: closing moves to the cap, 23:45.
    expect(monday()).toMatchObject({ opens: '18:00', closes: '23:45' });
    expect(status()).toBe('Closing time moved to 23:45 so it stays after opening.');
  });

  it('Esc and Done close the picker and return focus to the time button', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: /^Change Monday hours/ });
    fireEvent.click(button);
    const inside = within(screen.getByRole('group', { name: 'Opening hour on Monday' })).getByRole('button', { name: '10' });
    inside.focus();
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      inside.dispatchEvent(esc);
    });
    expect(esc.defaultPrevented).toBe(true);
    expect(screen.queryByTestId('opening-hours-picker')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('opening-hours-picker')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('copies a day to the selected days and announces it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Change Monday hours/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Opening hour on Monday' })).getByRole('button', { name: '08' }));
    const copyButton = screen.getByRole('button', { name: 'Copy Monday hours to other days' });
    fireEvent.click(copyButton);
    const panel = screen.getByTestId('opening-hours-copy');
    expect(panel.textContent).toContain('Copy Monday (08:00 – 18:00) to');
    const apply = within(panel).getByRole('button', { name: 'Copy' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Tuesday' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Wednesday' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Sunday' }));
    expect(within(panel).getByRole('button', { name: 'Sunday' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy to 3 days' }));
    expect(last.map((d) => `${d.isOpen ? d.opens : 'x'}`)).toEqual(['08:00', '08:00', '08:00', '09:00', '09:00', '09:00', '08:00']);
    expect(screen.queryByTestId('opening-hours-copy')).toBeNull();
    expect(status()).toBe('Copied Monday to 3 days.');
    expect(document.activeElement).toBe(copyButton);
  });

  it('copy quick links select weekdays, every day and clear', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Saturday hours to other days' }));
    const panel = screen.getByTestId('opening-hours-copy');
    fireEvent.click(within(panel).getByRole('button', { name: 'Weekdays' }));
    expect(within(panel).getByRole('button', { name: 'Copy to 5 days' })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Every day' }));
    expect(within(panel).getByRole('button', { name: 'Copy to 6 days' })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Clear' }));
    expect((within(panel).getByRole('button', { name: 'Copy' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('opening-hours-copy')).toBeNull();
  });

  it('applies a pattern, shows it pressed and announces it', () => {
    render(<Harness />);
    const patterns = screen.getByRole('group', { name: 'Start from' });
    expect(within(patterns).getByRole('button', { name: 'Mon–Sat · 09:00–18:00' }).getAttribute('aria-pressed')).toBe('true');
    const tueSat = within(patterns).getByRole('button', { name: 'Tue–Sat · 09:00–18:00' });
    expect(tueSat.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(tueSat);
    expect(tueSat.getAttribute('aria-pressed')).toBe('true');
    expect(last.map((d) => d.isOpen)).toEqual([false, true, true, true, true, true, false]);
    expect(status()).toBe('Pattern applied. Fine-tune any day below.');
  });

  it('summarises the week in groups with the total hours, live', () => {
    render(<Harness />);
    const summary = screen.getByTestId('opening-hours-summary');
    expect(summary.textContent).toContain('Your week');
    const groups = Array.from(summary.querySelectorAll('li')).map((li) => li.textContent);
    expect(groups).toEqual(['Mon – Sat 09:00 – 18:00', 'Sun Closed']);
    expect(screen.getByTestId('opening-hours-total').textContent).toBe('54 hours open a week');
    fireEvent.click(within(screen.getByRole('group', { name: 'Start from' })).getByRole('button', { name: 'Mon–Fri 09:00–18:00 · Sat 09:00–17:00' }));
    expect(Array.from(summary.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'Mon – Fri 09:00 – 18:00',
      'Sat 09:00 – 17:00',
      'Sun Closed',
    ]);
    expect(screen.getByTestId('opening-hours-total').textContent).toBe('53 hours open a week');
  });

  it('warns when every day is closed', () => {
    render(<Harness initial={defaultOpeningWeek().map((d) => ({ ...d, isOpen: d.dayOfWeek === 1 }))} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Open on Monday' }));
    expect(status()).toBe(OPENING_HOURS_NONE_OPEN);
    expect(screen.getByTestId('opening-hours-status').className).toContain('is-error');
  });

  it('shows the suggested banner with a busy-aware confirm button', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <OpeningHoursEditor value={defaultOpeningWeek()} onChange={() => undefined} suggested onConfirmSuggested={onConfirm} />,
    );
    const banner = screen.getByTestId('opening-hours-suggested');
    expect(banner.textContent).toContain('Suggested hours, not saved yet');
    expect(banner.textContent).toContain("We've filled in common barbershop hours. Change any day, or confirm them as they are.");
    fireEvent.click(within(banner).getByRole('button', { name: 'Use these hours' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    rerender(
      <OpeningHoursEditor value={defaultOpeningWeek()} onChange={() => undefined} suggested confirming onConfirmSuggested={onConfirm} />,
    );
    const busy = within(screen.getByTestId('opening-hours-suggested')).getByRole('button', { name: 'Saving…' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
  });

  it('read-only renders summary, names, plain times and timelines without controls', () => {
    render(<Harness disabled suggested />);
    expect(screen.getByTestId('opening-hours-summary')).toBeTruthy();
    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.getAllByText('09:00 – 18:00').length).toBeGreaterThanOrEqual(6);
    expect(document.querySelectorAll('.ks-hours__timeline')).toHaveLength(7);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('opening-hours-suggested')).toBeNull();
  });

  it('positions the open bar on the 06:00–23:00 timeline and keeps a sliver outside it', () => {
    const week = defaultOpeningWeek().map((d) =>
      d.dayOfWeek === 2 ? { ...d, opens: '02:00', closes: '05:00' } : d,
    );
    render(<Harness initial={week} />);
    const bar = (day: number) => document.querySelector(`[data-day="${day}"] .ks-hours__bar`) as HTMLElement;
    expect(bar(1).style.left).toBe(`${(180 / 1020) * 100}%`);
    expect(bar(1).style.width).toBe(`${(540 / 1020) * 100}%`);
    expect(bar(2).style.left).toBe('0%');
    expect(document.querySelector('[data-day="7"] .ks-hours__timeline')?.className).toContain('is-closed');
  });

  it('opens all 24 hours when a time is before 06:00, and toggles back', () => {
    const week = defaultOpeningWeek().map((d) => (d.dayOfWeek === 1 ? { ...d, opens: '05:10' } : d));
    render(<Harness initial={week} />);
    fireEvent.click(screen.getByRole('button', { name: /^Change Monday hours/ }));
    const hours = screen.getByRole('group', { name: 'Opening hour on Monday' });
    expect(within(hours).getAllByRole('button')).toHaveLength(24);
    // Off-grid value shows as is with no minute pressed; picking snaps to the grid.
    expect(screen.getByTestId('opening-hours-picker').textContent).toContain('05:10');
    const minutes = screen.getByRole('group', { name: 'Opening minutes on Monday' });
    expect(within(minutes).getAllByRole('button').some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(false);
    fireEvent.click(within(hours).getByRole('button', { name: '07' }));
    expect(monday().opens).toBe('07:00');
    fireEvent.click(screen.getByRole('button', { name: 'Daytime hours only' }));
    expect(within(screen.getByRole('group', { name: 'Opening hour on Monday' })).getAllByRole('button')).toHaveLength(18);
  });

  it('CSS: container query layout, 44 px targets, focus ring and reduced motion', () => {
    const css = readFileSync('src/styles/components/opening-hours-editor.css', 'utf8');
    expect(css).toMatch(/\.ks-hours \{[^}]*container-type: inline-size;/);
    expect(css).toMatch(/@container \(min-width: 720px\)/);
    expect(css).toMatch(/grid-template-columns: 104px 52px 168px minmax\(0, 1fr\) 44px;/);
    expect(css).not.toMatch(/@media \(min-width: 1024px\)/);
    expect(css).toMatch(/\.ks-hours__switch \{[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.ks-hours__time-btn \{[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.ks-hours__cell \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.ks-hours__copy-btn \{[^}]*width: 44px;[^}]*height: 44px;/);
    expect(css).toMatch(/\.ks-hours__chip \{[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.ks-hours :focus-visible \{\s*outline: 2px solid var\(--fg\);\s*outline-offset: 2px;/);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.ks-hours__bar/);
    expect(css).toContain('#e9e4da');
  });
});
