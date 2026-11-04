import { useMemo, useState, type ReactNode } from 'react';
import { WeeklyHoursEditor } from '@/components/admin/clientOnboarding/WeeklyHoursEditor';
import type { WeeklyRule } from '@/components/admin/clientOnboarding/types';
import {
  HUB_CHECK_DETAILS_TITLE,
  HUB_DETAILS_HOURS_TITLE,
  HUB_DETAILS_SERVICES_TITLE,
  HUB_DETAILS_TEAM_TITLE,
  HUB_RETRY,
  HUB_REVIEW_ADD_ROW,
  HUB_REVIEW_BIO,
  HUB_REVIEW_BIO_HELPER,
  HUB_REVIEW_CARD_FOOTER,
  HUB_REVIEW_CONFIRMED,
  HUB_REVIEW_CORRECTIONS_SENT,
  HUB_REVIEW_DISMISSED_NOTE,
  HUB_REVIEW_DURATION,
  HUB_REVIEW_EMPTY_HOURS,
  HUB_REVIEW_EMPTY_SERVICES,
  HUB_REVIEW_EMPTY_TEAM,
  HUB_REVIEW_FAILED,
  HUB_REVIEW_LOOKS_RIGHT,
  HUB_REVIEW_NAME,
  HUB_REVIEW_NOT_CHECKED,
  HUB_REVIEW_PHOTO,
  HUB_REVIEW_PRICE,
  HUB_REVIEW_REMOVE_ROW,
  HUB_REVIEW_SEND_CORRECTIONS,
  HUB_REVIEW_SENDING,
  HUB_REVIEW_SENT,
  HUB_REVIEW_SHOW_ON_WEBSITE,
  HUB_REVIEW_UNSAVED,
  HUB_REVIEW_UPDATED,
} from '@/lib/freePreview/hubCopy';
import {
  formatGbpPence,
  hoursFingerprint,
  hoursToWeeklyRules,
  servicesFingerprint,
  teamFingerprint,
  type HubReviewCardState,
  type HubReviewPublic,
  type HubReviewSection,
  type HubReviewShopData,
} from '@/lib/freePreview/hubReviews.shared';
import { hubApiRoot } from '@/lib/adminHub/links';
import { HubUploader, type HubUploadedAsset } from './HubUploader';

export type HubReviewMap = Record<HubReviewSection, HubReviewPublic | null>;

type ServiceDraft = {
  clientId: string;
  id?: string | null;
  name: string;
  durationMinutes: number;
  pricePence: number;
  removed?: boolean;
};

type TeamDraft = {
  clientId: string;
  id?: string | null;
  name: string;
  bio: string;
  showOnWebsite: boolean;
  photoAssetId: string | null;
  removed?: boolean;
};

const STATE_LABEL: Record<HubReviewCardState, string> = {
  not_checked: HUB_REVIEW_NOT_CHECKED,
  confirmed: HUB_REVIEW_CONFIRMED,
  corrections_sent: HUB_REVIEW_CORRECTIONS_SENT,
  updated: HUB_REVIEW_UPDATED,
  dismissed: HUB_REVIEW_NOT_CHECKED,
};

