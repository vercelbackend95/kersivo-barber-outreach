import {
  HUB_CHANGES_ADD,
  HUB_CHANGES_DELETE,
  HUB_CHANGES_DONE,
  HUB_CHANGES_DRAFT,
  HUB_CHANGES_EDIT,
  HUB_CHANGES_EMPTY,
  HUB_CHANGES_IN_PROGRESS,
  HUB_CHANGES_NOT_POSSIBLE,
  HUB_CHANGES_ROUND,
  HUB_CHANGES_SEND,
  HUB_CHANGES_SENDING,
  HUB_CHANGES_STATUS_SENT,
  HUB_RETRY,
  HUB_ROUND_USED,
} from '@/lib/freePreview/hubCopy';
import type { HubChangePublic } from '@/lib/freePreview/hubChanges.shared';
import { HubChangeComposer } from './HubChangeComposer';
import { useHubChanges, type HubChangesModel } from './useHubChanges';

const STATUS_LABEL: Record<HubChangePublic['status'], string> = {
  DRAFT: HUB_CHANGES_DRAFT,
  SENT: HUB_CHANGES_STATUS_SENT,
  IN_PROGRESS: HUB_CHANGES_IN_PROGRESS,
  DONE: HUB_CHANGES_DONE,
  NOT_POSSIBLE: HUB_CHANGES_NOT_POSSIBLE,
};

export function HubChanges(props: HubChangesModel) {
  const hub = useHubChanges(props);

  return (
    <article className="hub-changes">
      <header className="hub-review-card__head">
        <p className="hub-card__body">{HUB_CHANGES_ROUND(hub.used, props.includedChangeRounds)}</p>
        {props.canDraft ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => hub.openComposer(props.initialPage)}>
            {HUB_CHANGES_ADD}
          </button>
        ) : null}
      </header>

      {hub.items.length === 0 && !hub.composer ? <p className="hub-card__body">{HUB_CHANGES_EMPTY}</p> : null}

      <ul className="hub-change-list">
        {hub.items.map((item) => (
          <li key={item.id} className={`hub-change-item is-${item.status.toLowerCase()}`}>
            <div>
              <p className="hub-change-item__page">{item.pageLabel}</p>
              <p>{item.body}</p>
              {item.opsNote ? <p className="hub-card__body">{item.opsNote}</p> : null}
            </div>
            <span className="hub-review-chip">{STATUS_LABEL[item.status]}</span>
            {item.status === 'DRAFT' && props.canDraft ? (
              <div className="hub-change-item__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => hub.editItem(item)}>
                  {HUB_CHANGES_EDIT}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void hub.removeDraft(item.id)}>
                  {HUB_CHANGES_DELETE}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {hub.composer ? (
        <HubChangeComposer
          token={props.token}
          apiBase={props.apiBase}
          composer={hub.composer}
          setComposer={hub.setComposer}
          busy={hub.busy}
          onCancel={hub.closeComposer}
          onSave={() => void hub.saveDraft()}
        />
      ) : null}

      <div className="hub-changes__send">
        <button
          type="button"
          className="btn btn--primary"
          data-testid="hub-send-changes"
          onClick={() => void hub.send()}
          disabled={hub.busy || hub.sendBlocked || !hub.canSend || hub.drafts.length === 0}
        >
          {hub.busy ? HUB_CHANGES_SENDING : HUB_CHANGES_SEND}
        </button>
        {hub.sendBlocked ? <p className="hub-card__body">{HUB_ROUND_USED}</p> : null}
      </div>

      {hub.error ? (
        <p className="hub-card__body" role="alert">
          {hub.error}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => hub.setError(null)}>
            {HUB_RETRY}
          </button>
        </p>
      ) : null}
      <div className="hub-toast" role="status" aria-live="polite">
        {hub.toast}
      </div>
    </article>
  );
}
