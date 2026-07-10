// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBarberSeriesSelection } from './useBarberSeriesSelection';

function makeValidIds(...ids: string[]) {
  return new Set(ids);
}

describe('useBarberSeriesSelection', () => {
  it('does not loop re-renders on mount with a default winner', () => {
    let renderCount = 0;

    const { result } = renderHook(
      (props) => {
        renderCount += 1;
        return useBarberSeriesSelection(props);
      },
      {
        initialProps: {
          winnerBarberId: 'barber-a',
          validBarberIds: makeValidIds('barber-a', 'barber-b'),
          selectionKey: 'week:revenue:2026-01-01',
        },
      },
    );

    expect(renderCount).toBeLessThanOrEqual(3);
    expect(result.current.selectedBarberIds).toEqual(['barber-a']);
    expect(result.current.activeSeriesKeys).toEqual(['overall', 'barber-a']);
  });

  it('stays stable when disabled', () => {
    let renderCount = 0;

    const { result, rerender } = renderHook(
      (props) => {
        renderCount += 1;
        return useBarberSeriesSelection(props);
      },
      {
        initialProps: {
          winnerBarberId: 'barber-a',
          validBarberIds: makeValidIds('barber-a'),
          selectionKey: 'week:revenue:2026-01-01',
          enabled: false,
        },
      },
    );

    rerender({
      winnerBarberId: 'barber-b',
      validBarberIds: makeValidIds('barber-b'),
      selectionKey: 'week:revenue:2026-01-02',
      enabled: false,
    });

    expect(renderCount).toBeLessThanOrEqual(4);
    expect(result.current.selectedBarberIds).toEqual([]);
    expect(result.current.activeSeriesKeys).toEqual(['overall']);
  });

  it('resets to the new winner when selection context changes', () => {
    const { result, rerender } = renderHook(
      (props) => useBarberSeriesSelection(props),
      {
        initialProps: {
          winnerBarberId: 'barber-a',
          validBarberIds: makeValidIds('barber-a', 'barber-b'),
          selectionKey: 'week:revenue:2026-01-01',
        },
      },
    );

    act(() => {
      result.current.addBarber('barber-b');
    });

    expect(result.current.selectedBarberIds.sort()).toEqual(['barber-a', 'barber-b']);

    rerender({
      winnerBarberId: 'barber-b',
      validBarberIds: makeValidIds('barber-a', 'barber-b'),
      selectionKey: 'week:bookings:2026-01-01',
    });

    expect(result.current.selectedBarberIds).toEqual(['barber-b']);
  });
});
