/**
 * "Mark live" launch guard (client side). Before marking a preview request live, Ops runs a LAUNCH health
 * run in LIVE mode for the draft shop. RED → the operator sees the failing checks and can still launch;
 * a run that cannot finish also asks. It never hard-blocks a launch.
 */
import { shopHealthRunApi } from './display';

export type LaunchGuardIssue = { id: string; title: string; message: string; fix?: string };

export type LaunchGuardDecision =
  | { kind: 'proceed'; overall: string }
  | { kind: 'confirm'; reason: 'red'; failing: LaunchGuardIssue[] }
  | { kind: 'confirm'; reason: 'error'; text: string };

type RunResponse = {
  ok?: boolean;
  run?: { overall?: string; failing?: LaunchGuardIssue[] };
  error?: { code?: string; retryAfterSeconds?: number };
};

export function decideLaunchGuard(status: number, data: RunResponse | null): LaunchGuardDecision {
  if (status === 429) {
    return { kind: 'confirm', reason: 'error', text: 'Launch checks ran several times in the last minute, so they did not run again.' };
  }
  if (status < 200 || status >= 300 || !data?.ok || !data.run?.overall) {
    return { kind: 'confirm', reason: 'error', text: `Launch checks could not run (${data?.error?.code ?? status}).` };
  }
  if (data.run.overall === 'RED') return { kind: 'confirm', reason: 'red', failing: data.run.failing ?? [] };
  return { kind: 'proceed', overall: data.run.overall };
}

export async function runLaunchGuard(shopId: string, fetchImpl: typeof fetch = fetch): Promise<LaunchGuardDecision> {
  try {
    const response = await fetchImpl(shopHealthRunApi(shopId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launch: true }),
    });
    const data = (await response.json().catch(() => null)) as RunResponse | null;
    return decideLaunchGuard(response.status, data);
  } catch {
    return { kind: 'confirm', reason: 'error', text: 'Launch checks could not run (network error).' };
  }
}
