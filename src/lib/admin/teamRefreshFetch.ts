/**
 * Team / Barber list refresh fetch helpers.
 * Return structured success/failure so callers can update UI and report booleans to the wizard.
 */

export type TeamListRefreshSuccess = {
  ok: true;
  cards: unknown[];
  actorRole: string;
};

export type TeamListRefreshFailure = {
  ok: false;
  error: string;
};

export type BarbersListRefreshSuccess = {
  ok: true;
  barbers: unknown[];
};

export type BarbersListRefreshFailure = {
  ok: false;
};

type FetchLike = typeof fetch;

export async function fetchTeamListRefresh(
  fetchImpl: FetchLike = fetch,
): Promise<TeamListRefreshSuccess | TeamListRefreshFailure> {
  try {
    const res = await fetchImpl('/api/admin/team', { credentials: 'include' });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      cards?: unknown[];
      actorRole?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'Could not load team.' };
    }
    return {
      ok: true,
      cards: data.cards || [],
      actorRole: data.actorRole || 'OWNER',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not load team.',
    };
  }
}

export async function fetchBarbersListRefresh(
  fetchImpl: FetchLike = fetch,
): Promise<BarbersListRefreshSuccess | BarbersListRefreshFailure> {
  try {
    const response = await fetchImpl('/api/admin/barbers', { credentials: 'include' });
    if (!response.ok) {
      return { ok: false };
    }
    const data = (await response.json()) as { barbers?: unknown[] };
    return { ok: true, barbers: data.barbers ?? [] };
  } catch {
    return { ok: false };
  }
}
