import { useState } from 'react';
import {
  HUB_CHANGES_ADD,
  HUB_CHANGES_ATTACHMENT,
  HUB_CHANGES_BODY,
  HUB_CHANGES_CANCEL,
  HUB_CHANGES_DELETE,
  HUB_CHANGES_DONE,
  HUB_CHANGES_DRAFT,
  HUB_CHANGES_EDIT,
  HUB_CHANGES_EMPTY,
  HUB_CHANGES_FAILED,
  HUB_CHANGES_IN_PROGRESS,
  HUB_CHANGES_LOAD_ERROR,
  HUB_CHANGES_NO_DRAFTS,
  HUB_CHANGES_NOT_POSSIBLE,
  HUB_CHANGES_PAGE,
  HUB_CHANGES_PAGES,
  HUB_CHANGES_ROUND,
  HUB_CHANGES_SAVE_DRAFT,
  HUB_CHANGES_SEND,
  HUB_CHANGES_SENDING,
  HUB_CHANGES_SENT,
  HUB_CHANGES_STATUS_SENT,
  HUB_RETRY,
  HUB_ROUND_USED,
} from '@/lib/freePreview/hubCopy';
import { HUB_CHANGE_PAGES, type HubChangePublic } from '@/lib/freePreview/hubChanges.shared';
import { HubUploader } from './HubUploader';

const STATUS_LABEL: Record<HubChangePublic['status'], string> = {
  DRAFT: HUB_CHANGES_DRAFT,
  SENT: HUB_CHANGES_STATUS_SENT,
  IN_PROGRESS: HUB_CHANGES_IN_PROGRESS,
  DONE: HUB_CHANGES_DONE,
  NOT_POSSIBLE: HUB_CHANGES_NOT_POSSIBLE,
};

type DraftForm = {
  id?: string;
  page: (typeof HUB_CHANGE_PAGES)[number];
  body: string;
  attachmentId: string | null;
};

const emptyDraft = (page: DraftForm['page'] = 'HOME'): DraftForm => ({
  page,
  body: '',
  attachmentId: null,
});

