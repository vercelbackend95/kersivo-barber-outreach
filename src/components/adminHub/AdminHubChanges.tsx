import { MessageCircle } from '@/components/lucide-react';
import { HubChangeComposer } from '@/components/previewHub/HubChangeComposer';
import { useHubChanges } from '@/components/previewHub/useHubChanges';
import {
  ADMIN_HUB_CHANGES_DONE,
  ADMIN_HUB_CHANGES_DRAFTS,
  ADMIN_HUB_CHANGES_EMPTY,
  ADMIN_HUB_CHANGES_SELF_EDIT,
  ADMIN_HUB_CHANGES_SUB,
  ADMIN_HUB_CHANGES_WITH,
  ADMIN_HUB_WEBSITE_SUGGEST_SHORT,
} from '@/lib/adminHub/copy';
import type { HubChangePublic } from '@/lib/freePreview/hubChanges.shared';
import {
  HUB_CHANGES_ADD,
  HUB_CHANGES_DELETE,
  HUB_CHANGES_DONE,
  HUB_CHANGES_DRAFT,
  HUB_CHANGES_EDIT,
  HUB_CHANGES_IN_PROGRESS,
  HUB_CHANGES_NOT_POSSIBLE,
  HUB_CHANGES_ROUND,
  HUB_CHANGES_SEND,
  HUB_CHANGES_SENDING,
  HUB_CHANGES_STATUS_SENT,
  HUB_NAV,
  HUB_RETRY,
  HUB_ROUND_USED,
} from '@/lib/freePreview/hubCopy';
import { AdminHubSheet } from './AdminHubSheet';

const STATUS_LABEL: Record<HubChangePublic['status'], string> = {
  DRAFT: HUB_CHANGES_DRAFT,
  SENT: HUB_CHANGES_STATUS_SENT,
  IN_PROGRESS: HUB_CHANGES_IN_PROGRESS,
  DONE: HUB_CHANGES_DONE,
  NOT_POSSIBLE: HUB_CHANGES_NOT_POSSIBLE,
};

function changeTone(status: HubChangePublic['status']): 'draft' | 'sent' | 'prog' | 'done' {
  if (status === 'DRAFT') return 'draft';
  if (status === 'SENT') return 'sent';
  if (status === 'IN_PROGRESS') return 'prog';
  return 'done';
}

export function AdminHubChanges(props: {
  token: string;
  apiBase?: string;
  initialItems: HubChangePublic[];
  includedChangeRounds: number;
  changeRoundsUsed: number;
  canDraft: boolean;
  canSend: boolean;
}) {
  const hub = useHubChanges(props);
  const drafts = hub.drafts.length;
  const withKersivo = hub.items.filter((item) => item.status === 'SENT' || item.status === 'IN_PROGRESS').length;
  const done = hub.items.filter((item) => item.status === 'DONE' || item.status === 'NOT_POSSIBLE').length;
  const roundText = HUB_CHANGES_ROUND(hub.used, props.includedChangeRounds);

  return (
    <article className="admin-hub-changes" data-testid="admin-hub-changes">
      <header className="admin-hub-head">
        <div>
          <span className="admin-hub-head__eyebrow">{HUB_NAV.changes}</span>
          <h1>{HUB_NAV.changes}</h1>
          <p className="admin-hub-head__sub">
            {roundText}. {ADMIN_HUB_CHANGES_SUB} {ADMIN_HUB_CHANGES_SELF_EDIT}
          </p>
        </div>
        {props.canDraft ? (
          <div className="admin-hub-head__actions">
            <button type="button" className="btn btn--outline" onClick={() => hub.openComposer()}>
              <MessageCircle width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
              <span className="admin-hub-changes__suggest-full">{HUB_CHANGES_ADD}</span>
              <span className="admin-hub-changes__suggest-short">{ADMIN_HUB_WEBSITE_SUGGEST_SHORT}</span>
            </button>
          </div>
        ) : null}
      </header>

      <div className="admin-hub-chstats admin-hub-changes__stats">
        <div className="admin-hub-chstat">
          <b>{drafts}</b>
          <span>{ADMIN_HUB_CHANGES_DRAFTS}</span>
        </div>
        <div className="admin-hub-chstat">
          <b>{withKersivo}</b>
          <span>{ADMIN_HUB_CHANGES_WITH}</span>
        </div>
        <div className="admin-hub-chstat">
          <b>{done}</b>
          <span>{ADMIN_HUB_CHANGES_DONE}</span>
        </div>
      </div>

      {hub.items.length === 0 ? <p className="admin-hub-changes__empty">{ADMIN_HUB_CHANGES_EMPTY}</p> : null}

      <ul className="admin-hub-changes__list">
        {hub.items.map((item) => (
          <li key={item.id} className={`admin-hub-changes__item is-${item.status.toLowerCase()}`}>
            <span className="admin-hub-chip admin-hub-chip--page">{item.pageLabel}</span>
            <div className="admin-hub-changes__body">
              <p>{item.body}</p>
              {item.opsNote ? <p className="admin-hub-changes__note">{item.opsNote}</p> : null}
            </div>
            <span className={`admin-hub-chip admin-hub-chip--${changeTone(item.status)}`}>
              {STATUS_LABEL[item.status]}
            </span>
            {item.status === 'DRAFT' && props.canDraft ? (
              <div className="admin-hub-changes__item-actions">
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

      <div className="admin-hub-changes__send">
        <button
          type="button"
          className="btn btn--primary"
          data-testid="hub-send-changes"
          onClick={() => void hub.send()}
          disabled={hub.busy || hub.sendBlocked || !hub.canSend || hub.drafts.length === 0}
        >
          {hub.busy ? HUB_CHANGES_SENDING : HUB_CHANGES_SEND}
        </button>
        {hub.sendBlocked ? <p>{HUB_ROUND_USED}</p> : null}
      </div>

      {hub.error ? (
        <p className="admin-hub-changes__error" role="alert">
          {hub.error}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => hub.setError(null)}>
            {HUB_RETRY}
          </button>
        </p>
      ) : null}
      <div className="hub-toast" role="status" aria-live="polite">
        {hub.toast}
      </div>

      {hub.composer ? (
        <AdminHubSheet title={HUB_CHANGES_ADD} crumb={`${HUB_NAV.changes} › ${HUB_CHANGES_ADD}`} onClose={hub.closeComposer}>
          <HubChangeComposer
            token={props.token}
            apiBase={props.apiBase}
            composer={hub.composer}
            setComposer={hub.setComposer}
            busy={hub.busy}
            onCancel={hub.closeComposer}
            onSave={() => void hub.saveDraft()}
          />
        </AdminHubSheet>
      ) : null}
    </article>
  );
}
