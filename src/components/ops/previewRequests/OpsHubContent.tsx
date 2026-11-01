import { useState } from 'react';
import {
  HUB_DETAILS_HOURS_TITLE,
  HUB_DETAILS_SERVICES_TITLE,
  HUB_DETAILS_TEAM_TITLE,
  HUB_OPS_APPLY,
  HUB_OPS_APPLIED,
  HUB_OPS_APPLY_FAILED,
  HUB_OPS_DISMISS,
  HUB_OPS_DISMISS_NOTE,
  HUB_OPS_DISMISSED,
  HUB_OPS_MANUAL_WEBSITE_UPDATE,
  HUB_OPS_REVIEW_HISTORICAL,
  HUB_OPS_WEBSITE_REMINDER,
  HUB_RETRY,
  HUB_REVIEW_BIO,
  HUB_REVIEW_SHOW_ON_WEBSITE,
} from '@/lib/freePreview/hubCopy';
import type { HubReviewPublic, HubReviewSection, HubReviewShopData } from '@/lib/freePreview/hubReviews';
import { isRetiredHubReviewSection } from '@/lib/freePreview/hubReviews.shared';

const TITLES: Record<HubReviewSection, string> = {
  SERVICES: HUB_DETAILS_SERVICES_TITLE,
  TEAM: HUB_DETAILS_TEAM_TITLE,
  HOURS: HUB_DETAILS_HOURS_TITLE,
};

export function OpsHubContent(props: {
  requestId: string;
  reviews: Record<HubReviewSection, HubReviewPublic | null>;
  diffs: Record<HubReviewSection, Array<{ label: string; from: string; to: string }>>;
  shop: HubReviewShopData | null;
  hasSeparateWebsite: boolean;
}) {
  const [reviews, setReviews] = useState(props.reviews);
  const [diffs, setDiffs] = useState(props.diffs);
  const [notes, setNotes] = useState<Record<HubReviewSection, string>>({ SERVICES: '', TEAM: '', HOURS: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(section: HubReviewSection, action: 'apply' | 'dismiss') {
    const review = reviews[section];
    if (!review || busy) return;
    setBusy(`${section}-${action}`);
    setError(null);
    try {
      const response = await fetch(`/api/ops/preview-requests/${encodeURIComponent(props.requestId)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewId: review.id,
          opsNote: action === 'dismiss' ? notes[section] : undefined,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; review?: HubReviewPublic; error?: { message?: string } };
      if (!response.ok || !payload.ok || !payload.review) {
        throw new Error(payload.error?.message || HUB_OPS_APPLY_FAILED);
      }
      setReviews((current) => ({ ...current, [section]: payload.review! }));
      if (action === 'apply') setDiffs((current) => ({ ...current, [section]: [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_OPS_APPLY_FAILED);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ops-hub-content" aria-label="Content proposals">
      {props.hasSeparateWebsite ? <p className="ops-pr__empty">{HUB_OPS_WEBSITE_REMINDER}</p> : null}
      {(['SERVICES', 'TEAM', 'HOURS'] as const).map((section) => {
        const review = reviews[section];
        const rows = diffs[section];
        return (
          <article key={section} className="ops-hub-section">
            <header className="hub-review-card__head">
              <h3>{TITLES[section]}</h3>
              <span className="hub-review-chip">{review?.state ?? '—'}</span>
            </header>
            {rows.length ? (
              <ul className="ops-hub-diff">
                {rows.map((row) => (
                  <li key={`${section}-${row.label}`}>
                    <strong>{row.label}</strong>
                    <span>{row.from}</span>
                    <span aria-hidden="true">→</span>
                    <span>{row.to}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ops-pr__empty">No proposal to apply.</p>
            )}
            {section === 'TEAM' && review?.proposal && typeof review.proposal === 'object' && 'barbers' in review.proposal ? (
              <div className="ops-hub-manual">
                <p className="ops-pr__empty">{HUB_OPS_MANUAL_WEBSITE_UPDATE}</p>
                <ul>
                  {(review.proposal as { barbers?: Array<{ name?: string; bio?: string; showOnWebsite?: boolean }> }).barbers?.map((barber, index) => (
                    <li key={`${barber.name ?? 'barber'}-${index}`}>
                      <strong>{barber.name}</strong>
                      <span>
                        {HUB_REVIEW_BIO}: {barber.bio?.trim() || '—'}
                      </span>
                      <span>
                        {HUB_REVIEW_SHOW_ON_WEBSITE}: {barber.showOnWebsite === false ? 'No' : 'Yes'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {isRetiredHubReviewSection(section) && review ? (
              <p className="ops-pr__empty">{HUB_OPS_REVIEW_HISTORICAL}</p>
            ) : null}
            {review?.state === 'CORRECTIONS_SENT' && !isRetiredHubReviewSection(section) ? (
              <>
                <label>
                  {HUB_OPS_DISMISS_NOTE}
                  <textarea
                    className="textarea"
                    value={notes[section]}
                    onChange={(event) => setNotes((current) => ({ ...current, [section]: event.target.value }))}
                  />
                </label>
                <div className="hub-review-card__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={busy !== null}
                    onClick={() => void act(section, 'apply')}
                  >
                    {busy === `${section}-apply` ? HUB_OPS_APPLIED : HUB_OPS_APPLY}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busy !== null || !notes[section].trim()}
                    onClick={() => void act(section, 'dismiss')}
                  >
                    {busy === `${section}-dismiss` ? HUB_OPS_DISMISSED : HUB_OPS_DISMISS}
                  </button>
                </div>
              </>
            ) : null}
          </article>
        );
      })}
      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setError(null)}>
            {HUB_RETRY}
          </button>
        </p>
      ) : null}
    </section>
  );
}
