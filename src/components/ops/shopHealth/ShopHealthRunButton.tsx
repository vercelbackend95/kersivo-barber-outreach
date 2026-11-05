import { useState } from 'react';
import { shopHealthRunApi } from '@/lib/ops/shopHealth/display';

type Props = {
  shopId: string;
  label?: string;
  /** Primary on the report page, secondary in lists and the rail card. */
  variant?: 'primary' | 'secondary';
  /** Accessible name when several buttons share a page (the /ops/shops table). */
  shopName?: string;
  compact?: boolean;
};

type ErrorBody = { ok?: boolean; error?: { code?: string; retryAfterSeconds?: number } };

/** "Run checks now": POST /api/ops/shops/[shopId]/health/run, then reload to show the new run. */
export default function ShopHealthRunButton({ shopId, label = 'Run checks now', variant = 'secondary', shopName, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'busy'; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMessage({ kind: 'busy', text: 'Running checks… this can take up to a minute.' });
    try {
      const response = await fetch(shopHealthRunApi(shopId), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = (await response.json().catch(() => ({}))) as ErrorBody;
      if (response.status === 429) {
        const wait = data.error?.retryAfterSeconds ?? 60;
        setMessage({ kind: 'error', text: `Checked less than a minute ago. Try again in ${wait} s.` });
        return;
      }
      if (!response.ok || !data.ok) {
        setMessage({ kind: 'error', text: `Checks could not run (${data.error?.code ?? response.status}).` });
        return;
      }
      setMessage({ kind: 'ok', text: 'Checks finished. Updating…' });
      window.location.reload();
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`ops-sh-run${compact ? ' ops-sh-run--compact' : ''}`}>
      <button
        type="button"
        className={`btn btn--${variant} btn--sm`}
        disabled={busy}
        aria-busy={busy}
        aria-label={shopName ? `${label} for ${shopName}` : undefined}
        onClick={() => void run()}
      >
        {busy ? 'Running…' : label}
      </button>
      <p className={`ops-sh-run__message ops-sh-run__message--${message?.kind ?? 'idle'}`} role="status" aria-live="polite">
        {message?.text ?? ''}
      </p>
    </div>
  );
}
