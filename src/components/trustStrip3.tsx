import { cn } from '@/lib/utils';

interface PillarItem {
  heading: string;
  body: string;
}

interface TrustStrip3Props {
  pillars?: PillarItem[];
  className?: string;
}

/** ORPHANED defaults — not on live homepage. Softened (Claims Audit 13 Jul 2026). */
const DEFAULT_PILLARS: PillarItem[] = [
  {
    heading: '0% Kersivo commission',
    body: 'Every booking and product sale reaches you without a Kersivo cut — Stripe applies only to online card payments.',
  },
  {
    heading: 'Deposits reduce no-shows',
    body: 'Require a deposit when booking is made. Clients commit financially — empty chairs drop and filled slots are paid.',
  },
  {
    heading: 'Email reminders protect the diary',
    body: 'Email appointment confirmations and reminders are included in Care. Automated SMS can be agreed at setup if you need it for launch.',
  },
  {
    heading: 'Switch handled for you',
    body: 'We build your system while you stay live on your current booking platform, then help move the public booking link when ready.',
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
