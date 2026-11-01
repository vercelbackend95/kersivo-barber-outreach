import { useEffect, useId, useState } from 'react';
import { ArrowRight, Check, ChevronDown } from '@/components/lucide-react';
import {
  SETUP_CARD_TITLE,
  SETUP_COMPLETE_LABEL,
  SETUP_EXPAND_EVENT,
  SETUP_FROM_LINKS_TAG,
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
} from '@/lib/adminHub/setupCard';

function extraLabel(item: SetupItem, nextId: SetupCardItemId | null): string {
  if (item.done) return 'Done';
  if (item.fromLinks) return SETUP_FROM_LINKS_TAG;
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
      ) : item.fromLinks && !item.done ? (
        <span className="admin-hub-setup__tag">{SETUP_FROM_LINKS_TAG}</span>
      ) : item.optional && !item.done ? (
        <span className="admin-hub-setup__tag">{SETUP_OPTIONAL_TAG}</span>
      ) : null}
    </a>
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

  const [chrome, setChrome] = useState<SetupCardChrome>(allDone ? 'complete' : 'checklist');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!allDone) {
      setChrome('checklist');
      return;
    }
    const storedAt = rememberSetupCompleteAt(Date.now(), storageScope);
    setChrome(resolveSetupCardChrome(true, Date.now(), storedAt));
  }, [allDone, storageScope]);

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
    return (
      <section
        className={`admin-hub-setup admin-hub-setup--${placement} admin-hub-setup--complete`}
        aria-labelledby={titleId}
      >
        <p className="admin-hub-setup__complete" id={titleId} role="status">
          {SETUP_COMPLETE_LABEL}
        </p>
      </section>
    );
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
