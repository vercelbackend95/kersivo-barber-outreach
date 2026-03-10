

import { cn } from '@/lib/utils';

interface TrustStrip3Props {
  valuePoints?: string[];
  className?: string;
}

const DEFAULT_VALUE_POINTS = [
  'Online bookings built in',
  'Barber schedules in one place',
  'Shop & pickup ready',
  'Easy admin updates',

];

const TrustStrip3 = ({ valuePoints = DEFAULT_VALUE_POINTS, className }: TrustStrip3Props) => {
  return (
    <section className={cn('trust-strip3', className)} aria-label="Barber system value points">
      <div className="container">
        <ul className="trust-strip3__list" role="list">
          {valuePoints.map((point) => (
            <li key={point} className="trust-strip3__item">
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export { TrustStrip3 };
