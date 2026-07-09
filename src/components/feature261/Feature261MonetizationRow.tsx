import HomepageSalesKpiWidget from '@/components/HomepageSalesKpiWidget';
import { FEATURE261_MONETIZATION_ROW } from '@/lib/landing/feature261MonetizationRow';
import { cn } from '@/lib/utils';
import '@/styles/components/booking.css';

type Feature261MonetizationRowProps = {
  reverse?: boolean;
};

function Feature261MonetizationRow({ reverse = false }: Feature261MonetizationRowProps) {
  const { kicker, heading, description, ctaLabel, ctaHref } = FEATURE261_MONETIZATION_ROW;

  return (
    <li
      data-feature261-card
      className={cn('feature261__row', reverse && 'feature261__row--reverse')}
    >
      <div className="feature261__media feature261__media--widget">
        <HomepageSalesKpiWidget />
      </div>

      <div className="feature261__copy">
        <p className="feature261__row-kicker">{kicker}</p>
        <h3 className="feature261__row-heading">{heading}</h3>
        <p className="feature261__row-body">{description}</p>
      </div>

      <a
        href={ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn--primary feature261__row-cta"
      >
        {ctaLabel}
      </a>
    </li>
  );
}

export { Feature261MonetizationRow };
