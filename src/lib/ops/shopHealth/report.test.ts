import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { displayMode, issueTitles, parseShopHealthFilter, pickDisplayRun, sortShopHealthRows, type StoredRun } from './report';
import type { ShopHealthCheckResult } from './types';

const result = (id: string, status: ShopHealthCheckResult['status'], severity: ShopHealthCheckResult['severity'] = 'critical'): ShopHealthCheckResult => ({
  id,
  area: 'booking',
  title: `Title ${id}`,
  severity,
  status,
  message: '',
});

const run = (over: Partial<StoredRun>): StoredRun => ({
  id: 'r',
  trigger: 'CRON',
  mode: 'LIVE',
  overall: 'GREEN',
  startedAt: new Date(0),
  durationMs: 1,
  results: [],
  ...over,
});

describe('sortShopHealthRows', () => {
  it('orders red, amber, grey, green, never checked; then oldest check first', () => {
    const rows = [
      { name: 'g', overall: 'GREEN' as const, checkedAt: new Date(5) },
      { name: 'n', overall: null, checkedAt: null },
      { name: 'a', overall: 'AMBER' as const, checkedAt: new Date(5) },
      { name: 'r2', overall: 'RED' as const, checkedAt: new Date(9) },
      { name: 'grey', overall: 'GREY' as const, checkedAt: new Date(5) },
      { name: 'r1', overall: 'RED' as const, checkedAt: new Date(1) },
    ];
    expect(sortShopHealthRows(rows).map((r) => r.name)).toEqual(['r1', 'r2', 'a', 'grey', 'g', 'n']);
  });
});

describe('display run', () => {
  it('a GREY draft keeps its PRELAUNCH report even after a newer launch-guard LIVE run', () => {
    const runs = [run({ id: 'launch', mode: 'LIVE', trigger: 'LAUNCH', overall: 'RED' }), run({ id: 'pre', mode: 'PRELAUNCH', overall: 'GREY' })];
    expect(displayMode('GREY', runs)).toBe('PRELAUNCH');
    expect(pickDisplayRun('GREY', runs)?.id).toBe('pre');
  });

  it('falls back to the newest run when nothing is stored on the shop', () => {
    const runs = [run({ id: 'x', mode: 'PRELAUNCH' })];
    expect(displayMode(null, runs)).toBe('PRELAUNCH');
    expect(pickDisplayRun(null, [])).toBeNull();
  });
});

describe('issueTitles', () => {
  it('lists critical fails, then warnings and inconclusive critical checks; never info or passes', () => {
    const titles = issueTitles(
      run({
        results: [
          result('a', 'pass'),
          result('b', 'fail'),
          result('c', 'warn', 'warning'),
          result('d', 'inconclusive'),
          result('e', 'fail', 'info'),
        ],
      }),
    );
    expect(titles).toEqual({ failing: ['Title b'], warnings: ['Title c', 'Title d'] });
  });
});

describe('parseShopHealthFilter', () => {
  it('accepts the four lights in any case and nothing else', () => {
    expect(parseShopHealthFilter('red')).toBe('RED');
    expect(parseShopHealthFilter('Grey')).toBe('GREY');
    expect(parseShopHealthFilter('purple')).toBeNull();
    expect(parseShopHealthFilter(null)).toBeNull();
  });
});
