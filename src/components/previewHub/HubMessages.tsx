import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HUB_ACTIVITY_EMPTY,
  HUB_DELETE,
  HUB_KERSIVO,
  HUB_MESSAGE_CHAR_COUNT,
  HUB_MESSAGE_FAILED,
  HUB_MESSAGE_HINT,
  HUB_MESSAGE_LOAD_ERROR,
  HUB_MESSAGE_PLACEHOLDER,
  HUB_MESSAGE_SENDING,
  HUB_MESSAGES_EMPTY,
  HUB_OPS_UPLOADED_BY_OWNER,
  HUB_RETRY,
  HUB_SEEN,
  HUB_SEND,
  HUB_YOU,
} from '@/lib/freePreview/hubCopy';
import {
  HUB_MESSAGE_MAX_ATTACHMENTS,
  HUB_MESSAGE_MAX_CHARS,
  HUB_MESSAGES_POLL_MS,
  hubMessageDayKey,
  hubMessageTimeLabel,
  type HubMessagePublic,
} from '@/lib/freePreview/hubMessages.shared';
import { splitHubMessageParts } from '@/lib/freePreview/hubMessageText';
import { hubApiRoot } from '@/lib/adminHub/links';
import { HubUploader, type HubUploadedAsset } from './HubUploader';

type PendingStatus = 'pending' | 'error';

type ThreadItem = HubMessagePublic & {
  pending?: PendingStatus;
  localId?: string;
};

function isMine(message: HubMessagePublic, viewer: 'owner' | 'ops'): boolean {
  return viewer === 'owner' ? message.author === 'OWNER' : message.author === 'KERSIVO';
}

function authorLabel(message: HubMessagePublic, viewer: 'owner' | 'ops'): string {
  if (isMine(message, viewer)) return HUB_YOU;
  return viewer === 'owner' ? HUB_KERSIVO : HUB_OPS_UPLOADED_BY_OWNER;
}

function seenLabel(message: HubMessagePublic, viewer: 'owner' | 'ops'): string | null {
  if (viewer === 'owner' && message.author === 'OWNER' && message.readByOpsAt) return HUB_SEEN;
  if (viewer === 'ops' && message.author === 'KERSIVO' && message.readByOwnerAt) return HUB_SEEN;
  return null;
}

export function HubMessageBody({ body }: { body: string }) {
  const parts = splitHubMessageParts(body);
  return (
    <p className="hub-msg__body">
      {parts.map((part, index) =>
        part.type === 'url' ? (
          <a
            key={`${part.value}-${index}`}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
          >
            {part.value}
          </a>
        ) : (
          <span key={`${index}`}>{part.value}</span>
        ),
      )}
    </p>
  );
}

function attachmentHref(input: {
  viewer: 'owner' | 'ops';
  token: string;
  apiBase?: string;
  requestId?: string;
  assetId: string;
  size: 'thumb' | 'full';
}): string {
  if (input.viewer === 'ops' && input.requestId) {
    return `/api/ops/preview-requests/${encodeURIComponent(input.requestId)}/assets/${encodeURIComponent(input.assetId)}?size=${input.size}`;
  }
  return `${hubApiRoot(input)}/assets/${encodeURIComponent(input.assetId)}?size=${input.size}`;
}

