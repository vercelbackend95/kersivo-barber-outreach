import { ShopProductCarousel } from '@/components/shop/ShopProductCarousel';
import { type CarouselProduct } from '@/lib/shop/carouselProducts';
import { cn } from '@/lib/utils';

interface Feature261Props {
  className?: string;
  retailProducts?: CarouselProduct[];
}

type FeatureRowData = {
  kicker: string;
  heading: string;
  description: string;
  ctaLabel: string;
  media: 'image' | 'carousel';
  src?: string;
  alt?: string;
  imageClassName?: string;
  imgWidth?: number;
  imgHeight?: number;
  loading?: 'eager' | 'lazy';
};

const rows: FeatureRowData[] = [
  {
    src: '/images/screenshots/timeline1.png',
    imgWidth: 1260,
    imgHeight: 909,
    alt: 'Signed-in admin — bookings timeline and day schedule',
    kicker: 'BOOKING OVERVIEW',
    heading: "Chairs, statuses, what's next—plus the pulse when you need it.",
    description:
      "Timeline, statuses and today's pulse in one signed-in view. See who's in the chair, what's coming up and how the day is tracking without jumping between screens.",
    ctaLabel: 'See it live',
    imageClassName: 'feature261-row-image--bookings',
    loading: 'eager',
    media: 'image',
  },
  {
    src: '/images/screenshots/bookingi.png',
    imgWidth: 1338,
    imgHeight: 870,
    alt: 'Public booking — pick service, barber and time',
    kicker: 'CLIENT BOOKING',
    heading: 'Service, barber, time—your URL, your brand, not their app.',
    description:
      'Clients pick a service, barber and slot on your domain in three taps. No app-store detour, no marketplace tile—just your brand, end to end.',
    ctaLabel: 'See it live',
    imageClassName: 'feature261-row-image--booking',
    loading: 'eager',
    media: 'image',
  },
  {
    src: '/hero-assets/barbers.png',
    imgWidth: 1621,
    imgHeight: 896,
    alt: 'Signed-in admin — barber roster, hours and assignments',
    kicker: 'BARBERS',
    heading: 'Roster, hours, who offers what—grow the team in one place.',
    description:
      "Add barbers, set hours and assign services from one roster. Everyone on the floor knows who does what—and clients only see who's actually available.",
    ctaLabel: 'See it live',
    imageClassName: 'feature261-row-image--barbers',
    media: 'image',
  },
  {
    kicker: 'RETAIL',
    heading: 'Catalog, orders, pickup ready—same panel as the chair.',
    description:
      'Products, orders and pickup status live beside bookings in the same admin. Clients pre-order from your shop page; you mark it ready when they walk in.',
    ctaLabel: 'See it live',
    media: 'carousel',
  },
  {
    src: '/hero-assets/screens/6.png',
    alt: 'Signed-in admin — services, prices and durations',
    kicker: 'SERVICES',
    heading: 'Price, duration, menu—what they book matches what you run.',
    description:
      "Set prices, durations and what's on the menu once. What clients see when they book is exactly what lands on your schedule and in your reports.",
    ctaLabel: 'See it live',
    imageClassName: 'feature261-row-image--services',
    media: 'image',
  },
];

type FeatureRowProps = FeatureRowData & {
  reverse?: boolean;
  retailProducts?: CarouselProduct[];
};

function FeatureRow({
  src,
  alt,
  kicker,
  heading,
  description,
  ctaLabel,
  imageClassName,
  imgWidth = 1520,
  imgHeight = 920,
  loading = 'lazy',
  media,
  reverse = false,
  retailProducts = [],
}: FeatureRowProps) {
  return (
    <li
      data-feature261-card
      className={cn('feature261__row', reverse && 'feature261__row--reverse')}
    >
      {media === 'carousel' ? (
        <div className="feature261__media feature261__media--carousel">
          <ShopProductCarousel
            products={retailProducts}
            className="feature261-retail-carousel"
            showControls={false}
          />
        </div>
      ) : (
        <div className="feature261__media">
          <div className="feature261-visual-card__viewport">
            <img
              src={src}
              alt={alt ?? ''}
              width={imgWidth}
              height={imgHeight}
              decoding="async"
              loading={loading}
              className={cn('feature261-visual-card__shot', imageClassName)}
            />
          </div>
        </div>
      )}

      <div className="feature261__copy">
        <p className="feature261__row-kicker">{kicker}</p>
        <h3 className="feature261__row-heading">{heading}</h3>
        <p className="feature261__row-body">{description}</p>
        <a href="#" className="btn btn--primary feature261__row-cta">
          {ctaLabel}
        </a>
      </div>
    </li>
  );
}

const Feature261 = ({ className, retailProducts = [] }: Feature261Props) => {
  return (
    <section className={cn('feature261 py-32', className)}>
      <div className="container">
        <header className="feature261__intro">
          <p className="feature261__kicker">INSIDE THE SYSTEM</p>
          <h2 className="feature261__heading">Same screens you&rsquo;ll run your shop on.</h2>
          <p className="feature261__description">
            Client booking on your domain, one admin for the floor, buy-and-collect retail, and the day&rsquo;s numbers
            in one panel.
          </p>
        </header>

        <ul className="feature261__rows" role="list">
          {rows.map((row, index) => (
            <FeatureRow
              key={row.kicker}
              {...row}
              reverse={index % 2 === 1}
              retailProducts={row.media === 'carousel' ? retailProducts : undefined}
            />
          ))}
        </ul>

        <div className="feature261__cta-block">
          <button type="button" className="btn btn--primary" data-system-chooser-open>
            See the Live Shop
          </button>
          <p className="feature261__footnote">
            Opens in a new tab&mdash;wander the booking flow, floor panel and shop shelf at your pace.
            No signup, no sales call; close the tab when you&rsquo;re done.
          </p>
        </div>
      </div>
    </section>
  );
};

export { Feature261 };
