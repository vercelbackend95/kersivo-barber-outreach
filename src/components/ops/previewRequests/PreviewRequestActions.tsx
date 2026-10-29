import { useState } from 'react';

type Status =
  | 'REQUESTED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'CHANGES_REQUESTED'
  | 'CONVERTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REJECTED';

type Props = {
  requestId: string;
  status: Status;
  draftShopId: string | null;
  internalNotes: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TRANSITION: 'That change is not allowed from the current status.',
  DRAFT_SHOP_ALREADY_LINKED: 'A draft shop is already linked.',
  SHOP_NOT_FOUND: 'No shop with that ID.',
  SHOP_HAS_OWNER: 'That shop already has an owner. Only ownerless draft shops can be linked.',
  SHOP_LINKED_ELSEWHERE: 'That shop is already linked to another preview request.',
  NOT_FOUND: 'This request no longer exists.',
};

const FINAL: readonly Status[] = ['CONVERTED', 'REJECTED'];

export default function PreviewRequestActions(props: Props) {
  const [notes, setNotes] = useState(props.internalNotes);
  const [linkShopId, setLinkShopId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const isFinal = FINAL.includes(props.status);
  const canToggleProgress = props.status === 'REQUESTED' || props.status === 'IN_PROGRESS';

  async function run(body: Record<string, unknown>, successText: string, reload = true) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/ops/preview-requests/${encodeURIComponent(props.requestId)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { code?: string };
      };
      if (!response.ok || !data.ok) {
        const code = data.error?.code ?? '';
        setMessage({ kind: 'error', text: ERROR_MESSAGES[code] ?? `Action failed (${code || response.status}).` });
        return;
      }
      setMessage({ kind: 'ok', text: successText });
      if (reload) window.location.reload();
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ops-pr-actions">
      <section className="ops-pr-actions__block" aria-labelledby="ops-pr-status-title">
        <h2 id="ops-pr-status-title" className="ops-pr-actions__title">
          Status
        </h2>
        <div className="ops-pr-actions__row">
          {canToggleProgress ? (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busy}
              onClick={() =>
                run(
                  { action: 'set_status', status: props.status === 'REQUESTED' ? 'IN_PROGRESS' : 'REQUESTED' },
                  'Status updated.',
                )
              }
            >
              {props.status === 'REQUESTED' ? 'Mark in progress' : 'Move back to requested'}
            </button>
          ) : null}
          {!isFinal ? (
            <button
              type="button"
              className="btn btn--secondary btn--sm ops-pr-actions__danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Reject this request? No email is sent.')) {
                  void run({ action: 'reject' }, 'Request rejected.');
                }
              }}
            >
              Reject
            </button>
          ) : null}
        </div>
        <p className="ops-pr-actions__hint">
          “Mark ready and send” and “Copy preview link” arrive with the preview page (Batch 2).
        </p>
      </section>

      <section className="ops-pr-actions__block" aria-labelledby="ops-pr-draft-title">
        <h2 id="ops-pr-draft-title" className="ops-pr-actions__title">
          Draft shop
        </h2>
        {props.draftShopId ? (
          <p className="ops-pr-actions__hint">
            Linked: <code>{props.draftShopId}</code>
          </p>
        ) : isFinal ? (
          <p className="ops-pr-actions__hint">No draft shop.</p>
        ) : (
          <>
            <div className="ops-pr-actions__row">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={busy}
                onClick={() => run({ action: 'create_draft_shop' }, 'Draft shop created.')}
              >
                Create draft shop
              </button>
            </div>
            <form
              className="ops-pr-actions__row"
              onSubmit={(event) => {
                event.preventDefault();
                if (linkShopId.trim()) {
                  void run({ action: 'link_draft_shop', shopId: linkShopId.trim() }, 'Draft shop linked.');
                }
              }}
            >
              <label className="sr-only" htmlFor="ops-pr-link-shop">
                Existing ownerless shop ID
              </label>
              <input
                id="ops-pr-link-shop"
                className="input"
                value={linkShopId}
                onChange={(event) => setLinkShopId(event.target.value)}
                placeholder="Existing ownerless shop ID"
                maxLength={64}
              />
              <button type="submit" className="btn btn--secondary btn--sm" disabled={busy || !linkShopId.trim()}>
                Link
              </button>
            </form>
          </>
        )}
      </section>

      <section className="ops-pr-actions__block" aria-labelledby="ops-pr-notes-title">
        <h2 id="ops-pr-notes-title" className="ops-pr-actions__title">
          Internal notes
        </h2>
        <label className="sr-only" htmlFor="ops-pr-notes">
          Internal notes
        </label>
        <textarea
          id="ops-pr-notes"
          className="input ops-pr-actions__notes"
          value={notes}
          maxLength={5000}
          rows={6}
          onChange={(event) => setNotes(event.target.value)}
        />
        <div className="ops-pr-actions__row">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={busy || notes === props.internalNotes}
            onClick={() => run({ action: 'update_notes', internalNotes: notes }, 'Notes saved.', false)}
          >
            Save notes
          </button>
        </div>
      </section>

      <p
        className={`ops-pr-actions__message ops-pr-actions__message--${message?.kind ?? 'idle'}`}
        role="status"
        aria-live="polite"
      >
        {message?.text ?? ''}
      </p>
    </div>
  );
}
