import LandingBookingsReportsWidget from '@/components/LandingBookingsReportsWidget';
import { FEATURE261_MONETIZATION_ROW } from '@/lib/landing/feature261MonetizationRow';
import { cn } from '@/lib/utils';
import '@/styles/components/booking.css';

type Feature261MonetizationRowProps = {
  reverse?: boolean;
};

function Feature261MonetizationRow({ reverse = false }: Feature261MonetizationRowProps) {
  const {
    kicker,
    heading,
    description,
    ctaLabel,
    ctaHref,
    ctaTrack,
    ghostCtaLabel,
    ghostCtaHref,
  } = FEATURE261_MONETIZATION_ROW;

  return (
    <li
      data-feature261-card
      className={cn('feature261__row', reverse && 'feature261__row--reverse')}
    >
      <div className="feature261__media feature261__media--widget">
        <LandingBookingsReportsWidget />
      </div>

      <div className="feature261__copy">
        <p className="feature261__row-kicker">{kicker}</p>
        <h3 className="feature261__row-heading">{heading}</h3>
        <p className="feature261__row-body">{description}</p>
      </div>

      <div className="feature261__row-ctas">
        <a
          href={ctaHref}
          className="btn btn--primary feature261__row-cta"
          data-track={ctaTrack}
        >
          {ctaLabel}
        </a>
        <a
          href={ghostCtaHref}
          className="btn btn--ghost feature261__row-cta feature261__row-cta--ghost"
          target="_blank"
          rel="noopener noreferrer"
        >
          {ghostCtaLabel}
        </a>
      </div>
    </li>
  );
}

export { Feature261MonetizationRow };
