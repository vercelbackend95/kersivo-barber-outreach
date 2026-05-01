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
    heading: '0% commission from us',
    body: 'Every booking and product sale reaches you at full value. No platform cut — Stripe applies only to online card payments.',
  },
  {
    heading: 'Deposits reduce no-shows',
    body: 'Require a deposit when booking is made. Clients commit financially — empty chairs drop and filled slots are paid.',
  },
  {
    heading: 'Automations recover revenue',
    body: 'Automated SMS reminders, old-client win-back campaigns, and post-visit review requests run on schedule — no staff time required.',
  },
  {
    heading: 'Switch handled for you',
    body: 'We build your system while you stay live on Booksy/Fresha, then handle the go-live switch. No downtime, no lost bookings.',
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