export function HubChanges(props: {
  token: string;
  initialItems: HubChangePublic[];
  includedChangeRounds: number;
  changeRoundsUsed: number;
  canDraft: boolean;
  canSend: boolean;
  initialPage?: DraftForm['page'];
  startComposer?: boolean;
}) {
  const [items, setItems] = useState(props.initialItems);
  const [used, setUsed] = useState(props.changeRoundsUsed);
  const [canSend, setCanSend] = useState(props.canSend);
  const [composer, setComposer] = useState<DraftForm | null>(props.startComposer ? emptyDraft(props.initialPage) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const drafts = items.filter((item) => item.status === 'DRAFT');
  const sendBlocked = used >= props.includedChangeRounds;

  async function saveDraft() {
    if (!composer || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = composer.id
        ? `/api/preview-hub/${encodeURIComponent(props.token)}/changes/${encodeURIComponent(composer.id)}`
        : `/api/preview-hub/${encodeURIComponent(props.token)}/changes`;
      const response = await fetch(url, {
        method: composer.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composer),
      });
      const payload = (await response.json()) as { ok?: boolean; item?: HubChangePublic; error?: string };
      if (!response.ok || !payload.ok || !payload.item) throw new Error(payload.error || HUB_CHANGES_FAILED);
      setItems((current) => {
        const next = current.filter((row) => row.id !== payload.item!.id);
        return [...next, payload.item!].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
      setComposer(null);
      setToast(HUB_CHANGES_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_CHANGES_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function removeDraft(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/preview-hub/${encodeURIComponent(props.token)}/changes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || HUB_CHANGES_FAILED);
      setItems((current) => current.filter((row) => row.id !== id));
      if (composer?.id === id) setComposer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_CHANGES_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (busy || sendBlocked) return;
    if (drafts.length === 0) {
      setError(HUB_CHANGES_NO_DRAFTS);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/preview-hub/${encodeURIComponent(props.token)}/changes/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        items?: HubChangePublic[];
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.items) throw new Error(payload.error || HUB_CHANGES_FAILED);
      setItems(payload.items);
      setUsed((value) => value + 1);
      setCanSend(false);
      setToast(HUB_CHANGES_SENT);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_CHANGES_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="hub-changes">
      <header className="hub-review-card__head">
        <p className="hub-card__body">{HUB_CHANGES_ROUND(used, props.includedChangeRounds)}</p>
        {props.canDraft ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setComposer(emptyDraft(props.initialPage))}>
            {HUB_CHANGES_ADD}
          </button>
        ) : null}
      </header>

      {items.length === 0 && !composer ? <p className="hub-card__body">{HUB_CHANGES_EMPTY}</p> : null}

      <ul className="hub-change-list">
        {items.map((item) => (
          <li key={item.id} className={`hub-change-item is-${item.status.toLowerCase()}`}>
            <div>
              <p className="hub-change-item__page">{item.pageLabel}</p>
              <p>{item.body}</p>
              {item.opsNote ? <p className="hub-card__body">{item.opsNote}</p> : null}
            </div>
            <span className="hub-review-chip">{STATUS_LABEL[item.status]}</span>
            {item.status === 'DRAFT' && props.canDraft ? (
              <div className="hub-change-item__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() =>
                    setComposer({
                      id: item.id,
                      page: item.page,
                      body: item.body,
                      attachmentId: item.attachmentId,
                    })
                  }
                >
                  {HUB_CHANGES_EDIT}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void removeDraft(item.id)}>
                  {HUB_CHANGES_DELETE}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {composer ? (
        <form
          className="hub-card ks-glass-card hub-change-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDraft();
          }}
        >
          <label>
            {HUB_CHANGES_PAGE}
            <select
              className="input"
              data-testid="hub-change-page"
              value={composer.page}
              onChange={(event) =>
                setComposer({ ...composer, page: event.target.value as DraftForm['page'] })
              }
            >
              {HUB_CHANGE_PAGES.map((page) => (
                <option key={page} value={page}>
                  {HUB_CHANGES_PAGES[page]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {HUB_CHANGES_BODY}
            <textarea
              className="textarea"
              data-testid="hub-change-body"
              required
              maxLength={2000}
              value={composer.body}
              onChange={(event) => setComposer({ ...composer, body: event.target.value })}
            />
          </label>
          <div>
            <p className="field__hint">{HUB_CHANGES_ATTACHMENT}</p>
            <HubUploader
              token={props.token}
              kind="CHANGE_ATTACHMENT"
              compact
              remaining={1}
              onUploaded={(asset) => setComposer({ ...composer, attachmentId: asset.id })}
            />
          </div>
          <div className="hub-review-card__actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setComposer(null)} disabled={busy}>
              {HUB_CHANGES_CANCEL}
            </button>
            <button type="submit" className="btn btn--primary btn--sm" data-testid="hub-save-draft" disabled={busy || !composer.body.trim()}>
              {busy ? HUB_CHANGES_SENDING : HUB_CHANGES_SAVE_DRAFT}
            </button>
          </div>
        </form>
      ) : null}

      <div className="hub-changes__send">
        <button
          type="button"
          className="btn btn--primary"
          data-testid="hub-send-changes"
          onClick={() => void send()}
          disabled={busy || sendBlocked || !canSend || drafts.length === 0}
        >
          {busy ? HUB_CHANGES_SENDING : HUB_CHANGES_SEND}
        </button>
        {sendBlocked ? <p className="hub-card__body">{HUB_ROUND_USED}</p> : null}
      </div>

      {error ? (
        <p className="hub-card__body" role="alert">
          {error}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setError(null)}>
            {HUB_RETRY}
          </button>
        </p>
      ) : null}
      <div className="hub-toast" role="status" aria-live="polite">
        {toast}
      </div>
    </article>
  );
}
