import {
  FEATURE261_MORE_INCLUDED_LABEL,
  FEATURE261_MORE_INCLUDED_PILLS,
} from '@/lib/landing/feature261MoreIncluded';

function Feature261MoreIncluded() {
  return (
    <div className="feature261__more-included">
      <p className="feature261__more-included-label">{FEATURE261_MORE_INCLUDED_LABEL}</p>
      <ul className="feature261__more-included-pills" role="list">
        {FEATURE261_MORE_INCLUDED_PILLS.map((pill) => (
          <li key={pill} className="feature261__more-included-pill">
            {pill}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { Feature261MoreIncluded };
