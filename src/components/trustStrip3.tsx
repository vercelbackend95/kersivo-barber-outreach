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
    heading: '1–5 chairs',
    body: 'Built for independent UK shops — not chains, not solo freelancers. Sized for how barbers actually operate day to day.',
  },
  {
    heading: 'Your domain',
    body: 'Clients book on your website, under your brand. No redirects to a marketplace profile or a third-party booking platform.',
  },
  {
    heading: 'One daily view',
    body: 'Bookings, barber schedules and retail orders in a single admin panel. One person can run the whole operation.',
  },
  {
    heading: 'GBP. No markup.',
    body: 'Priced in pounds. No per-booking cuts, no hidden USD rates, no percentage taken when your revenue comes in.',
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
