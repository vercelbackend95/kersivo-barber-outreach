import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, MessageCircle, Phone, Plus, Tag, X } from '../lucide-react';
import { openClientMessageChannel } from '../../lib/admin/clientMessaging';
import { adminFetchJson } from './adminAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientData = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  tags: string[];
};

type StatsData = {
  totalBookings: number;
  completedCount: number;
  noShowCount: number;
  lastVisitAt: string | null;
  totalSpentPence: number;
  avgSpendPence: number;
  favouriteService: string | null;
};

type ProfileData = {
  client: ClientData;
  stats: StatsData;
  reliabilityScore: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getScoreLabel(score: number): string {
  if (score >= 75) return 'Excellent';
  if (score >= 55) return 'Good';
  if (score >= 35) return 'Fair';
  return 'Poor';
}

function getScoreColorClass(score: number): string {
  if (score >= 75) return 'admin-cp-score-bar--green';
  if (score >= 45) return 'admin-cp-score-bar--amber';
  return 'admin-cp-score-bar--red';
}

async function fetchClientProfile(clientId: string): Promise<ProfileData> {
  return adminFetchJson<ProfileData>(`/api/admin/clients/${clientId}`, {
    errorMessage: 'Could not load client data.',
  });
}

// ─── Notes textarea with debounced save ───────────────────────────────────────

function NotesEditor({ clientId, initialNotes }: { clientId: string; initialNotes: string | null }) {
  const [value, setValue] = useState(initialNotes ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [saveError, setSaveError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const syncNotesHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setValue(next);
      setSaveState('idle');
      setSaveError('');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          await adminFetchJson(`/api/admin/clients/${clientId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: next }),
            errorMessage: 'Could not save notes.',
          });
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
        } catch (error) {
          setSaveState('failed');
          setSaveError(error instanceof Error ? error.message : 'Could not save notes.');
        }
      }, 500);
    },
    [clientId],
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    setValue(initialNotes ?? '');
  }, [initialNotes]);

  useEffect(() => {
    syncNotesHeight();
  }, [value, initialNotes, syncNotesHeight]);

  return (
    <div className="admin-cp-notes-wrap">
      <div className="admin-cp-section-header">
        <span className="admin-cp-section-title">Notes</span>
        {saveState === 'saving' && <span className="admin-cp-save-hint admin-cp-save-hint--saving">Saving…</span>}
        {saveState === 'saved' && <span className="admin-cp-save-hint admin-cp-save-hint--saved">Saved</span>}
        {saveState === 'failed' && <span className="admin-cp-save-hint admin-cp-save-hint--failed">Failed</span>}
      </div>
      {saveError ? <p className="admin-cp-error admin-cp-error--inline" role="alert">{saveError}</p> : null}
      <textarea
        ref={textareaRef}
        className="admin-cp-notes-textarea"
        value={value}
        onChange={handleChange}
        placeholder="Add notes about this client…"
        rows={3}
      />
    </div>
  );
}

// ─── Tags editor ─────────────────────────────────────────────────────────────

function TagsEditor({ clientId, initialTags }: { clientId: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');
  const [saveError, setSaveError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const saveTags = useCallback(async (next: string[], previous: string[]) => {
    setSaveError('');
    try {
      await adminFetchJson(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: next }),
        errorMessage: 'Could not save tags.',
      });
    } catch (error) {
      setTags(previous);
      setSaveError(error instanceof Error ? error.message : 'Could not save tags.');
    }
  }, [clientId]);

  const addTag = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) { setInput(''); return; }
    const previous = tags;
    const next = [...tags, trimmed];
    setTags(next);
    setInput('');
    void saveTags(next, previous);
  }, [input, tags, saveTags]);

  const removeTag = useCallback((tag: string) => {
    const previous = tags;
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    void saveTags(next, previous);
  }, [tags, saveTags]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }, [addTag, input, tags, removeTag]);

  return (
    <div className="admin-cp-tags-wrap">
      <div className="admin-cp-section-header">
        <Tag className="admin-cp-section-icon" aria-hidden />
        <span className="admin-cp-section-title">Tags</span>
      </div>
      {saveError ? <p className="admin-cp-error admin-cp-error--inline" role="alert">{saveError}</p> : null}
      <div className="admin-cp-tags-row">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="admin-cp-tag"
            onClick={() => removeTag(tag)}
            title={`Remove "${tag}"`}
          >
            {tag}
            <X className="admin-cp-tag-remove-icon" aria-hidden />
          </button>
        ))}
        <div className="admin-cp-tag-add-wrap">
          <input
            ref={inputRef}
            type="text"
            className="admin-cp-tag-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add tag…"
            aria-label="Add tag"
          />
          {input.trim() && (
            <button type="button" className="admin-cp-tag-add-btn" onClick={addTag} aria-label="Confirm tag">
              <Plus className="admin-cp-tag-add-icon" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Message client ───────────────────────────────────────────────────────────

function ClientMessageActions({
  phone,
  fullName,
}: {
  phone: string | null;
  fullName: string | null;
}) {
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [messageError, setMessageError] = useState('');

  const displayName = fullName ?? 'Client';

  if (!phone?.trim()) {
    return (
      <p className="admin-cp-message-unavailable">No phone number on file — messaging unavailable.</p>
    );
  }

  const handleChannel = (channel: 'sms' | 'whatsapp') => {
    setMessageError('');
    const result = openClientMessageChannel({
      phone,
      fullName: displayName,
      channel,
    });
    if (!result.ok) {
      setMessageError(result.error);
      return;
    }
    setIsChooserOpen(false);
  };

  return (
    <div className="admin-cp-message-wrap">
      <button
        type="button"
        className="admin-cp-message-btn"
        onClick={() => {
          setMessageError('');
          setIsChooserOpen((open) => !open);
        }}
        aria-expanded={isChooserOpen}
      >
        <MessageCircle className="admin-cp-contact-icon" aria-hidden />
        Message client
      </button>
      {isChooserOpen ? (
        <div className="admin-cp-message-chooser">
          <p className="admin-cp-message-chooser-copy">Choose contact channel for {displayName}.</p>
          {messageError ? <p className="admin-cp-message-chooser-error" role="alert">{messageError}</p> : null}
          <button
            type="button"
            className="admin-cp-message-channel admin-cp-message-channel--sms"
            onClick={() => handleChannel('sms')}
          >
            <span className="admin-cp-message-channel-label">SMS</span>
            <span className="admin-cp-message-channel-reason">Open your default text messaging app.</span>
          </button>
          <button
            type="button"
            className="admin-cp-message-channel admin-cp-message-channel--whatsapp"
            onClick={() => handleChannel('whatsapp')}
          >
            <span className="admin-cp-message-channel-label">WhatsApp</span>
            <span className="admin-cp-message-channel-reason">Open WhatsApp chat with prefilled message.</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export type ClientProfilePanelProps = {
  clientId: string;
  onClose: () => void;
};

const ClientProfilePanel = memo(function ClientProfilePanel({ clientId, onClose }: ClientProfilePanelProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setData(null);
    setError('');
    try {
      const profile = await fetchClientProfile(clientId);
      setData(profile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load client data.');
    }
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    fetchClientProfile(clientId)
      .then((json) => { if (!cancelled) setData(json); })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load client data.');
        }
      });
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const initials = data ? getInitials(data.client.fullName) : '…';
  const score = data?.reliabilityScore ?? 0;

  const panel = (
    <div
      className="admin-cp-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-client-profile-title"
    >
      <div className="admin-cp-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-cp-header">
          <span id="admin-client-profile-title" className="admin-cp-header-title">Client profile</span>
          <button type="button" className="admin-cp-close-btn" onClick={onClose} aria-label="Close">
            <X className="admin-cp-close-icon" aria-hidden />
          </button>
        </div>

        {error && (
          <div className="admin-cp-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--secondary" onClick={() => { void loadProfile(); }}>
              Retry
            </button>
          </div>
        )}

        {!data && !error && (
          <div className="admin-cp-skeleton-wrap">
            <div className="admin-cp-skeleton admin-cp-skeleton--avatar" />
            <div className="admin-cp-skeleton admin-cp-skeleton--line" />
            <div className="admin-cp-skeleton admin-cp-skeleton--line admin-cp-skeleton--short" />
            <div className="admin-cp-skeleton admin-cp-skeleton--bar" />
            <div className="admin-cp-skeleton admin-cp-skeleton--grid" />
          </div>
        )}

        {data && (
          <div className="admin-cp-body">
            {/* Identity */}
            <div className="admin-cp-identity">
              <div className="admin-cp-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="admin-cp-identity-info">
                <p className="admin-cp-full-name">{data.client.fullName ?? data.client.email}</p>
                {data.client.phone && (
                  <a className="admin-cp-contact-row" href={`tel:${data.client.phone}`}>
                    <Phone className="admin-cp-contact-icon" aria-hidden />
                    {data.client.phone}
                  </a>
                )}
                <a className="admin-cp-contact-row" href={`mailto:${data.client.email}`}>
                  <Mail className="admin-cp-contact-icon" aria-hidden />
                  {data.client.email}
                </a>
                <ClientMessageActions
                  phone={data.client.phone}
                  fullName={data.client.fullName}
                />
              </div>
            </div>

            {/* Tags */}
            <TagsEditor clientId={clientId} initialTags={data.client.tags} />

            {/* Reliability score */}
            <div className="admin-cp-score-section">
              <div className="admin-cp-section-header">
                <span className="admin-cp-section-title">Reliability score</span>
                <span className="admin-cp-score-value">{score} / 100 — {getScoreLabel(score)}</span>
              </div>
              <div className="admin-cp-score-track" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`admin-cp-score-bar ${getScoreColorClass(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="admin-cp-stats-section">
              <div className="admin-cp-section-header">
                <span className="admin-cp-section-title">Stats</span>
              </div>
              <dl className="admin-cp-stats-grid">
                <div className="admin-cp-stat">
                  <dt>Total bookings</dt>
                  <dd>{data.stats.totalBookings}</dd>
                </div>
                <div className="admin-cp-stat">
                  <dt>Completed</dt>
                  <dd>{data.stats.completedCount}</dd>
                </div>
                <div className="admin-cp-stat">
                  <dt>No-shows</dt>
                  <dd className={data.stats.noShowCount > 0 ? 'admin-cp-stat-danger' : ''}>{data.stats.noShowCount}</dd>
                </div>
                <div className="admin-cp-stat">
                  <dt>Last visit</dt>
                  <dd>{formatDate(data.stats.lastVisitAt)}</dd>
                </div>
                <div className="admin-cp-stat">
                  <dt>Total spent</dt>
                  <dd>{data.stats.totalSpentPence > 0 ? formatPence(data.stats.totalSpentPence) : '—'}</dd>
                </div>
                <div className="admin-cp-stat">
                  <dt>Avg per visit</dt>
                  <dd>{data.stats.avgSpendPence > 0 ? formatPence(data.stats.avgSpendPence) : '—'}</dd>
                </div>
                {data.stats.favouriteService && (
                  <div className="admin-cp-stat admin-cp-stat--full">
                    <dt>Favourite service</dt>
                    <dd>{data.stats.favouriteService}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Notes */}
            <NotesEditor clientId={clientId} initialNotes={data.client.notes} />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
});

export default ClientProfilePanel;
