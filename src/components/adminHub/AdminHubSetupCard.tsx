import { useEffect, useId, useState } from 'react';
import { ArrowRight, Check, ChevronDown } from '@/components/lucide-react';
import { offer } from '@/content/offer';
import { PREVIEW_ONBOARDING_PATH } from '@/lib/freePreview/config';
import { PREVIEW_HUB_PATHS } from '@/lib/adminHub/previewHubPaths';
import {
  SETUP_CARD_TITLE,
  SETUP_DONE_COPY,
  SETUP_EXPAND_EVENT,
  SETUP_HIDE_STEPS,
  SETUP_OPTIONAL_TAG,
  SETUP_SHOW_ALL_STEPS,
  readSetupExpanded,
  rememberSetupCompleteAt,
  resolveSetupCardChrome,
  setupCardAllDone,
  setupDoneStatus,
  writeSetupExpanded,
  type SetupCardChrome,
  type SetupCardItemId,
  type SetupCardModel,
  type SetupItem,
  type SetupSubscribe,
} from '@/lib/adminHub/setupCard';
import { HubSubscribeButton } from './HubSubscribeButton';

function extraLabel(item: SetupItem, nextId: SetupCardItemId | null): string {
  if (item.done) return item.detail ?? 'Done';
  if (item.optional) return SETUP_OPTIONAL_TAG;
  if (item.id === nextId) return 'Next';
  return 'To do';
}

function SetupRow(props: {
  item: SetupItem;
  next: boolean;
  nextId: SetupCardItemId | null;
  onNavigate?: () => void;
}) {
  const { item, next, nextId, onNavigate } = props;
  return (
    <a
      className={`admin-hub-setup__item${item.done ? ' is-done' : next ? ' is-next' : ' is-todo'}`}
      href={item.href}
      data-app-opener={item.id}
      aria-label={`${item.label}, ${extraLabel(item, nextId)}`}
      onClick={onNavigate}
    >
      <span className="admin-hub-setup__mark" aria-hidden="true">
        {item.done ? <Check width={11} height={11} strokeWidth={3} /> : null}
      </span>
      <span className="admin-hub-setup__label">{item.label}</span>
      {next ? (
        <span className="admin-hub-setup__go" aria-hidden="true">
          <ArrowRight width={13} height={13} />
        </span>
      ) : item.done && item.detail ? (
        <span className="admin-hub-setup__tag">{item.detail}</span>
      ) : item.optional && !item.done ? (
        <span className="admin-hub-setup__tag">{SETUP_OPTIONAL_TAG}</span>
      ) : null}
    </a>
  );
}

/**
 * Every required step is done: what happens next (we design, you review and approve), and for owners who do not
 * want to wait, Full KERSIVO now. Matches the /starter glance card: near-black surface, red line on the top edge.
 */
