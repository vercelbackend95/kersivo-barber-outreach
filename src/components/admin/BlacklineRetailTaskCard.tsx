import { Package } from '@/components/lucide-react';
import { buildBlacklineRetailHref } from '@/lib/admin/demoConfig';

export type BlacklineRetailTaskCardStage = 'collect' | 'view_sale';

const COPY: Record<
  BlacklineRetailTaskCardStage,
  { eyebrow: string; title: string; body: string }
> = {
  collect: {
    eyebrow: 'YOUR DEMO ORDER',
    title: 'A customer has paid online',
    body: 'The order is ready to prepare. Mark it as collected when the customer picks it up.',
  },
  view_sale: {
    eyebrow: 'ORDER COLLECTED',
    title: 'Now see the sale',
    body: 'KERSIVO has already recorded the paid retail transaction and updated your sales figures.',
  },
};

export default function BlacklineRetailTaskCard({
  stage,
  orderId,
  compact = true,
}: {
  stage: BlacklineRetailTaskCardStage;
  orderId: string;
  compact?: boolean;
}) {
  const copy = COPY[stage];
  const salesHref = buildBlacklineRetailHref({
    section: 'shop_sales',
    orderId,
    demoJourney: true,
  });

  return (
    <section
      className={['retail-task-card', compact ? 'retail-task-card--compact' : '']
        .filter(Boolean)
        .join(' ')}
      data-blackline-retail-task={stage}
      aria-labelledby="blackline-retail-task-title"
      aria-live="polite"
      role="status"
    >
      <div className="retail-task-card__top">
        <span className="retail-task-card__icon" aria-hidden="true">
          <Package width={20} height={20} />
        </span>
        <div className="retail-task-card__heading">
          <p className="retail-task-card__eyebrow">{copy.eyebrow}</p>
        </div>
      </div>
      <h2 id="blackline-retail-task-title" className="retail-task-card__title">
        {copy.title}
      </h2>
      <p className="retail-task-card__body">{copy.body}</p>
      {stage === 'view_sale' ? (
        <a className="btn btn--primary retail-task-card__cta" href={salesHref}>
          View in Sales
        </a>
      ) : null}
    </section>
  );
}
