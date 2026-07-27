import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Check, Clock, Crown, ImagePlus, Mail, MessageCircle, Phone, Pin, Plus, Shield, StickyNote, Tag, X } from '../lucide-react';
import { openClientMessageChannel } from '../../lib/admin/clientMessaging';
import { adminFetchJson } from './adminAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientData = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  avatarUrl?: string | null;
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

type RetailStatsData = {
  productsBought: number;
  avgSpendPence: number;
};

type LastOrderItem = {
  nameSnapshot: string;
  quantity: number;
};

type LastOrderData = {
  id: string;
  status: string;
  totalPence: number;
  paidAt: string | null;
  createdAt: string;
  items: LastOrderItem[];
};

type ProfileData = {
  client: ClientData;
  stats: StatsData;
  reliabilityScore: number;
  retailStats: RetailStatsData;
  lastOrder: LastOrderData | null;
  financialsHidden?: boolean;
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

function formatOrderStatus(status: string): string {
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  if (status === 'PAID') return 'Paid';
  if (status === 'COLLECTED') return 'Collected';
  return status;
}

function getScoreLabel(score: number): string {
  if (score >= 75) return 'Excellent';
  if (score >= 55) return 'Good';
  if (score >= 35) return 'Fair';
  return 'Poor';
}

type ScoreTier = 'excellent' | 'good' | 'fair' | 'poor';

function getScoreTier(score: number): ScoreTier {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'good';
  if (score >= 35) return 'fair';
  return 'poor';
}

function ScoreTierIcon({ tier }: { tier: ScoreTier }) {
  const className = `admin-cp-score-tier-icon admin-cp-score-tier-icon--${tier}`;
  if (tier === 'excellent') return <Crown className={className} aria-hidden />;
  if (tier === 'good') return <Check className={className} aria-hidden />;
  if (tier === 'fair') return <Clock className={className} aria-hidden />;
  return <Ban className={className} aria-hidden />;
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

// ─── Client avatar upload ─────────────────────────────────────────────────────

function ClientAvatarUpload({
  clientId,
  fullName,
  avatarUrl,
  onAvatarChange,
}: {
  clientId: string;
  fullName: string | null;
  avatarUrl: string | null | undefined;
  onAvatarChange: (nextUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const displayedUrl = previewUrl ?? avatarUrl ?? null;
  const initials = getInitials(fullName);

  const openPicker = useCallback(() => {
    if (uploading) return;
    inputRef.current?.click();
  }, [uploading]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError('');
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await adminFetchJson<{ client: { avatarUrl?: string | null } }>(
        `/api/admin/clients/${clientId}`,
        {
          method: 'PATCH',
          body: formData,
          errorMessage: 'Could not upload photo.',
        },
      );

      const nextUrl = response.client.avatarUrl ?? objectUrl;
      onAvatarChange(nextUrl);
      if (response.client.avatarUrl) {
        setPreviewUrl(null);
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
      setUploadError(error instanceof Error ? error.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  }, [clientId, onAvatarChange]);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  return (
    <div className="admin-cp-avatar-wrap">
      <div className="admin-cp-avatar" aria-hidden="true">
        {displayedUrl ? (
          <img src={displayedUrl} alt="" className="admin-cp-avatar-img" loading="lazy" />
        ) : (
          <span className="admin-cp-avatar-initials">{initials}</span>
        )}
      </div>
      <button
        type="button"
        className="admin-cp-avatar-overlay-action"
        onClick={openPicker}
        disabled={uploading}
        aria-label={displayedUrl ? 'Change client photo' : 'Add client photo'}
        title={displayedUrl ? 'Change photo' : 'Add photo'}
        aria-busy={uploading}
      >
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M6 7.5A2.5 2.5 0 0 1 8.5 5h1.2a2 2 0 0 0 1.6-.8l.3-.4A2 2 0 0 1 13.2 3h1.3A2.5 2.5 0 0 1 17 5.5V6h.8A2.2 2.2 0 0 1 20 8.2v8.6a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 16.8V8.2A2.2 2.2 0 0 1 6.2 6H6v1.5Zm6 9.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-1.8a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
          </svg>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="admin-cp-avatar-input"
        onChange={(event) => { void handleFileChange(event); }}
        tabIndex={-1}
        aria-hidden="true"
      />
      {uploadError ? <p className="admin-cp-error admin-cp-error--inline admin-cp-avatar-error" role="alert">{uploadError}</p> : null}
    </div>
  );
}

// ─── Client notes feed ────────────────────────────────────────────────────────

type BarberOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type ClientNoteImage = {
  id: string;
  url: string;
};

type ClientNotePost = {
  id: string;
  body: string;
  isInternal?: boolean;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  images: ClientNoteImage[];
  barber: BarberOption | null;
};

const MAX_NOTE_IMAGES = 3;

type PendingNoteImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function createPendingNoteImage(file: File): PendingNoteImage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

function sortNotesChronologically(notes: ClientNotePost[]): ClientNotePost[] {
  return [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function sortNotesForFeed(notes: ClientNotePost[]): ClientNotePost[] {
  const chronological = sortNotesChronologically(notes);
  if (chronological.length === 0) return chronological;

  const top = chronological.reduce((best, note) => {
    if (note.likeCount > best.likeCount) return note;
    if (note.likeCount === best.likeCount && note.likeCount > 0) {
      return new Date(note.createdAt) > new Date(best.createdAt) ? note : best;
    }
    return best;
  });

  if (top.likeCount === 0) return chronological;
  return [top, ...chronological.filter((note) => note.id !== top.id)];
}

function formatNoteTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function NotePostAvatar({ barber }: { barber: BarberOption | null }) {
  const [hasImageError, setHasImageError] = useState(false);
  const name = barber?.name ?? 'Previous note';
  const initials = barber ? getInitials(barber.name) : '—';

  useEffect(() => {
    setHasImageError(false);
  }, [barber?.id, barber?.avatarUrl]);

  return (
    <div className="admin-cp-note-post-avatar" aria-hidden="true">
      {barber?.avatarUrl && !hasImageError ? (
        <img
          src={barber.avatarUrl}
          alt=""
          className="admin-cp-note-post-avatar-img"
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className="admin-cp-note-post-avatar-initials">{initials}</span>
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}

function NoteImageLightbox({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lightbox = (
    <div
      className="admin-cp-note-lightbox-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Note image preview"
    >
      <div className="admin-cp-note-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="admin-cp-note-lightbox-close"
          onClick={onClose}
          aria-label="Close image preview"
        >
          <X className="admin-cp-note-lightbox-close-icon" aria-hidden />
        </button>
        <img src={imageUrl} alt="" className="admin-cp-note-lightbox-img" />
      </div>
    </div>
  );

  return createPortal(lightbox, document.body);
}

function NotePost({
  note,
  onLike,
  liking,
  isFeedPinned,
  onImageOpen,
}: {
  note: ClientNotePost;
  onLike: (noteId: string) => void;
  liking: boolean;
  isFeedPinned: boolean;
  onImageOpen: (url: string) => void;
}) {
  const authorName = note.barber?.name ?? 'Previous note';
  const [burstCount, setBurstCount] = useState<number | null>(null);
  const [pinStick, setPinStick] = useState(false);
  const burstKeyRef = useRef(0);

  const handlePin = useCallback(() => {
    if (liking) return;
    const nextCount = note.likedByMe ? note.likeCount - 1 : note.likeCount + 1;
    burstKeyRef.current += 1;
    setBurstCount(nextCount);
    setPinStick(true);
    window.setTimeout(() => {
      setBurstCount(null);
      setPinStick(false);
    }, 600);
    onLike(note.id);
  }, [liking, note.id, note.likeCount, note.likedByMe, onLike]);

  const pinButtonClassName = [
    'admin-cp-note-post-pin',
    note.likedByMe ? 'is-pinned-by-me' : '',
    isFeedPinned ? 'is-feed-pinned' : '',
    pinStick ? 'admin-cp-note-pin-stick' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={`admin-cp-note-post${isFeedPinned ? ' admin-cp-note-post--feed-pinned' : ''}`}>
      <button
        type="button"
        className={pinButtonClassName}
        onClick={handlePin}
        disabled={liking}
        aria-label={note.likedByMe ? 'Unpin note' : 'Pin note'}
        aria-pressed={note.likedByMe}
      >
        <Pin className="admin-cp-note-post-pin-icon" aria-hidden />
        {burstCount !== null && burstCount > 0 ? (
          <span key={burstKeyRef.current} className="admin-cp-note-pin-burst">{burstCount}</span>
        ) : null}
      </button>
      <header className="admin-cp-note-post-header">
        <NotePostAvatar barber={note.barber} />
        <div className="admin-cp-note-post-meta">
          <div className="admin-cp-note-post-meta-row">
            <span className="admin-cp-note-post-author">{authorName}</span>
            {note.isInternal ? (
              <span className="admin-cp-note-post-pinned-badge">Internal</span>
            ) : null}
            {isFeedPinned ? (
              <span className="admin-cp-note-post-pinned-badge">
                <Pin className="admin-cp-note-post-pinned-badge-icon" aria-hidden />
                Pinned
              </span>
            ) : null}
          </div>
          <time className="admin-cp-note-post-time" dateTime={note.createdAt}>
            {formatNoteTime(note.createdAt)}
          </time>
        </div>
      </header>
      {note.body ? <p className="admin-cp-note-post-body">{note.body}</p> : null}
      {note.images.length > 0 ? (
        <div
          className={`admin-cp-note-post-images admin-cp-note-post-images--count-${Math.min(note.images.length, MAX_NOTE_IMAGES)}`}
        >
          {note.images.map((image) => (
            <button
              key={image.id}
              type="button"
              className="admin-cp-note-post-image-btn"
              onClick={() => onImageOpen(image.url)}
              aria-label="View note image"
            >
              <img src={image.url} alt="" className="admin-cp-note-post-image" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function NotesEditor({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<ClientNotePost[]>([]);
  const [draft, setDraft] = useState('');
  const [markInternal, setMarkInternal] = useState(false);
  const [canMarkInternal, setCanMarkInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [postState, setPostState] = useState<'idle' | 'posting' | 'posted' | 'failed'>('idle');
  const [postError, setPostError] = useState('');
  const [likingNoteId, setLikingNoteId] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingNoteImage[]>([]);
  const [attachError, setAttachError] = useState('');
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;

  const clearPendingImages = useCallback(() => {
    setPendingImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);

  useEffect(() => () => {
    pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    setAttachError('');
    setPostError('');
    setPendingImages((current) => {
      const remaining = MAX_NOTE_IMAGES - current.length;
      if (remaining <= 0) {
        setAttachError(`You can attach up to ${MAX_NOTE_IMAGES} images per note.`);
        return current;
      }

      const next = [...current];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_NOTE_IMAGES) break;
        if (!file.type.startsWith('image/')) continue;
        next.push(createPendingNoteImage(file));
      }

      if (next.length === current.length) {
        setAttachError('Please choose a valid image file.');
      }

      return next;
    });
  }, []);

  const removePendingImage = useCallback((imageId: string) => {
    setAttachError('');
    setPendingImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.id !== imageId);
    });
  }, []);

  const syncComposeHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setMarkInternal(false);

    adminFetchJson<{ notes: ClientNotePost[]; canMarkInternal?: boolean }>(`/api/admin/clients/${clientId}/notes`, {
      errorMessage: 'Could not load notes.',
    })
      .then((notesResponse) => {
        if (!cancelled) {
          setNotes(notesResponse.notes);
          setCanMarkInternal(Boolean(notesResponse.canMarkInternal));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load notes.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    syncComposeHeight();
  }, [draft, syncComposeHeight]);

  const handlePost = useCallback(async () => {
    const body = draft.trim();
    if (!body && pendingImages.length === 0) return;

    setPostState('posting');
    setPostError('');
    setAttachError('');
    try {
      let response: { note: ClientNotePost };

      if (pendingImages.length > 0) {
        const formData = new FormData();
        formData.append('body', body);
        if (canMarkInternal && markInternal) formData.append('isInternal', 'true');
        pendingImages.forEach((image) => {
          formData.append('images', image.file);
        });

        response = await adminFetchJson<{ note: ClientNotePost }>(
          `/api/admin/clients/${clientId}/notes`,
          {
            method: 'POST',
            body: formData,
            errorMessage: 'Could not post note.',
          },
        );
      } else {
        response = await adminFetchJson<{ note: ClientNotePost }>(
          `/api/admin/clients/${clientId}/notes`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body, isInternal: canMarkInternal && markInternal }),
            errorMessage: 'Could not post note.',
          },
        );
      }

      setNotes((current) => [...current, response.note]);
      setDraft('');
      setMarkInternal(false);
      clearPendingImages();
      setPostState('posted');
      setTimeout(() => setPostState('idle'), 2000);
    } catch (error) {
      setPostState('failed');
      setPostError(error instanceof Error ? error.message : 'Could not post note.');
    }
  }, [canMarkInternal, clientId, clearPendingImages, draft, markInternal, pendingImages]);

  const handleLike = useCallback(async (noteId: string) => {
    let previousNote: ClientNotePost | undefined;
    setNotes((current) => {
      const note = current.find((item) => item.id === noteId);
      if (!note) return current;
      previousNote = note;
      const likedByMe = !note.likedByMe;
      const likeCount = Math.max(0, note.likeCount + (likedByMe ? 1 : -1));
      return current.map((item) => (
        item.id === noteId ? { ...item, likedByMe, likeCount } : item
      ));
    });

    setLikingNoteId(noteId);
    try {
      const result = await adminFetchJson<{ likeCount: number; likedByMe: boolean }>(
        `/api/admin/clients/${clientId}/notes/${noteId}/like`,
        {
          method: 'POST',
          errorMessage: 'Could not update like.',
        },
      );
      setNotes((current) => current.map((item) => (
        item.id === noteId
          ? { ...item, likeCount: result.likeCount, likedByMe: result.likedByMe }
          : item
      )));
    } catch {
      if (previousNote) {
        setNotes((current) => current.map((item) => (
          item.id === noteId ? previousNote! : item
        )));
      }
    } finally {
      setLikingNoteId(null);
    }
  }, [clientId]);

  const canPost = (draft.trim().length > 0 || pendingImages.length > 0) && postState !== 'posting';
  const sortedNotes = useMemo(() => sortNotesForFeed(notes), [notes]);
  const feedPinnedNoteId = sortedNotes[0]?.likeCount > 0 ? sortedNotes[0].id : null;
  const canAttachMore = pendingImages.length < MAX_NOTE_IMAGES;

  return (
    <div className="admin-cp-notes-wrap">
      <div className="admin-cp-section-header">
        <StickyNote className="admin-cp-section-icon" aria-hidden />
        <span className="admin-cp-section-title">Notes</span>
        {postState === 'posting' && <span className="admin-cp-save-hint admin-cp-save-hint--saving">Posting…</span>}
        {postState === 'posted' && <span className="admin-cp-save-hint admin-cp-save-hint--saved">Posted</span>}
        {postState === 'failed' && <span className="admin-cp-save-hint admin-cp-save-hint--failed">Failed</span>}
      </div>

      {loadError ? <p className="admin-cp-error admin-cp-error--inline" role="alert">{loadError}</p> : null}
      {postError ? <p className="admin-cp-error admin-cp-error--inline" role="alert">{postError}</p> : null}
      {attachError ? <p className="admin-cp-error admin-cp-error--inline" role="alert">{attachError}</p> : null}

      {loading ? (
        <div className="admin-cp-notes-feed admin-cp-notes-feed--loading" aria-busy="true">
          <div className="admin-cp-skeleton admin-cp-skeleton--line" />
          <div className="admin-cp-skeleton admin-cp-skeleton--line admin-cp-skeleton--short" />
        </div>
      ) : (
        <div className="admin-cp-notes-feed">
          {sortedNotes.length === 0 ? (
            <p className="admin-cp-notes-empty">No notes yet</p>
          ) : (
            sortedNotes.map((note) => (
              <NotePost
                key={note.id}
                note={note}
                onLike={(noteId) => { void handleLike(noteId); }}
                liking={likingNoteId === note.id}
                isFeedPinned={note.id === feedPinnedNoteId}
                onImageOpen={setLightboxImageUrl}
              />
            ))
          )}
        </div>
      )}

      {lightboxImageUrl ? (
        <NoteImageLightbox
          imageUrl={lightboxImageUrl}
          onClose={() => setLightboxImageUrl(null)}
        />
      ) : null}

      <div className="admin-cp-note-compose">
        <textarea
          ref={textareaRef}
          className="admin-cp-notes-textarea"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (postState === 'failed') setPostState('idle');
            setPostError('');
          }}
          placeholder="Add a note about this client…"
          rows={2}
          disabled={postState === 'posting'}
        />

        {canMarkInternal ? (
          <label className="admin-cp-note-compose-internal">
            <input
              type="checkbox"
              checked={markInternal}
              onChange={(e) => setMarkInternal(e.target.checked)}
              disabled={postState === 'posting'}
            />
            <span>Internal (managers only)</span>
          </label>
        ) : null}

        <div className="admin-cp-note-compose-actions">
          <button
            type="button"
            className="btn btn--secondary admin-cp-note-compose-attach-btn"
            onClick={() => attachInputRef.current?.click()}
            disabled={postState === 'posting' || !canAttachMore}
            aria-label="Add photos"
          >
            <ImagePlus className="admin-cp-note-compose-attach-icon" aria-hidden />
            <span>Add photos</span>
          </button>
          {pendingImages.length > 0 ? (
            <span className="admin-cp-note-compose-count">{pendingImages.length}/{MAX_NOTE_IMAGES}</span>
          ) : null}
        </div>

        <input
          ref={attachInputRef}
          type="file"
          accept="image/*"
          multiple
          className="admin-cp-note-compose-file-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            handleFilesSelected(event.target.files);
            event.target.value = '';
          }}
        />

        {pendingImages.length > 0 ? (
          <div className="admin-cp-note-compose-previews">
            {pendingImages.map((image) => (
              <div key={image.id} className="admin-cp-note-compose-preview">
                <img src={image.previewUrl} alt="" className="admin-cp-note-compose-preview-img" />
                <button
                  type="button"
                  className="admin-cp-note-compose-preview-remove"
                  onClick={() => removePendingImage(image.id)}
                  disabled={postState === 'posting'}
                  aria-label="Remove image"
                >
                  <X className="admin-cp-note-compose-preview-remove-icon" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn--primary admin-cp-note-submit"
          onClick={() => { void handlePost(); }}
          disabled={!canPost}
        >
          {postState === 'posting' ? 'Posting…' : 'Add note'}
        </button>
      </div>
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
  /** When false, tags are read-only. Defaults from session (Barber = false). */
  canEditTags?: boolean;
};

const ClientProfilePanel = memo(function ClientProfilePanel({
  clientId,
  onClose,
  canEditTags: canEditTagsProp,
}: ClientProfilePanelProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [canEditTags, setCanEditTags] = useState(canEditTagsProp ?? true);

  useEffect(() => {
    if (typeof canEditTagsProp === 'boolean') {
      setCanEditTags(canEditTagsProp);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { role?: string; permissions?: string[] };
        if (cancelled) return;
        // Barber: notes/photos only — no tag edits (blocking).
        setCanEditTags(payload.role !== 'BARBER');
      } catch {
        // keep default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditTagsProp]);

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

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const score = data?.reliabilityScore ?? 0;
  const scoreTier = getScoreTier(score);

  const handleAvatarChange = useCallback((avatarUrl: string) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        client: {
          ...current.client,
          avatarUrl,
        },
      };
    });
  }, []);

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
              <ClientAvatarUpload
                clientId={clientId}
                fullName={data.client.fullName}
                avatarUrl={data.client.avatarUrl}
                onAvatarChange={handleAvatarChange}
              />
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
            {canEditTags ? (
              <TagsEditor clientId={clientId} initialTags={data.client.tags} />
            ) : data.client.tags.length > 0 ? (
              <div className="admin-cp-tags-wrap" aria-label="Client tags">
                <div className="admin-cp-tags-row">
                  {data.client.tags.map((tag) => (
                    <span key={tag} className="admin-cp-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Reliability score */}
            <div className="admin-cp-score-section">
              <div className="admin-cp-section-header">
                <Shield className="admin-cp-section-icon" aria-hidden />
                <span className="admin-cp-section-title">Reliability score</span>
                <span className={`admin-cp-score-value admin-cp-score-value--${scoreTier}`}>
                  <ScoreTierIcon tier={scoreTier} />
                  {score} / 100 — {getScoreLabel(score)}
                </span>
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
                {!data.financialsHidden ? (
                  <>
                    <div className="admin-cp-stat">
                      <dt>Total spent</dt>
                      <dd>{data.stats.totalSpentPence > 0 ? formatPence(data.stats.totalSpentPence) : '—'}</dd>
                    </div>
                    <div className="admin-cp-stat">
                      <dt>Avg per visit</dt>
                      <dd>{data.stats.avgSpendPence > 0 ? formatPence(data.stats.avgSpendPence) : '—'}</dd>
                    </div>
                  </>
                ) : null}
                {data.stats.favouriteService && (
                  <div className="admin-cp-stat admin-cp-stat--full">
                    <dt>Favourite service</dt>
                    <dd>{data.stats.favouriteService}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Retail */}
            {!data.financialsHidden ? (
            <div className="admin-cp-stats-section">
              <div className="admin-cp-section-header">
                <span className="admin-cp-section-title">Retail</span>
              </div>
              <dl className="admin-cp-stats-grid">
                <div className="admin-cp-stat">
                  <dt>Products bought</dt>
                  <dd>{data.retailStats.productsBought > 0 ? data.retailStats.productsBought : '—'}</dd>
                </div>
                <div className="admin-cp-stat">
                  <dt>Avg retail spend</dt>
                  <dd>{data.retailStats.avgSpendPence > 0 ? formatPence(data.retailStats.avgSpendPence) : '—'}</dd>
                </div>
              </dl>
              {data.lastOrder ? (
                <div className="admin-cp-last-order">
                  <div className="admin-cp-last-order-header">
                    <span className="admin-cp-last-order-label">Last order</span>
                    <span className="admin-cp-last-order-meta">
                      {formatDate(data.lastOrder.paidAt ?? data.lastOrder.createdAt)}
                      {' · '}
                      {formatOrderStatus(data.lastOrder.status)}
                      {' · '}
                      {formatPence(data.lastOrder.totalPence)}
                    </span>
                  </div>
                  <ul className="admin-cp-last-order-items">
                    {data.lastOrder.items.map((item, index) => (
                      <li key={`${data.lastOrder!.id}-${item.nameSnapshot}-${index}`}>
                        {item.nameSnapshot}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="admin-cp-last-order-empty">No retail orders yet.</p>
              )}
            </div>
            ) : null}

            {/* Notes */}
            <NotesEditor clientId={clientId} />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
});

export default ClientProfilePanel;