function SetupDoneCard(props: {
  card: SetupCardModel;
  placement: 'sidebar' | 'mobile';
  titleId: string;
  onNavigate?: () => void;
}) {
  const { card, placement, titleId, onNavigate } = props;
  const subscribe: SetupSubscribe | null = card.subscribe ?? null;
  const subscribed = subscribe?.state === 'subscribed';
  const review = card.stage === 'review';
  const copy = SETUP_DONE_COPY;
  const title = subscribed
    ? copy.title.subscribed
    : review
      ? copy.title.review
      : card.stage === 'requested'
        ? copy.title.requested
        : copy.title.designing;
  const body = subscribed ? copy.body.subscribed : review ? copy.body.review : copy.body.designing;
  // The step the owner is on: designing (1 done) or reviewing (2 done).
  const at = review ? 2 : 1;
  return (
    <section
      className={`admin-hub-setup admin-hub-setup--${placement} admin-hub-setup--complete`}
      aria-labelledby={titleId}
      data-testid="admin-hub-setup-done"
    >
      <div className={subscribed ? 'admin-hub-done admin-hub-done--subscribed' : 'admin-hub-done'}>
        <p className="admin-hub-done__eyebrow">
          <span aria-hidden="true" />
          {subscribed ? copy.subscribedEyebrow : copy.eyebrow}
        </p>
        <h2 className="admin-hub-done__title" id={titleId}>
          {title}
        </h2>
        <p className="admin-hub-done__body">{body}</p>
        {subscribed ? null : (
          <ol className="admin-hub-done__steps" aria-label={copy.stepsLabel}>
            {copy.steps.map((step, index) => (
              <li
                key={step}
                className={index < at ? 'is-done' : index === at ? 'is-now' : undefined}
                aria-current={index === at ? 'step' : undefined}
              >
                <span className="admin-hub-done__mark" aria-hidden="true">
                  {index < at ? <Check width={10} height={10} strokeWidth={3.2} /> : null}
                </span>
                {step}
              </li>
            ))}
          </ol>
        )}
        {subscribe && !subscribed ? (
          <div className="admin-hub-done__offer">
            <p className="admin-hub-done__lead">
              <strong>{subscribe.early ? copy.offerLead.early : copy.offerLead.review}</strong>{' '}
              {subscribe.early ? copy.offerText.early : copy.offerText.review}
            </p>
            <p className="admin-hub-done__price">
              <strong>{offer.price.full}</strong>
              <span>{copy.priceNote}</span>
            </p>
            <HubSubscribeButton
              subscribe={subscribe}
              className="btn btn--primary btn--sm admin-hub-done__cta"
              testId="admin-hub-setup-subscribe"
            >
              {subscribe.early ? copy.subscribe : copy.launch}
              <ArrowRight width={14} height={14} aria-hidden="true" />
            </HubSubscribeButton>
          </div>
        ) : null}
        {review && !subscribed ? (
          <a className="admin-hub-done__link" href={PREVIEW_HUB_PATHS.website} onClick={onNavigate}>
            {copy.review}
          </a>
        ) : null}
        {subscribed ? (
          <a className="admin-hub-done__link" href={PREVIEW_ONBOARDING_PATH} onClick={onNavigate}>
            {copy.checklist}
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function AdminHubSetupCard(props: {
  card: SetupCardModel;
  placement: 'sidebar' | 'mobile';
  storageScope?: string | null;
  onNavigate?: () => void;
}) {
  const { card, placement, storageScope = null, onNavigate } = props;
  const allDone = setupCardAllDone(card);
  const percent = card.total ? Math.round((card.done / card.total) * 100) : 0;
  const count = setupDoneStatus(card.done, card.total);
  const titleId = `admin-hub-setup-title-${placement}`;
  const listId = useId();
  const nextItem = card.items.find((item) => item.id === card.nextId) ?? null;

  // While Full KERSIVO can be started from it (or the owner already subscribed), the done card stays; otherwise it
  // shows for a week after the last step and then steps aside.
  const keepDone = Boolean(card.phase === 1 && card.subscribe);
  const [chrome, setChrome] = useState<SetupCardChrome>(allDone ? 'complete' : 'checklist');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!allDone) {
      setChrome('checklist');
      return;
    }
    const storedAt = rememberSetupCompleteAt(Date.now(), storageScope);
    setChrome(keepDone ? 'complete' : resolveSetupCardChrome(true, Date.now(), storedAt));
  }, [allDone, keepDone, storageScope]);

  useEffect(() => {
    const sync = () => setExpanded(readSetupExpanded(storageScope));
    sync();
    window.addEventListener(SETUP_EXPAND_EVENT, sync);
    return () => window.removeEventListener(SETUP_EXPAND_EVENT, sync);
  }, [storageScope]);

  const toggleExpanded = () => {
    const next = !expanded;
    writeSetupExpanded(next, storageScope);
    setExpanded(next);
    window.dispatchEvent(new Event(SETUP_EXPAND_EVENT));
  };

  if (chrome === 'hidden') return null;

  if (chrome === 'complete') {
    return <SetupDoneCard card={card} placement={placement} titleId={titleId} onNavigate={onNavigate} />;
  }

  const visibleItems = expanded ? card.items : nextItem ? [nextItem] : [];

  return (
    <section className={`admin-hub-setup admin-hub-setup--${placement}`} aria-labelledby={titleId}>
      <div className="admin-sidebar-launch-cta admin-sidebar-launch-cta--conversion admin-hub-setup__card">
        <div className="admin-hub-setup__head">
          <h2 className="admin-hub-setup__title" id={titleId}>
            {SETUP_CARD_TITLE}
          </h2>
          <button
            type="button"
            className="admin-hub-setup__toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={expanded ? SETUP_HIDE_STEPS : SETUP_SHOW_ALL_STEPS}
            onClick={toggleExpanded}
          >
            <ChevronDown width={16} height={16} aria-hidden="true" />
          </button>
        </div>
        <div
          className="admin-hub-setup__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={card.total}
          aria-valuenow={card.done}
          aria-label={count}
        >
          <span className="admin-hub-setup__fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="admin-hub-setup__count">{count}</p>
        {visibleItems.length ? (
          <ul className="admin-hub-setup__list" id={listId}>
            {visibleItems.map((item) => (
              <li key={item.id}>
                <SetupRow
                  item={item}
                  next={item.id === card.nextId}
                  nextId={card.nextId}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div id={listId} hidden={!expanded} />
        )}
      </div>
    </section>
  );
}
