import { cn } from '@/lib/utils';

interface Feature261Props {
  className?: string;
}

const Feature261 = ({ className }: Feature261Props) => {
  return (
    <section className={cn('feature261', className)}>
      <div className="container">
        <div className="feature261__grid">
          <article className="feature261__tile feature261__tile--hero">
            <img
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/photos/Minimalist Concrete Wall with Shadows.jpeg"
              alt="shadcn UI components showcase"
              className="feature261__image"
            />
            <div className="feature261__hero-text">
              <p>Experience Design Excellence.</p>
            </div>
            <div className="feature261__icon-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14a1 1 0 0 1-.78-1.63l9-11A1 1 0 0 1 14 2v7h6a1 1 0 0 1 .78 1.63l-9 11A1 1 0 0 1 10 21v-7z" />
              </svg>
            </div>
          </article>

          <article className="feature261__tile feature261__tile--copy">
            <img
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
              alt="shadcn UI component library"
              className="feature261__image"
            />
            <div className="feature261__copy-wrap">
              <h2>Build your interface with stunning components and modern design.</h2>
            </div>
          </article>

          <article className="feature261__tile feature261__tile--stat">
            <div className="feature261__pad feature261__stack-center">
              <p className="feature261__metric">95<span>%</span></p>
              <p className="feature261__small">Developers choose us<br />for our exceptional quality</p>
            </div>
          </article>

          <article className="feature261__tile feature261__tile--image-short">
            <img
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-2.svg"
              alt="shadcn UI components"
              className="feature261__image"
            />
          </article>

          <article className="feature261__tile feature261__tile--price">
            <div className="feature261__pad feature261__stack-end">
              <p className="feature261__price">$299</p>
              <p className="feature261__muted">Premium Component Library</p>
              <button type="button" className="feature261__btn">Buy Now</button>
            </div>
          </article>

          <article className="feature261__tile feature261__tile--avatars">
            <div className="feature261__pad feature261__stack-center">
              <p className="feature261__metric">300<span>+</span></p>
              <p className="feature261__small">Delighted developers</p>
              <div className="feature261__avatar-row" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="feature261__avatar">
                    <img src={`https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-${i + 1}.webp`} alt="" />
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="feature261__tile feature261__tile--wide-image">
            <img
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-3.svg"
              alt="shadcn UI components"
              className="feature261__image"
            />
          </article>

          <article className="feature261__tile feature261__tile--overlay">
            <img
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/photos/Geometric Staircase and Concrete Wall.jpeg"
              alt="shadcn UI development"
              className="feature261__image"
            />
            <div className="feature261__overlay" />
            <div className="feature261__overlay-content">
              <div className="feature261__overlay-title">
                <span className="feature261__overlay-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <strong>Rapid Development</strong>
              </div>
              <p>Build your interface faster<br /><span>with ready-to-use components</span></p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export { Feature261 };
