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
  /** Private /preview/{token} URL for "Copy preview link". */
  previewUrl: string;
  sitePreviewUrl: string | null;
  sitePreviewVersion: string | null;
  /** FREE_PREVIEW_FLOW_ENABLED: previews 404 and "Mark ready and send" is refused while it is off. */
  flowEnabled: boolean;
  /** PREVIEW_HUB_ENABLED: show the owner hub link even before a draft shop exists. */
  hubEnabled?: boolean;
  hubStageLabel?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TRANSITION: 'That change is not allowed from the current status.',
  DRAFT_SHOP_ALREADY_LINKED: 'A draft shop is already linked.',
  SHOP_NOT_FOUND: 'No shop with that ID.',
  SHOP_HAS_OWNER: 'That shop already has an owner. Only ownerless draft shops can be linked.',
  SHOP_LINKED_ELSEWHERE: 'That shop is already linked to another preview request.',
  NOT_FOUND: 'This request no longer exists.',
  NO_DRAFT_SHOP: 'Create or link a draft shop first.',
  INVALID_PREVIEW_URL: 'The website preview URL must be a valid https:// URL.',
  SITE_PREVIEW_MISSING: 'Set the website preview URL before sending.',
  PREVIEW_FLOW_DISABLED: 'FREE_PREVIEW_FLOW_ENABLED is off, so the preview link would 404. Nothing was sent.',
};

const MARK_READY_FROM: readonly Status[] = ['REQUESTED', 'IN_PROGRESS', 'CHANGES_REQUESTED'];

const FINAL: readonly Status[] = ['CONVERTED', 'REJECTED'];

export default function PreviewRequestActions(props: Props) {
  const [notes, setNotes] = useState(props.internalNotes);
  const [linkShopId, setLinkShopId] = useState('');
  const [siteUrl, setSiteUrl] = useState(props.sitePreviewUrl ?? '');
  const [siteVersion, setSiteVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const isFinal = FINAL.includes(props.status);
  const canToggleProgress = props.status === 'REQUESTED' || props.status === 'IN_PROGRESS';
  const canMarkReady = MARK_READY_FROM.includes(props.status) && Boolean(props.draftShopId);
  const readyEmail = props.status === 'CHANGES_REQUESTED' ? 'E4 “We’ve updated your preview”' : 'E3 “Your preview is ready”';

  async function copyPreviewLink() {
    try {
      await navigator.clipboard.writeText(props.previewUrl);
      setMessage({ kind: 'ok', text: 'Preview link copied.' });
    } catch {
      window.prompt('Copy the preview link:', props.previewUrl);
    }
  }

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
      </section>

      <section className="ops-pr-actions__block" aria-labelledby="ops-pr-preview-title">
        <h2 id="ops-pr-preview-title" className="ops-pr-actions__title">
          Preview
        </h2>
        {!props.flowEnabled ? (
          <p className="ops-pr-actions__hint">
            FREE_PREVIEW_FLOW_ENABLED is off: the preview link returns 404 and nothing can be sent.
          </p>
        ) : null}
        {props.hubEnabled && props.hubStageLabel ? (
          <p className="ops-pr-actions__hint">Owner-facing stage: {props.hubStageLabel}</p>
        ) : null}
        <div className="ops-pr-actions__row">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => void copyPreviewLink()}>
            Copy preview link
          </button>
          {props.draftShopId ? (
            <a className="btn btn--secondary btn--sm" href={props.previewUrl} target="_blank" rel="noopener noreferrer">
              Open preview
            </a>
          ) : null}
          {props.hubEnabled ? (
            <a className="btn btn--primary btn--sm" href={props.previewUrl} target="_blank" rel="noopener noreferrer">
              Open hub as KERSIVO
            </a>
          ) : null}
        </div>
        {props.draftShopId && !isFinal ? (
          <form
            className="ops-pr-actions__stack"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                { action: 'set_site_preview', previewUrl: siteUrl.trim(), siteVersion: siteVersion.trim() },
                'Website preview saved.',
              );
            }}
          >
            <label className="ops-pr-actions__hint" htmlFor="ops-pr-site-url">
              Website preview URL (https, frameable from kersivo.co.uk, sends noindex)
            </label>
            <input
              id="ops-pr-site-url"
              className="input"
              type="url"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              placeholder="https://…"
              maxLength={2000}
              required
            />
            <label className="ops-pr-actions__hint" htmlFor="ops-pr-site-version">
              Site version{props.sitePreviewVersion ? ` (current: ${props.sitePreviewVersion})` : ''}
            </label>
            <input
              id="ops-pr-site-version"
              className="input"
              value={siteVersion}
              onChange={(event) => setSiteVersion(event.target.value)}
              placeholder="v1"
              maxLength={80}
              required
            />
            <div className="ops-pr-actions__row">
              <button
                type="submit"
                className="btn btn--secondary btn--sm"
                disabled={busy || !siteUrl.trim() || !siteVersion.trim()}
              >
                Save website preview
              </button>
            </div>
          </form>
        ) : null}
        {canMarkReady ? (
          <div className="ops-pr-actions__row">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy || !props.flowEnabled || !props.sitePreviewUrl}
              onClick={() => {
                if (window.confirm(`Mark ready and email the owner (${readyEmail})?`)) {
                  void run({ action: 'mark_ready_and_send' }, `Marked ready and sent ${readyEmail}.`);
                }
              }}
            >
              Mark ready and send
            </button>
          </div>
        ) : null}
        {canMarkReady ? <p className="ops-pr-actions__hint">Sends {readyEmail} with the preview link and expiry date.</p> : null}
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
