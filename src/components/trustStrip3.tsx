import { cn } from '@/lib/utils';

interface PillarItem {
  heading: string;
  body: string;
}

interface TrustStrip3Props {
  pillars?: PillarItem[];
  className?: string;
}

const DEFAULT_PILLARS: PillarItem[] = [
  {
    heading: 'No barber limit',
    body: 'Few chairs or a big floor—the stack scales. We don’t cap your roster.',
  },
  {
    heading: 'Your domain',
    body: 'Book and sell on your URL. Your traffic, your client list.',
  },
  {
    heading: 'One admin',
    body: 'Team, bookings, pickup orders, reports—one login.',
  },
  {
    heading: '£0 booking fees · no shop cut',
    body: 'We don’t take a cut on bookings or retail. Shop cards: Stripe. GBP pricing.',
  },
];

const TrustStrip3 = ({ pillars = DEFAULT_PILLARS, className }: TrustStrip3Props) => {
  return (
    <section
      className={cn('trust-strip3', className)}
      aria-label="Who this system is built for"
    >
      <div className="container">
        <ul className="trust-strip3__list" role="list">
          {pillars.map((pillar) => (
            <li key={pillar.heading} className="trust-strip3__item">
              <p className="trust-strip3__heading">{pillar.heading}</p>
              <p className="trust-strip3__body">{pillar.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export { TrustStrip3 };