export function HubMessages(props: {
  token: string;
  /** Owner view inside /admin: '/api/admin-hub'. */
  apiBase?: string;
  viewer: 'owner' | 'ops';
  requestId?: string;
  shopName: string;
  initialMessages: HubMessagePublic[];
  initialDraft?: string;
  canAttach?: boolean;
  /** Admin-hub app window: hide the page H1 (the window already has a title). */
  chrome?: 'page' | 'app';
}) {
  const [messages, setMessages] = useState<ThreadItem[]>(props.initialMessages);
  const [draft, setDraft] = useState(props.initialDraft ?? '');
  const [attachments, setAttachments] = useState<HubUploadedAsset[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const messagesUrl =
    props.viewer === 'ops' && props.requestId
      ? `/api/ops/preview-requests/${encodeURIComponent(props.requestId)}/messages`
      : `${hubApiRoot(props)}/messages`;

  const scrollToEnd = () => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  };

  useEffect(() => {
    scrollToEnd();
  }, [messages.length]);

  useEffect(() => {
    if (props.initialDraft) composerRef.current?.focus();
  }, [props.initialDraft]);

  const markRead = async () => {
    if (props.viewer !== 'owner') return;
    try {
      await fetch(`${messagesUrl}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch {
      /* mark-read is best-effort; the next view retries */
    }
  };

  const refresh = async () => {
    try {
      const response = await fetch(messagesUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('load');
      const payload = (await response.json()) as { ok?: boolean; messages?: HubMessagePublic[] };
      if (!payload.ok || !payload.messages) throw new Error('load');
      setMessages((current) => {
        const pending = current.filter((row) => row.pending);
        return [...payload.messages!, ...pending];
      });
      setLoadError(null);
      if (props.viewer === 'owner') void markRead();
    } catch {
      setLoadError(HUB_MESSAGE_LOAD_ERROR);
    }
  };

  useEffect(() => {
    if (props.viewer === 'owner') void markRead();
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refresh();
    };
    const id = window.setInterval(tick, HUB_MESSAGES_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll once per mount
  }, []);

  const grouped = useMemo(() => {
    const days: Array<{ key: string; items: ThreadItem[] }> = [];
    for (const message of messages) {
      const key = hubMessageDayKey(new Date(message.createdAt));
      const last = days[days.length - 1];
      if (last && last.key === key) last.items.push(message);
      else days.push({ key, items: [message] });
    }
    return days;
  }, [messages]);

  const remaining = HUB_MESSAGE_MAX_ATTACHMENTS - attachments.length;
  const canSend = draft.trim().length > 0 && draft.trim().length <= HUB_MESSAGE_MAX_CHARS && !sending;

  const send = async (localId?: string) => {
    const body = draft.trim();
    if (!body || body.length > HUB_MESSAGE_MAX_CHARS) return;
    const attachmentIds = attachments.map((asset) => asset.id);
    const pendingId = localId ?? `pending-${crypto.randomUUID()}`;
    const optimistic: ThreadItem = {
      id: pendingId,
      localId: pendingId,
      author: props.viewer === 'owner' ? 'OWNER' : 'KERSIVO',
      body,
      createdAt: new Date().toISOString(),
      readByOwnerAt: props.viewer === 'owner' ? new Date().toISOString() : null,
      readByOpsAt: props.viewer === 'ops' ? new Date().toISOString() : null,
      attachments: attachments.map((asset) => ({
        ...asset,
      })),
      pending: 'pending',
    };
    if (!localId) {
      setMessages((current) => [...current, optimistic]);
      setDraft('');
      setAttachments([]);
    } else {
      setMessages((current) =>
        current.map((row) => (row.localId === pendingId ? { ...row, pending: 'pending' } : row)),
      );
    }
    setSending(true);
    try {
      const response = await fetch(messagesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, attachmentIds }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: HubMessagePublic; error?: string };
      if (!response.ok || !payload.ok || !payload.message) throw new Error(payload.error || 'send');
      setMessages((current) =>
        current.map((row) => (row.localId === pendingId || row.id === pendingId ? payload.message! : row)),
      );
    } catch {
      setMessages((current) =>
        current.map((row) => (row.localId === pendingId || row.id === pendingId ? { ...row, pending: 'error' } : row)),
      );
    } finally {
      setSending(false);
    }
  };

  const retryPending = (item: ThreadItem) => {
    setDraft(item.body);
    setAttachments(
      item.attachments.map((asset) => ({
        id: asset.id,
        kind: asset.kind as HubUploadedAsset['kind'],
        originalFileName: asset.originalFileName,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        width: null,
        height: null,
        caption: null,
        sortOrder: 0,
        barberId: null,
        uploadedBy: 'OWNER',
        createdAt: item.createdAt,
        hasThumb: asset.hasThumb,
      })),
    );
    setMessages((current) => current.filter((row) => row.id !== item.id));
    window.setTimeout(() => void send(), 0);
  };

  return (
    <section
      className={props.chrome === 'app' ? 'hub-messages hub-messages--app' : 'hub-messages'}
      aria-labelledby={props.chrome === 'app' ? undefined : 'hub-messages-title'}
    >
      {props.chrome === 'app' ? null : (
      <h1 id="hub-messages-title" className="hub-messages__title">
        {props.shopName}
      </h1>
      )}
      <div className="hub-messages__thread" ref={listRef} aria-live="polite">
        {loadError ? (
          <div className="hub-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void refresh()}>
              {HUB_RETRY}
            </button>
          </div>
        ) : null}
        {!messages.length && !loadError ? <p className="hub-messages__empty">{HUB_MESSAGES_EMPTY}</p> : null}
        {grouped.map((day) => (
          <div key={day.key} className="hub-messages__day">
            <p className="hub-messages__day-label">{day.key}</p>
            {day.items.map((message) => {
              const mine = isMine(message, props.viewer);
              const seen = seenLabel(message, props.viewer);
              return (
                <article
                  key={message.id}
                  className={`hub-msg${mine ? ' is-mine' : ''}${message.pending === 'error' ? ' is-error' : ''}`}
                >
                  <header className="hub-msg__meta">
                    <span>{authorLabel(message, props.viewer)}</span>
                    <time dateTime={message.createdAt}>{hubMessageTimeLabel(new Date(message.createdAt))}</time>
                  </header>
                  <HubMessageBody body={message.body} />
                  {message.attachments.length ? (
                    <ul className="hub-msg__files">
                      {message.attachments.map((asset) => {
                        const image = asset.hasThumb || asset.contentType.startsWith('image/');
                        return (
                          <li key={asset.id}>
                            <a
                              href={attachmentHref({
                                viewer: props.viewer,
                                token: props.token,
                                apiBase: props.apiBase,
                                requestId: props.requestId,
                                assetId: asset.id,
                                size: 'full',
                              })}
                              className={image ? 'hub-msg__thumb' : 'hub-msg__chip'}
                            >
                              {image ? (
                                <img
                                  src={attachmentHref({
                                    viewer: props.viewer,
                                    token: props.token,
                                    apiBase: props.apiBase,
                                    requestId: props.requestId,
                                    assetId: asset.id,
                                    size: 'thumb',
                                  })}
                                  alt={asset.originalFileName}
                                />
                              ) : (
                                asset.originalFileName
                              )}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {seen ? <p className="hub-msg__seen">{seen}</p> : null}
                  {message.pending === 'pending' ? <p className="hub-msg__status">{HUB_MESSAGE_SENDING}</p> : null}
                  {message.pending === 'error' ? (
                    <div className="hub-error">
                      <p>{HUB_MESSAGE_FAILED}</p>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => retryPending(message)}>
                        {HUB_RETRY}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ))}
        {!grouped.length && messages.length ? <p className="hub-card__body">{HUB_ACTIVITY_EMPTY}</p> : null}
      </div>

      <form
        className="hub-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="hub-sr-only" htmlFor="hub-composer-body">
          {HUB_MESSAGE_PLACEHOLDER}
        </label>
        <textarea
          id="hub-composer-body"
          ref={composerRef}
          data-testid="hub-message-body"
          className="hub-composer__input"
          rows={3}
          maxLength={HUB_MESSAGE_MAX_CHARS}
          placeholder={HUB_MESSAGE_PLACEHOLDER}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="hub-composer__row">
          {props.canAttach !== false ? (
            <HubUploader
              token={props.token}
              apiBase={props.apiBase}
              kind="MESSAGE_ATTACHMENT"
              compact
              remaining={remaining}
              onUploaded={(asset) => {
                setAttachments((current) =>
                  current.length >= HUB_MESSAGE_MAX_ATTACHMENTS ? current : [...current, asset],
                );
              }}
            />
          ) : null}
          <p className="hub-composer__count">{HUB_MESSAGE_CHAR_COUNT(draft.length, HUB_MESSAGE_MAX_CHARS)}</p>
          <button type="submit" className="btn btn--primary" data-testid="hub-send-message" disabled={!canSend}>
            {sending ? HUB_MESSAGE_SENDING : HUB_SEND}
          </button>
        </div>
        <p className="hub-composer__hint">{HUB_MESSAGE_HINT}</p>
        {attachments.length ? (
          <ul className="hub-composer__files">
            {attachments.map((asset) => (
              <li key={asset.id}>
                <span>{asset.originalFileName}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setAttachments((current) => current.filter((row) => row.id !== asset.id))}
                >
                  {HUB_DELETE}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
    </section>
  );
}
