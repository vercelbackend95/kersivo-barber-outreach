import { adminDemoHref } from '@/lib/admin/demoConfig';
import { Feature261MonetizationRow } from '@/components/feature261/Feature261MonetizationRow';
import { Feature261MoreIncluded } from '@/components/feature261/Feature261MoreIncluded';
import { InsideSystemLiveWidget } from '@/components/InsideSystemLiveWidget';
import { LandingBookingWidget } from '@/components/LandingBookingWidget';
import { ShopProductCarousel } from '@/components/shop/ShopProductCarousel';
import { type CarouselProduct } from '@/lib/shop/carouselProducts';
import type { LandingBookingData } from '@/lib/landing/landingBookingData';
import { getLandingDemoBookingFallback } from '@/lib/landing/landingDemoBookingFallback';
import type { LandingBarber } from '@/lib/landing/liveTimelineData';
import { useFeature261StaggerReveal } from '@/lib/landing/useFeature261StaggerReveal';
import { cn } from '@/lib/utils';

interface Feature261Props {
  className?: string;
  retailProducts?: CarouselProduct[];
  barbers?: LandingBarber[];
  bookingData?: LandingBookingData;
}

type FeatureRowData = {
  kicker: string;
  heading: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  media: 'image' | 'carousel' | 'widget' | 'booking';
  src?: string;
  alt?: string;
  imageClassName?: string;
  imgWidth?: number;
  imgHeight?: number;
  loading?: 'eager' | 'lazy';
};

const rows: FeatureRowData[] = [
  {
    kicker: 'BOOKING OVERVIEW',
    heading: "Chairs, statuses, what's next—plus the pulse when you need it.",
    description:
      "Timeline, statuses and today's pulse in one signed-in view. See who's in the chair, what's coming up and how the day is tracking without jumping between screens.",
    ctaLabel: 'See the timeline',
    ctaHref: adminDemoHref('timeline'),
    media: 'widget',
  },
  {
    kicker: 'CLIENT BOOKING',
    heading: 'Service, barber, time—your URL, your brand, not their app.',
    description:
      'Clients pick a service, barber and slot on your domain in three taps. No app-store detour, no marketplace tile—just your brand, end to end.',
    ctaLabel: 'See the booking flow',
    ctaHref: '/book',
    media: 'booking',
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
];

type FeatureRowProps = FeatureRowData & {
  reverse?: boolean;
  retailProducts?: CarouselProduct[];
  barbers?: LandingBarber[];
  bookingData: LandingBookingData;
};

function FeatureRow({
  kicker,
  heading,
  description,
  ctaLabel,
  ctaHref,
  media,
  reverse = false,
  retailProducts = [],
  barbers = [],
  bookingData,
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
            previewMode={true}
          />
        </div>
      ) : media === 'widget' ? (
        <div className="feature261__media feature261__media--widget">
          <InsideSystemLiveWidget barbers={barbers} />
        </div>
      ) : media === 'booking' ? (
        <div className="feature261__media feature261__media--widget">
          <LandingBookingWidget
            services={bookingData.services}
            barbers={bookingData.barbers}
            shopDetails={bookingData.shopDetails}
          />
        </div>
      ) : null}

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

const Feature261 = ({
  className,
  retailProducts = [],
  barbers = [],
  bookingData,
}: Feature261Props) => {
  const sectionRef = useFeature261StaggerReveal();
  const resolvedBookingData = bookingData ?? getLandingDemoBookingFallback();

  return (
    <section ref={sectionRef} className={cn('feature261 py-32', className)}>
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
              barbers={row.media === 'widget' ? barbers : undefined}
              bookingData={resolvedBookingData}
            />
          ))}
          <Feature261MonetizationRow reverse />
        </ul>
        <Feature261MoreIncluded />
      </div>
    </section>
  );
};

export { Feature261 };
