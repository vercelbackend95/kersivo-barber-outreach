import { useState } from 'react';
import {
  HUB_CHANGES_DONE,
  HUB_CHANGES_IN_PROGRESS,
  HUB_CHANGES_NOT_POSSIBLE,
  HUB_OPS_CHANGE_NOTE,
  HUB_OPS_GRANT_ROUND,
  HUB_OPS_GRANT_ROUND_DONE,
  HUB_RETRY,
} from '@/lib/freePreview/hubCopy';
import type { HubChangePublic } from '@/lib/freePreview/hubChanges';

export function OpsHubChanges(props: {
  requestId: string;
  initialItems: HubChangePublic[];
  includedChangeRounds: number;
  changeRoundsUsed: number;
}) {
  const [items, setItems] = useState(props.initialItems);
  const [included, setIncluded] = useState(props.includedChangeRounds);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function setStatus(item: HubChangePublic, status: 'IN_PROGRESS' | 'DONE' | 'NOT_POSSIBLE') {
    setBusy(`${item.id}-${status}`);
    setError(null);
    try {
      const response = await fetch(`/api/ops/preview-requests/${encodeURIComponent(props.requestId)}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId: item.id, status, opsNote: notes[item.id] ?? item.opsNote }),
      });
      const payload = (await response.json()) as { ok?: boolean; item?: HubChangePublic };
      if (!response.ok || !payload.ok || !payload.item) throw new Error('Could not update that change.');
      setItems((current) => current.map((row) => (row.id === payload.item!.id ? payload.item! : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that change.');
    } finally {
      setBusy(null);
    }
  }

  async function grant() {
    setBusy('grant');
    setError(null);
    try {
      const response = await fetch(`/api/ops/preview-requests/${encodeURIComponent(props.requestId)}/grant-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = (await response.json()) as { ok?: boolean; includedChangeRounds?: number };
      if (!response.ok || !payload.ok || payload.includedChangeRounds == null) throw new Error('Could not grant a round.');
      setIncluded(payload.includedChangeRounds);
      setToast(HUB_OPS_GRANT_ROUND_DONE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not grant a round.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ops-hub-changes" aria-label="Design changes">
      <p>
        {props.changeRoundsUsed} of {included} included rounds used
      </p>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => void grant()} disabled={busy !== null}>
        {HUB_OPS_GRANT_ROUND}
      </button>
      <ul className="hub-change-list">
        {items.map((item) => (
          <li key={item.id} className={`hub-change-item is-${item.status.toLowerCase()}`}>
            <div>
              <p className="hub-change-item__page">{item.pageLabel}</p>
              <p>{item.body}</p>
              {item.status !== 'DRAFT' ? (
                <label>
                  {HUB_OPS_CHANGE_NOTE}
                  <textarea
                    className="textarea"
                    value={notes[item.id] ?? item.opsNote ?? ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                </label>
              ) : null}
            </div>
            <span className="hub-review-chip">{item.status}</span>
            {item.status !== 'DRAFT' ? (
              <div className="hub-change-item__actions">
                <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => void setStatus(item, 'IN_PROGRESS')}>
                  {HUB_CHANGES_IN_PROGRESS}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => void setStatus(item, 'DONE')}>
                  {HUB_CHANGES_DONE}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => void setStatus(item, 'NOT_POSSIBLE')}>
                  {HUB_CHANGES_NOT_POSSIBLE}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setError(null)}>
            {HUB_RETRY}
          </button>
        </p>
      ) : null}
      <div className="hub-toast" role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
}
