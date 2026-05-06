import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Phone, Plus, Tag, X } from '../lucide-react';

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

// ─── Notes textarea with debounced save ───────────────────────────────────────

function NotesEditor({ clientId, initialNotes }: { clientId: string; initialNotes: string | null }) {
  const [value, setValue] = useState(initialNotes ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setValue(next);
      setSaveState('idle');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          await fetch(`/api/admin/clients/${clientId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: next }),
          });
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
        } catch {
          setSaveState('idle');
        }
      }, 500);
    },
    [clientId],
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="admin-cp-notes-wrap">
      <div className="admin-cp-section-header">
        <span className="admin-cp-section-title">Notes</span>
        {saveState === 'saving' && <span className="admin-cp-save-hint admin-cp-save-hint--saving">Saving…</span>}
        {saveState === 'saved' && <span className="admin-cp-save-hint admin-cp-save-hint--saved">Saved</span>}
      </div>
      <textarea
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
  const inputRef = useRef<HTMLInputElement>(null);

  const saveTags = useCallback(async (next: string[]) => {
    try {
      await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: next }),
      });
    } catch {
      // silent — optimistic update stays
    }
  }, [clientId]);

  const addTag = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) { setInput(''); return; }
    const next = [...tags, trimmed];
    setTags(next);
    setInput('');
    void saveTags(next);
  }, [input, tags, saveTags]);

  const removeTag = useCallback((tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    void saveTags(next);
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

// ─── Main panel ───────────────────────────────────────────────────────────────

export type ClientProfilePanelProps = {
  clientId: string;
  onClose: () => void;
};

const ClientProfilePanel = memo(function ClientProfilePanel({ clientId, onClose }: ClientProfilePanelProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    fetch(`/api/admin/clients/${clientId}`)
      .then((r) => r.json())
      .then((json: ProfileData) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [clientId]);

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
      aria-label="Client profile"
    >
      <div className="admin-cp-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-cp-header">
          <span className="admin-cp-header-title">Client profile</span>
          <button type="button" className="admin-cp-close-btn" onClick={onClose} aria-label="Close">
            <X className="admin-cp-close-icon" aria-hidden />
          </button>
        </div>

        {error && (
          <p className="admin-cp-error">Could not load client data.</p>
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
