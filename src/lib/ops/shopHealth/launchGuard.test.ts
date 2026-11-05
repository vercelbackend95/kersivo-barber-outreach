import { describe, expect, it, vi } from 'vitest';
import { decideLaunchGuard, runLaunchGuard } from './launchGuard';

const failing = [{ id: 'booking.services', title: 'Bookable services', message: 'No active services.', fix: 'Add a service.' }];

describe('decideLaunchGuard', () => {
  it('proceeds without asking on GREEN or AMBER', () => {
    expect(decideLaunchGuard(200, { ok: true, run: { overall: 'GREEN' } })).toEqual({ kind: 'proceed', overall: 'GREEN' });
    expect(decideLaunchGuard(200, { ok: true, run: { overall: 'AMBER' } })).toEqual({ kind: 'proceed', overall: 'AMBER' });
  });

  it('asks "Launch anyway?" with the failing checks on RED', () => {
    expect(decideLaunchGuard(200, { ok: true, run: { overall: 'RED', failing } })).toEqual({ kind: 'confirm', reason: 'red', failing });
  });

  it('asks (never blocks) when the run is rate-limited or fails', () => {
    expect(decideLaunchGuard(429, { ok: false })).toMatchObject({ kind: 'confirm', reason: 'error' });
    expect(decideLaunchGuard(500, { ok: false, error: { code: 'RUN_FAILED' } })).toEqual({
      kind: 'confirm',
      reason: 'error',
      text: 'Launch checks could not run (RUN_FAILED).',
    });
    expect(decideLaunchGuard(200, null)).toMatchObject({ kind: 'confirm', reason: 'error' });
  });
});

describe('runLaunchGuard', () => {
  it('POSTs a launch run for the draft shop', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, run: { overall: 'GREEN' } }), { status: 200 }));
    await expect(runLaunchGuard('shop 1', fetchImpl as never)).resolves.toEqual({ kind: 'proceed', overall: 'GREEN' });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/ops/shops/shop%201/health/run',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ launch: true }) }),
    );
  });

  it('turns a network error into a question, not a block', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    await expect(runLaunchGuard('shop_1', fetchImpl as never)).resolves.toMatchObject({ kind: 'confirm', reason: 'error' });
  });
});
