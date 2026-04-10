import { cn } from "@/lib/utils";

interface Feature261Props {
  className?: string;
}

type BentoVisualCardProps = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  imageClassName?: string;
  /** Intrinsic pixels — avoids wrong aspect-ratio hint when the asset is not 1520×920 */
  imgWidth?: number;
  imgHeight?: number;
  loading?: "eager" | "lazy";
  gridClassName: string;
  mobileVariant?: "tall" | "medium" | "wide";
};

function BentoVisualCard({
  src,
  alt,
  eyebrow,
  title,
  imageClassName,
  imgWidth = 1520,
  imgHeight = 920,
  loading = "lazy",
  gridClassName,
  mobileVariant = "medium",
}: BentoVisualCardProps) {
  return (
    <div
      data-feature261-card
      className={cn(
        "feature261-visual-card relative flex min-h-0 flex-col overflow-hidden md:min-h-0",
        mobileVariant === "tall" && "feature261-mobile-visual--tall",
        mobileVariant === "wide" && "feature261-mobile-visual--wide",
        mobileVariant === "medium" && "feature261-mobile-visual--medium",
        gridClassName,
      )}
    >
      <div className="feature261-visual-card__rim" aria-hidden="true" />
      <div className="feature261-visual-card__inner">
        <div className="feature261-visual-card__viewport">
          <img
            src={src}
            alt={alt}
            width={imgWidth}
            height={imgHeight}
            decoding="async"
            loading={loading}
            className={cn("feature261-visual-card__shot", imageClassName)}
          />
          <div className="feature261-visual-card__shot-fade" aria-hidden="true" />
        </div>
        <div className="feature261-visual-card__meta">
          <span className="feature261-visual-card__eyebrow">{eyebrow}</span>
          <p className="feature261-visual-card__lede">{title}</p>
        </div>
      </div>
    </div>
  );
}

const Feature261 = ({ className }: Feature261Props) => {
  return (
    <section className={cn("feature261 py-32", className)}>
      <div className="container">
        <header className="feature261__intro">
          <div className="feature261__headline-wrap">
            <p className="feature261__kicker">INSIDE THE SYSTEM</p>
            <h2 className="feature261__heading">Real screens. One stack in motion.</h2>
          </div>

          <p className="feature261__description">
            The same system you compared above—here as real UI: client booking on your domain, one admin for the floor,
            buy-and-collect retail, and booking or shop numbers without bolting on another tool.
          </p>
        </header>

        <div className="feature261__bento grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
          <BentoVisualCard
            src="/hero-assets/screens/1.png"
            imgWidth={1603}
            imgHeight={878}
            alt="Signed-in admin — bookings dashboard and day schedule"
            eyebrow="BOOKING OVERVIEW"
            title="Chairs, statuses, what's next—plus the pulse when you need it."
            imageClassName="feature261-bento-image--bookings"
            loading="eager"
            mobileVariant="tall"
            gridClassName="md:col-span-3 md:row-span-2 md:h-[400px] lg:col-span-7 lg:row-span-2 lg:h-[min(29rem,54vh)]"
          />
          <BentoVisualCard
            src="/hero-assets/screens/2.png"
            alt="Public booking — pick service, barber and time"
            eyebrow="CLIENT BOOKING"
            title="Service, barber, time—your URL, your brand, not their app."
            imageClassName="feature261-bento-image--booking"
            loading="eager"
            mobileVariant="tall"
            gridClassName="md:col-span-3 md:row-span-2 md:h-[400px] lg:col-span-5 lg:row-span-2 lg:h-[min(29rem,54vh)]"
          />
          <BentoVisualCard
            src="/hero-assets/barbers.png"
            imgWidth={1621}
            imgHeight={896}
            alt="Signed-in admin — barber roster, hours and assignments"
            eyebrow="BARBERS"
            title="Roster, hours, who offers what—grow the team in one place."
            imageClassName="feature261-bento-image--barbers"
            mobileVariant="medium"
            gridClassName="md:col-span-2 md:h-[272px] lg:col-span-4 lg:h-[min(18rem,36vh)]"
          />
          <BentoVisualCard
            src="/hero-assets/screens/5.png"
            alt="Signed-in admin — products and shop catalog"
            eyebrow="RETAIL"
            title="Catalog, orders, pickup ready—same panel as the chair."
            imageClassName="feature261-bento-image--shop"
            mobileVariant="wide"
            gridClassName="md:col-span-2 md:h-[272px] lg:col-span-4 lg:h-[min(18rem,36vh)]"
          />
          <BentoVisualCard
            src="/hero-assets/screens/6.png"
            alt="Signed-in admin — services, prices and durations"
            eyebrow="SERVICES"
            title="Price, duration, menu—what they book matches what you run."
            imageClassName="feature261-bento-image--services"
            mobileVariant="medium"
            gridClassName="md:col-span-2 md:h-[272px] lg:col-span-4 lg:h-[min(18rem,36vh)]"
          />
        </div>
      </div>
    </section>
  );
};

export { Feature261 };
