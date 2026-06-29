import { saveAdminSecret } from '@/components/admin/adminAuth';
import { ShopProductCarousel } from '@/components/shop/ShopProductCarousel';
import { type CarouselProduct } from '@/lib/shop/carouselProducts';
import { cn } from '@/lib/utils';

interface Feature261Props {
  className?: string;
  retailProducts?: CarouselProduct[];
}

/** Must match demo prefill in AdminPanel and system chooser on the homepage. */
const DEMO_ADMIN_SECRET = 'supersecret123';

type FeatureRowData = {
  kicker: string;
  heading: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
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
    ctaLabel: 'See the timeline',
    ctaHref: '/admin?section=bookings_dashboard',
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
    ctaLabel: 'See the booking flow',
    ctaHref: '/book',
    imageClassName: 'feature261-row-image--booking',
    loading: 'eager',
    media: 'image',
  },
  {
    src: '/images/screenshots/barbers.png',
    imgWidth: 1211,
    imgHeight: 584,
    alt: 'Signed-in admin — barber roster, hours and assignments',
    kicker: 'BARBERS',
    heading: 'Roster, hours, who offers what—grow the team in one place.',
    description:
      "Add barbers, set hours and assign services from one roster. Everyone on the floor knows who does what—and clients only see who's actually available.",
    ctaLabel: 'See how to manage barbers',
    ctaHref: '/admin?section=bookings_blocks',
    imageClassName: 'feature261-row-image--barbers',
    media: 'image',
  },
  {
    kicker: 'RETAIL',
    heading: 'Catalog, orders, pickup ready—same panel as the chair.',
    description:
      'Products, orders and pickup status live beside bookings in the same admin. Clients pre-order from your shop page; you mark it ready when they walk in.',
    ctaLabel: 'See the shop live',
    ctaHref: '/shop',
    media: 'carousel',
  },
  {
    src: '/images/screenshots/diagram.png',
    alt: 'Signed-in admin — sales analytics, revenue chart and product breakdown',
    kicker: 'MONETIZATION',
    heading: 'Shop sales, payouts, barber income—see what you earned.',
    description:
      'Track retail revenue, order totals and how income breaks down across the team. Sales charts and KPIs live in the same signed-in admin as bookings and the shop.',
    ctaLabel: 'See the KPIs',
    ctaHref: '/admin?section=shop_sales',
    imageClassName: 'feature261-row-image--sales',
    media: 'image',
  },
];

function handleRowCtaClick(ctaHref: string) {
  if (ctaHref.startsWith('/admin')) {
    saveAdminSecret(DEMO_ADMIN_SECRET);
  }
}

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
  ctaHref,
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
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--primary feature261__row-cta"
          onClick={() => handleRowCtaClick(ctaHref)}
        >
          {ctaLabel}
        </a>
      </div>
    </li>
  );
}

const Feature261 = ({ className, retailProducts = [] }: Feature261Props) => {
  return (
    <section className={cn('feature261 py-32', className)}>
      <div className="feature261__glow" aria-hidden="true" />
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
      </div>
    </section>
  );
};

export { Feature261 };
