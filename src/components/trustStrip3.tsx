

import { cn } from '@/lib/utils';
interface ValuePoint {
  desktop: string;
  mobile?: string;
}


interface TrustStrip3Props {
  valuePoints?: ValuePoint[];
  className?: string;
}
const DEFAULT_VALUE_POINTS: ValuePoint[] = [
  {
    desktop: 'Booking flow built in',
    mobile: 'Booking flow built in',
  },
  {
    desktop: 'Barber schedules in one place',
    mobile: 'Barber schedules in one place',
  },
  {
    desktop: 'Retail & pickup ready',
        mobile: 'Retail & pickup ready',
  },
  {
    desktop: 'Easy updates across the site',
        mobile: 'Easy updates across the site',
  },

];

const TrustStrip3 = ({ valuePoints = DEFAULT_VALUE_POINTS, className }: TrustStrip3Props) => {
  return (
    <section className={cn('trust-strip3', className)} aria-label="Barber system value points">
      <div className="container">
        <ul className="trust-strip3__list" role="list">
          {valuePoints.map((point) => (
            <li key={point.desktop} className="trust-strip3__item">
              <span className="trust-strip3__label trust-strip3__label--desktop">{point.desktop}</span>
              <span className="trust-strip3__label trust-strip3__label--mobile">{point.mobile ?? point.desktop}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export { TrustStrip3 };
