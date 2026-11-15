import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import AdminSectionHeader from '@/components/admin/AdminSectionHeader';
import { ListChecks, MessageCircle, Pencil, Send, X } from '@/components/lucide-react';
import { HubChangeComposer } from '@/components/previewHub/HubChangeComposer';
import { useHubChanges } from '@/components/previewHub/useHubChanges';
import {
  ADMIN_HUB_CHANGES_DONE,
  ADMIN_HUB_CHANGES_DRAFTS,
  ADMIN_HUB_CHANGES_EMPTY,
  ADMIN_HUB_CHANGES_EMPTY_HINT,
  ADMIN_HUB_CHANGES_FILTER,
  ADMIN_HUB_CHANGES_FILTER_EMPTY,
  ADMIN_HUB_CHANGES_NOTHING_TO_SEND,
  ADMIN_HUB_CHANGES_READY,
  ADMIN_HUB_CHANGES_SELF_EDIT,
  ADMIN_HUB_CHANGES_SHOW_ALL,
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

type ChangeFilter = 'drafts' | 'with' | 'done';

function changeTone(status: HubChangePublic['status']): 'draft' | 'sent' | 'prog' | 'done' {
  if (status === 'DRAFT') return 'draft';
  if (status === 'SENT') return 'sent';
  if (status === 'IN_PROGRESS') return 'prog';
  return 'done';
}

function changeGroup(status: HubChangePublic['status']): ChangeFilter {
  if (status === 'DRAFT') return 'drafts';
  if (status === 'SENT' || status === 'IN_PROGRESS') return 'with';
  return 'done';
}

const EASE = [0.16, 1, 0.3, 1] as const;

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
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<ChangeFilter | null>(null);
  const counts: Record<ChangeFilter, number> = { drafts: 0, with: 0, done: 0 };
  for (const item of hub.items) counts[changeGroup(item.status)] += 1;
  const drafts = counts.drafts;
  const roundText = HUB_CHANGES_ROUND(hub.used, props.includedChangeRounds);
  const visible = filter ? hub.items.filter((item) => changeGroup(item.status) === filter) : hub.items;
  const sendDisabled = hub.busy || hub.sendBlocked || !hub.canSend || drafts === 0;
  const filters: Array<{ id: ChangeFilter; label: string }> = [
    { id: 'drafts', label: ADMIN_HUB_CHANGES_DRAFTS },
    { id: 'with', label: ADMIN_HUB_CHANGES_WITH },
    { id: 'done', label: ADMIN_HUB_CHANGES_DONE },
  ];

  return (
    <article className="admin-hub-changes" data-testid="admin-hub-changes">
      <AdminSectionHeader
        title={HUB_NAV.changes}
        description={`${ADMIN_HUB_CHANGES_SUB} ${ADMIN_HUB_CHANGES_SELF_EDIT}`}
        actions={
          props.canDraft ? (
            <button type="button" className="btn btn--outline" onClick={() => hub.openComposer()}>
              <MessageCircle width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
              <span className="admin-hub-changes__suggest-full">{HUB_CHANGES_ADD}</span>
              <span className="admin-hub-changes__suggest-short">{ADMIN_HUB_WEBSITE_SUGGEST_SHORT}</span>
            </button>
          ) : undefined
        }
      />

      <div className="admin-hub-changes__stats" role="group" aria-label={ADMIN_HUB_CHANGES_FILTER}>
        {filters.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="admin-hub-chfilter"
            aria-pressed={filter === entry.id}
            data-zero={counts[entry.id] === 0 ? 'true' : undefined}
            onClick={() => setFilter((current) => (current === entry.id ? null : entry.id))}
          >
            <b>{counts[entry.id]}</b>
            <span>{entry.label}</span>
          </button>
        ))}
      </div>

      <p className="admin-hub-changes__round">
        <span className="admin-hub-changes__pips" aria-hidden="true">
          {Array.from({ length: Math.min(props.includedChangeRounds, 6) }, (_, index) => (
            <i key={index} data-used={index < hub.used ? 'true' : undefined} />
          ))}
        </span>
        {roundText}
      </p>

      {hub.items.length === 0 ? (
        <p className="admin-hub-changes__empty">
          <span className="admin-hub-changes__empty-icon" aria-hidden="true">
            <ListChecks width={20} height={20} strokeWidth={1.8} />
          </span>
          <strong>{ADMIN_HUB_CHANGES_EMPTY}</strong>
          <span>{ADMIN_HUB_CHANGES_EMPTY_HINT}</span>
        </p>
      ) : null}

      {hub.items.length > 0 && visible.length === 0 ? (
        <p className="admin-hub-changes__empty">
          <span>{ADMIN_HUB_CHANGES_FILTER_EMPTY}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFilter(null)}>
            {ADMIN_HUB_CHANGES_SHOW_ALL}
          </button>
        </p>
      ) : null}

      <ul className="admin-hub-changes__list">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((item) => (
            <motion.li
              key={item.id}
              layout={reduceMotion ? false : 'position'}
              initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE }}
              className={`admin-hub-changes__item is-${item.status.toLowerCase()}`}
            >
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
                    <Pencil width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
                    {HUB_CHANGES_EDIT}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void hub.removeDraft(item.id)}
                  >
                    <X width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
                    {HUB_CHANGES_DELETE}
                  </button>
                </div>
              ) : null}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="admin-hub-changes__send" data-idle={drafts === 0 ? 'true' : undefined}>
        <p className="admin-hub-changes__send-label" aria-live="polite">
          {drafts === 0 ? ADMIN_HUB_CHANGES_NOTHING_TO_SEND : ADMIN_HUB_CHANGES_READY(drafts)}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="hub-send-changes"
          onClick={() => void hub.send()}
          disabled={sendDisabled}
        >
          {hub.busy ? null : <Send width={15} height={15} strokeWidth={1.8} aria-hidden="true" />}
          {hub.busy ? HUB_CHANGES_SENDING : HUB_CHANGES_SEND}
        </button>
        {hub.sendBlocked ? <p className="admin-hub-changes__send-blocked">{HUB_ROUND_USED}</p> : null}
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
