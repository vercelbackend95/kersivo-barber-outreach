// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HistoryDateRangePicker from './HistoryDateRangePicker';

const TIMEZONE = 'Europe/London';

afterEach(() => {
  cleanup();
});

function ymd(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

function nextCalendarDayYmd(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function renderPicker(options?: {
  dateRange?: { from?: Date; to?: Date } | null;
  label?: string;
  onChangeRange?: ReturnType<typeof vi.fn>;
  onClear?: ReturnType<typeof vi.fn>;
}) {
  const onChangeRange = options?.onChangeRange ?? vi.fn();
  const onClear = options?.onClear ?? vi.fn();

  render(
    <div className="admin-main-content">
      <HistoryDateRangePicker
        dateRange={options?.dateRange ?? null}
        isMobileViewport={false}
        timezone={TIMEZONE}
        onChangeRange={onChangeRange}
        onClear={onClear}
        variant="date-label"
        label={options?.label ?? 'Choose dates'}
      />
    </div>,
  );

  return { onChangeRange, onClear };
}

describe('HistoryDateRangePicker date-label mode', () => {
  it('applies one selected day as an inclusive single-day range', () => {
    const { onChangeRange } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /choose date range/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Single day' }));

    const input = screen.getByLabelText('Date') as HTMLInputElement;
    expect(input.max).toBe(ymd(new Date()));

    fireEvent.change(input, { target: { value: '2020-01-15' } });
    const apply = screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);

    expect(onChangeRange).toHaveBeenCalledTimes(1);
    const range = onChangeRange.mock.calls[0]?.[0] as { from: Date; to: Date };
    expect(ymd(range.from)).toBe('2020-01-15');
    expect(ymd(range.to)).toBe('2020-01-15');
  });

  it('applies an explicit From/To range', () => {
    const { onChangeRange } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /choose date range/i }));
    expect(screen.getByRole('tab', { name: 'Date range' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2020-01-10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2020-01-12' } });

    const apply = screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);

    const range = onChangeRange.mock.calls[0]?.[0] as { from: Date; to: Date };
    expect(ymd(range.from)).toBe('2020-01-10');
    expect(ymd(range.to)).toBe('2020-01-12');
  });

  it('prevents applying a future date even if it is entered manually', () => {
    renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /choose date range/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Single day' }));

    const today = ymd(new Date());
    const future = nextCalendarDayYmd(today);
    const input = screen.getByLabelText('Date') as HTMLInputElement;
    expect(input.max).toBe(today);

    fireEvent.change(input, { target: { value: future } });
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears the active date filter without applying an invalid date', () => {
    const selected = fromZonedTime('2020-01-15T00:00:00.000', TIMEZONE);
    const { onChangeRange, onClear } = renderPicker({
      dateRange: { from: selected, to: selected },
      label: '15 Jan 2020',
    });

    fireEvent.click(screen.getByRole('button', { name: /choose date range/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChangeRange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /filter booking history by date/i })).toBeNull();
  });

  it('uses the shared control-panel close button styling', () => {
    renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /choose date range/i }));
    const close = screen.getByRole('button', { name: 'Close date picker' });
    expect(close.className).toContain('admin-cp-close-btn');
    expect(close.querySelector('svg')?.classList.contains('admin-cp-close-icon')).toBe(true);
  });
});
