import { ArrowRight, Check, Store } from '@/components/lucide-react';
import { SETUP_FROM_LINKS_TAG, SETUP_OPTIONAL_TAG, type SetupCardModel } from '@/lib/adminHub/setupCard';

export function AdminHubSetupCard(props: { card: SetupCardModel; placement: 'sidebar' | 'mobile' }) {
  const { card, placement } = props;
  const percent = card.total ? Math.round((card.done / card.total) * 100) : 0;
  const titleId = `admin-hub-setup-title-${placement}`;

  return (
    <section className={`admin-hub-setup admin-hub-setup--${placement}`} aria-labelledby={titleId}>
      <div className="admin-sidebar-launch-cta admin-sidebar-launch-cta--conversion admin-hub-setup__card">
        <span className="admin-sidebar-launch-cta__icon" aria-hidden="true">
          <Store width={18} height={18} />
        </span>
        <div className="admin-sidebar-launch-cta__body">
          <p className="admin-sidebar-launch-cta__status">{card.status}</p>
          <h2 className="admin-sidebar-launch-cta__title" id={titleId}>
            {card.title}
          </h2>
          <div
            className="admin-hub-setup__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={card.total}
            aria-valuenow={card.done}
            aria-label={card.status}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <ul className="admin-hub-setup__list">
            {card.items.map((item) => {
              const next = item.id === card.nextId;
              const extra = item.done
                ? 'Done'
                : item.fromLinks
                  ? SETUP_FROM_LINKS_TAG
                  : item.optional
                    ? SETUP_OPTIONAL_TAG
                    : next
                      ? 'Next'
                      : 'To do';
              return (
                <li key={item.id}>
                  <a
                    className={`admin-hub-setup__item${item.done ? ' is-done' : next ? ' is-next' : ' is-todo'}`}
                    href={item.href}
                    data-app-opener={item.id}
                    aria-label={`${item.label}, ${extra}`}
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
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