function cardState(review: HubReviewPublic | null): HubReviewCardState {
  return review?.cardState ?? 'not_checked';
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function postReview(apiRoot: string, body: unknown) {
  const response = await fetch(`${apiRoot}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { ok?: boolean; review?: HubReviewPublic; error?: string };
  if (!response.ok || !payload.ok || !payload.review) throw new Error(payload.error || HUB_REVIEW_FAILED);
  return payload.review;
}

export function HubReviewCards(props: {
  token: string;
  apiBase?: string;
  detailsHref?: string;
  canReview: boolean;
  shop: HubReviewShopData | null;
  reviews: HubReviewMap;
  mode: 'strip' | 'full';
}) {
  const apiRoot = hubApiRoot(props);
  const [reviews, setReviews] = useState(props.reviews);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<HubReviewSection | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const shop = props.shop;
  const services = useMemo<ServiceDraft[]>(
    () =>
      (shop?.services ?? []).map((row) => ({
        clientId: row.id,
        id: row.id,
        name: row.name,
        durationMinutes: row.durationMinutes,
        pricePence: row.pricePence,
      })),
    [shop],
  );
  const team = useMemo<TeamDraft[]>(
    () =>
      (shop?.barbers ?? []).map((row) => ({
        clientId: row.id,
        id: row.id,
        name: row.name,
        bio: '',
        showOnWebsite: true,
        photoAssetId: row.photoAssetId,
      })),
    [shop],
  );
  const [serviceRows, setServiceRows] = useState(services);
  const [teamRows, setTeamRows] = useState(team);
  const [hours, setHours] = useState<WeeklyRule[]>(hoursToWeeklyRules(shop?.hours ?? []));
  const servicesDirty = JSON.stringify(serviceRows) !== JSON.stringify(services);
  const teamDirty = JSON.stringify(teamRows) !== JSON.stringify(team);
  const hoursDirty =
    JSON.stringify(hours) !== JSON.stringify(hoursToWeeklyRules(shop?.hours ?? []));

  const save = async (section: HubReviewSection, body: unknown) => {
    if (busy) return;
    setBusy(section);
    setError(null);
    try {
      const review = await postReview(apiRoot, body);
      setReviews((current) => ({ ...current, [section]: review }));
      setToast(HUB_REVIEW_SENT);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_REVIEW_FAILED);
    } finally {
      setBusy(null);
    }
  };

  if (props.mode === 'strip') {
    const items: Array<{ section: HubReviewSection; title: string; href: string }> = [
      { section: 'SERVICES', title: HUB_DETAILS_SERVICES_TITLE, href: `${props.detailsHref}#hub-review-services` },
      { section: 'TEAM', title: HUB_DETAILS_TEAM_TITLE, href: `${props.detailsHref}#hub-review-team` },
      { section: 'HOURS', title: HUB_DETAILS_HOURS_TITLE, href: `${props.detailsHref}#hub-review-hours` },
    ];
    return (
      <section className="hub-card ks-glass-card" aria-labelledby="hub-check-details-title">
        <h2 id="hub-check-details-title" className="hub-card__title">
          {HUB_CHECK_DETAILS_TITLE}
        </h2>
        <ul className="hub-review-strip">
          {items.map((item) => (
            <li key={item.section}>
              <a className={`hub-review-strip__card is-${cardState(reviews[item.section])}`} href={item.href}>
                <span>{item.title}</span>
                <span className="hub-review-chip">{STATE_LABEL[cardState(reviews[item.section])]}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!shop) {
    return (
      <section className="hub-card ks-glass-card">
        <p className="hub-card__body">{HUB_REVIEW_EMPTY_SERVICES}</p>
      </section>
    );
  }

  return (
    <div className="hub-review-stack">
      <ReviewCard
        id="hub-review-services"
        title={HUB_DETAILS_SERVICES_TITLE}
        state={cardState(reviews.SERVICES)}
        note={reviews.SERVICES?.opsNote}
        busy={busy === 'SERVICES'}
        canReview={props.canReview}
        dirty={servicesDirty}
        empty={!serviceRows.some((row) => !row.removed)}
        emptyLabel={HUB_REVIEW_EMPTY_SERVICES}
        onConfirm={() => void save('SERVICES', { action: 'confirmed', section: 'SERVICES' })}
        onCorrections={() =>
          void save('SERVICES', {
            action: 'corrections',
            section: 'SERVICES',
            proposal: {
              services: serviceRows,
              baseline: servicesFingerprint(shop.services),
            },
          })
        }
      >
        <div className="hub-review-table">
          {serviceRows
            .filter((row) => !row.removed)
            .map((row) => (
              <div key={row.clientId} className="hub-review-row">
                <label>
                  <span className="sr-only">{HUB_REVIEW_NAME}</span>
                  <input
                    className="input"
                    value={row.name}
                    maxLength={80}
                    disabled={!props.canReview}
                    onChange={(event) =>
                      setServiceRows((current) =>
                        current.map((item) => (item.clientId === row.clientId ? { ...item, name: event.target.value } : item)),
                      )
                    }
                  />
                </label>
                <label>
                  <span className="sr-only">{HUB_REVIEW_DURATION}</span>
                  <input
                    className="input"
                    type="number"
                    min={5}
                    max={480}
                    value={row.durationMinutes}
                    disabled={!props.canReview}
                    onChange={(event) =>
                      setServiceRows((current) =>
                        current.map((item) =>
                          item.clientId === row.clientId
                            ? { ...item, durationMinutes: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <span className="sr-only">{HUB_REVIEW_PRICE}</span>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={(row.pricePence / 100).toFixed(2)}
                    disabled={!props.canReview}
                    onChange={(event) => {
                      const pence = Math.round(Number(event.target.value) * 100);
                      setServiceRows((current) =>
                        current.map((item) =>
                          item.clientId === row.clientId
                            ? { ...item, pricePence: Number.isFinite(pence) ? pence : item.pricePence }
                            : item,
                        ),
                      );
                    }}
                  />
                </label>
                {props.canReview ? (
                  <div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        setServiceRows((current) =>
                          current.map((item) => (item.clientId === row.clientId ? { ...item, removed: true } : item)),
                        )
                      }
                    >
                      {HUB_REVIEW_REMOVE_ROW}
                    </button>
                  </div>
                ) : (
                  <span className="hub-card__body">
                    {formatGbpPence(row.pricePence)}
                  </span>
                )}
              </div>
            ))}
        </div>
        {props.canReview ? (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() =>
              setServiceRows((current) => [
                ...current,
                { clientId: newId('svc'), name: '', durationMinutes: 30, pricePence: 0 },
              ])
            }
          >
            {HUB_REVIEW_ADD_ROW}
          </button>
        ) : null}
      </ReviewCard>

      <ReviewCard
        id="hub-review-team"
        title={HUB_DETAILS_TEAM_TITLE}
        state={cardState(reviews.TEAM)}
        note={reviews.TEAM?.opsNote}
        busy={busy === 'TEAM'}
        canReview={props.canReview}
        dirty={teamDirty}
        empty={!teamRows.some((row) => !row.removed)}
        emptyLabel={HUB_REVIEW_EMPTY_TEAM}
        onConfirm={() => void save('TEAM', { action: 'confirmed', section: 'TEAM' })}
        onCorrections={() =>
          void save('TEAM', {
            action: 'corrections',
            section: 'TEAM',
            proposal: { barbers: teamRows, baseline: teamFingerprint(shop.barbers) },
          })
        }
      >
        <ul className="hub-review-team">
          {teamRows
            .filter((row) => !row.removed)
            .map((row) => (
              <li key={row.clientId} className="hub-review-barber">
                <label>
                  {HUB_REVIEW_NAME}
                  <input
                    className="input"
                    value={row.name}
                    maxLength={60}
                    disabled={!props.canReview}
                    onChange={(event) =>
                      setTeamRows((current) =>
                        current.map((item) => (item.clientId === row.clientId ? { ...item, name: event.target.value } : item)),
                      )
                    }
                  />
                </label>
                <label>
                  {HUB_REVIEW_BIO}
                  <textarea
                    className="textarea"
                    maxLength={280}
                    value={row.bio}
                    disabled={!props.canReview}
                    onChange={(event) =>
                      setTeamRows((current) =>
                        current.map((item) => (item.clientId === row.clientId ? { ...item, bio: event.target.value } : item)),
                      )
                    }
                  />
                  <span className="field__hint">{HUB_REVIEW_BIO_HELPER}</span>
                </label>
                <label className="hub-review-toggle">
                  <input
                    type="checkbox"
                    checked={row.showOnWebsite}
                    disabled={!props.canReview}
                    onChange={(event) =>
                      setTeamRows((current) =>
                        current.map((item) =>
                          item.clientId === row.clientId ? { ...item, showOnWebsite: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  {HUB_REVIEW_SHOW_ON_WEBSITE}
                </label>
                {props.canReview && row.id ? (
                  <div>
                    <p className="field__hint">{HUB_REVIEW_PHOTO}</p>
                    <HubUploader
                      token={props.token}
                      apiBase={props.apiBase}
                      kind="TEAM_PHOTO"
                      compact
                      remaining={1}
                      onUploaded={(asset) => {
                        void fetch(`${apiRoot}/assets/${encodeURIComponent(asset.id)}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ barberId: row.id }),
                        });
                        setTeamRows((current) =>
                          current.map((item) =>
                            item.clientId === row.clientId ? { ...item, photoAssetId: asset.id } : item,
                          ),
                        );
                      }}
                    />
                  </div>
                ) : null}
                {props.canReview ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() =>
                      setTeamRows((current) =>
                        current.map((item) => (item.clientId === row.clientId ? { ...item, removed: true } : item)),
                      )
                    }
                  >
                    {HUB_REVIEW_REMOVE_ROW}
                  </button>
                ) : null}
              </li>
            ))}
        </ul>
        {props.canReview ? (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() =>
              setTeamRows((current) => [
                ...current,
                { clientId: newId('barber'), name: '', bio: '', showOnWebsite: true, photoAssetId: null },
              ])
            }
          >
            {HUB_REVIEW_ADD_ROW}
          </button>
        ) : null}
      </ReviewCard>

      <ReviewCard
        id="hub-review-hours"
        title={HUB_DETAILS_HOURS_TITLE}
        state={cardState(reviews.HOURS)}
        note={reviews.HOURS?.opsNote}
        busy={busy === 'HOURS'}
        canReview={props.canReview}
        dirty={hoursDirty}
        empty={hours.length === 0}
        emptyLabel={HUB_REVIEW_EMPTY_HOURS}
        onConfirm={() => void save('HOURS', { action: 'confirmed', section: 'HOURS' })}
        onCorrections={() =>
          void save('HOURS', {
            action: 'corrections',
            section: 'HOURS',
            proposal: {
              days: hours.map((day) => ({
                dayOfWeek: day.dayOfWeek,
                open: day.active,
                start: day.startTime,
                end: day.endTime,
              })),
              baseline: hoursFingerprint(shop.hours),
            },
          })
        }
      >
        <WeeklyHoursEditor idPrefix="hub-hours" rules={hours} onChange={setHours} disabled={!props.canReview} />
      </ReviewCard>

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
    </div>
  );
}

function ReviewCard(props: {
  id: string;
  title: string;
  state: HubReviewCardState;
  note: string | null | undefined;
  busy: boolean;
  canReview: boolean;
  dirty: boolean;
  empty: boolean;
  emptyLabel: string;
  onConfirm: () => void;
  onCorrections: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`hub-card ks-glass-card hub-review-card is-${props.state}`} aria-labelledby={`${props.id}-title`} id={props.id}>
      <header className="hub-review-card__head">
        <h2 id={`${props.id}-title`} className="hub-card__title">
          {props.title}
        </h2>
        <span className="hub-review-chip">{STATE_LABEL[props.state]}</span>
      </header>
      {props.empty ? <p className="hub-card__body">{props.emptyLabel}</p> : props.children}
      {props.note && props.state === 'dismissed' ? (
        <p className="hub-card__body">
          {HUB_REVIEW_DISMISSED_NOTE}: {props.note}
        </p>
      ) : null}
      <p className="hub-card__body">{HUB_REVIEW_CARD_FOOTER}</p>
      {props.canReview ? (
        <div className="hub-review-card__actions">
          {props.dirty ? <p className="hub-review-unsaved">{HUB_REVIEW_UNSAVED}</p> : null}
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            data-testid={`${props.id}-looks-right`}
            onClick={props.onConfirm}
            disabled={props.busy || props.dirty}
          >
            {props.busy ? HUB_REVIEW_SENDING : `${HUB_REVIEW_LOOKS_RIGHT} ✓`}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            data-testid={`${props.id}-send-corrections`}
            onClick={props.onCorrections}
            disabled={props.busy || !props.dirty}
          >
            {props.busy ? HUB_REVIEW_SENDING : HUB_REVIEW_SEND_CORRECTIONS}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export type { HubUploadedAsset };
