import { describe, expect, it } from 'vitest';
import { readinessOf, summariseShopHealth } from './overall';
import type { ShopHealthCheckResult, ShopHealthSeverity, ShopHealthStatus } from './types';

const r = (id: string, severity: ShopHealthSeverity, status: ShopHealthStatus): ShopHealthCheckResult => ({
  id,
  area: 'booking',
  title: id,
  severity,
  status,
  message: id,
});

describe('summariseShopHealth (LIVE)', () => {
  it('GREEN when every applicable check passed (skips ignored)', () => {
    expect(summariseShopHealth('LIVE', [r('a', 'critical', 'pass'), r('b', 'warning', 'skip')]).overall).toBe('GREEN');
  });

  it('RED on any critical fail', () => {
    const s = summariseShopHealth('LIVE', [r('a', 'critical', 'fail'), r('b', 'warning', 'fail')]);
    expect(s.overall).toBe('RED');
    expect(s.failing.map((x) => x.id)).toEqual(['a']);
    expect(s.warnings.map((x) => x.id)).toEqual(['b']);
  });

  it('AMBER on a warning-level fail or any warn', () => {
    expect(summariseShopHealth('LIVE', [r('a', 'warning', 'fail')]).overall).toBe('AMBER');
    expect(summariseShopHealth('LIVE', [r('a', 'critical', 'warn')]).overall).toBe('AMBER');
  });

  it('info checks never change the light', () => {
    expect(summariseShopHealth('LIVE', [r('a', 'info', 'fail'), r('b', 'info', 'warn')]).overall).toBe('GREEN');
  });

  it('a single inconclusive critical check stays GREEN, never RED', () => {
    expect(summariseShopHealth('LIVE', [r('a', 'critical', 'inconclusive')]).overall).toBe('GREEN');
  });

  it('the same critical check inconclusive on two runs in a row turns AMBER', () => {
    const now = [r('a', 'critical', 'inconclusive')];
    expect(summariseShopHealth('LIVE', now, [r('a', 'critical', 'inconclusive')]).overall).toBe('AMBER');
    expect(summariseShopHealth('LIVE', now, [r('a', 'critical', 'pass')]).overall).toBe('GREEN');
    expect(summariseShopHealth('LIVE', now, [r('other', 'critical', 'inconclusive')]).overall).toBe('GREEN');
    // A warning-level check inconclusive twice does not count.
    expect(summariseShopHealth('LIVE', [r('w', 'warning', 'inconclusive')], [r('w', 'warning', 'inconclusive')]).overall).toBe('GREEN');
  });
});

describe('PRELAUNCH', () => {
  it('is always GREY with readiness x / y', () => {
    const results = [
      r('a', 'critical', 'pass'),
      r('b', 'critical', 'fail'),
      r('c', 'warning', 'warn'),
      r('d', 'critical', 'after_launch'),
      r('e', 'warning', 'skip'),
      r('f', 'info', 'warn'),
    ];
    const s = summariseShopHealth('PRELAUNCH', results);
    expect(s.overall).toBe('GREY');
    expect(s.readiness).toEqual({ ready: 2, total: 3 });
    expect(s.failing.map((x) => x.id)).toEqual(['b']);
  });

  it('readiness counts inconclusive as not ready', () => {
    expect(readinessOf([r('a', 'critical', 'inconclusive'), r('b', 'critical', 'pass')])).toEqual({ ready: 1, total: 2 });
  });
});
