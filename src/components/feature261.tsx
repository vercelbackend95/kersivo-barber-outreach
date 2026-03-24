import type { ReactNode } from "react";
import { Zap } from "@/components/lucide-react";
import { cn } from "@/lib/utils";


import { Card, CardContent } from "@/components/ui/card";

interface Feature261Props {
  className?: string;
}

interface TextFeatureCardProps {
  eyebrow: string;
  title: string;
  description: string;
  backgroundWord: string;
  meta: [string, string, string];
  icon: ReactNode;
  className?: string;
    variant?: "compact" | "tall";
}


const TIMELINE_FOOTER_HEIGHT = "5.5rem";
const FEATURE_CARD_FOOTER_HEIGHT = "5.5rem";

const SetupIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="feature261-text-card__icon-svg">
    <path d="M4 7.5h16" />
    <path d="M7.5 4v7" />
    <path d="M6 14h12" />
    <path d="M8.5 14v6" />
    <path d="M15.5 10v10" />
  </svg>
);

const ProductsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="feature261-text-card__icon-svg">
    <path d="M6 8.5h12l-1 11.5H7L6 8.5Z" />
    <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    <path d="M9.5 13h5" />
    <path d="M12 10.5v5" />
  </svg>
);

const AdminIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="feature261-text-card__icon-svg">
    <path d="M4 6h16" />
    <path d="M4 12h10" />
    <path d="M4 18h16" />
    <path d="M17 10l3 3-3 3" />
  </svg>
);

const TextFeatureCard = ({
  eyebrow,
  title,
  description,
  backgroundWord,
  meta,
  icon,
  className,
    variant = "compact",
}: TextFeatureCardProps) => {
  return (
    <Card className={cn("feature261-text-card rounded-3xl", className)}>
      <CardContent
        className={cn(
          "feature261-text-card__content",
          variant === "tall" && "feature261-text-card__content--tall",
        )}
      >
        <div className="feature261-text-card__frame" aria-hidden="true" />
        <div className="feature261-text-card__topbar" aria-hidden="true" />
        <div className="feature261-text-card__corner" aria-hidden="true" />
        <span className="feature261-text-card__background-word" aria-hidden="true">
          {backgroundWord}
        </span>

        <div className="feature261-text-card__header">
          <span className="feature261-text-card__eyebrow">{eyebrow}</span>
          <span className="feature261-text-card__icon">{icon}</span>
        </div>

        <div className="feature261-text-card__body">
          <h3 className="feature261-text-card__title">{title}</h3>
          <p className="feature261-text-card__description">{description}</p>
        </div>

        <div className="feature261-text-card__meta" aria-label={`${title} highlights`}>
          {meta.map((item) => (
            <span key={item} className="feature261-text-card__tag">
              {item}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};


const Feature261 = ({ className }: Feature261Props) => {
  const timelineImagePosition = "center 0%";
  const servicesImagePosition = "center 0%";
  return (
    <section className={cn("feature261 py-32", className)}>
      <div className="container">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
          <div className="feature261-primary-card relative h-60 overflow-hidden rounded-3xl md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full">
            <img
              src="/hero-assets/screens/timeline.png"
              alt="Barber bookings timeline"
              className="absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: TIMELINE_FOOTER_HEIGHT,
                height: `calc(100% - ${TIMELINE_FOOTER_HEIGHT})`,
                objectPosition: timelineImagePosition,
              }}

            />
            <div className="feature261-primary-card__image-overlay absolute inset-x-0 top-0" />
            <div className="feature261-primary-card__footer absolute inset-x-0 bottom-0 z-10 text-white">
              <div className="feature261-primary-card__footer-inner">
                <span className="feature261-primary-card__eyebrow">Booking dashboard</span>
                <p className="feature261-primary-card__title">Experience Design Excellence.</p>
              </div>
            </div>
            <div className="absolute right-6 top-6 z-10">
              <div className="feature261-primary-card__badge flex h-10 w-10 items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="feature261-footer-card feature261-mobile-feature-card relative h-60 overflow-hidden rounded-3xl border md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full">
            <img
              src="/hero-assets/screens/1.jpg"
              alt="Booking flow screen"
              className="feature261-bento-image feature261-bento-image--booking absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(100% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
              }}

            />
            <div className="feature261-primary-card__image-overlay absolute inset-x-0 top-0" />
            <div className="feature261-primary-card__footer absolute inset-x-0 bottom-0 z-10 text-white">
              <div className="feature261-primary-card__footer-inner">
                <span className="feature261-primary-card__eyebrow">Design system</span>
                <p className="feature261-primary-card__title feature261-primary-card__title--wide">
                  Build your interface with stunning components and modern design.
                </p>
              </div>
            </div>
          </div>
          <TextFeatureCard
            eyebrow="Custom setup"
            title="Your rules"
            description="Add your own barbers, services and pricing."
            backgroundWord="Setup"
            meta={["Barbers", "Services", "Pricing"]}
            icon={<SetupIcon />}
            className="col-span-1 md:col-span-2 md:row-span-1 md:h-[192px] lg:col-span-2 lg:h-[220px]"
          />

          <TextFeatureCard
            eyebrow="Retail control"
            title="Add products"
            description="Build a shop that fits your barbershop."
            backgroundWord="Store"
            meta={["Stock", "Shop", "Checkout"]}
            icon={<ProductsIcon />}
            className="col-span-1 md:col-span-2 md:row-span-1 md:h-[192px] lg:col-span-2 lg:h-[220px]"
          />

          <Card className="feature261-footer-card feature261-mobile-feature-card relative col-span-1 h-60 overflow-hidden rounded-3xl bg-muted md:col-span-4 md:row-span-1 md:h-[300px] lg:col-span-4">
            <img
              src="/hero-assets/screens/3.jpg"
              alt="Barbers management screen"
              className="feature261-bento-image feature261-bento-image--barbers absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(100% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
              }}

            />
            <div className="feature261-primary-card__image-overlay absolute inset-x-0 top-0" />
            <div className="feature261-primary-card__footer absolute inset-x-0 bottom-0 z-10 text-white">
              <div className="feature261-primary-card__footer-inner">
                <span className="feature261-primary-card__eyebrow">Expert barbers</span>
                <p className="feature261-primary-card__title feature261-primary-card__title--wide">
                  Skilled professionals delivering sharp cuts, beard trims, and a premium
                  barbershop experience.
                </p>
              </div>
                          </div>
          </Card>
          <TextFeatureCard
            eyebrow="Daily ops"
            title="Less admin"
            description="Bookings, shop and day-to-day control in one place."
            backgroundWord="Control"
            meta={["Bookings", "Store", "Daily flow"]}
            icon={<AdminIcon />}
            className="col-span-1 md:col-span-2 md:row-span-1 md:h-[300px] lg:col-span-3 lg:h-[300px]"
            variant="tall"

          />

          <Card className="feature261-footer-card feature261-mobile-feature-card relative col-span-1 h-60 overflow-hidden rounded-3xl md:col-span-3 md:row-span-1 md:h-[300px] lg:col-span-5">
            <img
              src="/hero-assets/screens/2.jpg"
              alt="Barber retail store screen"
              className="feature261-bento-image feature261-bento-image--shop absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(100% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
              }}

            />
            <div className="feature261-primary-card__image-overlay absolute inset-x-0 top-0" />
            <div className="feature261-primary-card__footer absolute inset-x-0 bottom-0 z-10 text-white">
              <div className="feature261-primary-card__footer-inner">
                <span className="feature261-primary-card__eyebrow">Barbershop atmosphere</span>
                <p className="feature261-primary-card__title feature261-primary-card__title--wide">
                  Step into a clean, bold space built for premium grooming and effortless client comfort.
                </p>
              </div>
            </div>
          </Card>
          <Card className="feature261-footer-card feature261-mobile-feature-card relative col-span-1 h-60 overflow-hidden rounded-3xl md:col-span-3 md:row-span-1 md:h-[300px] lg:col-span-4">
            <img
              src="/hero-assets/screens/4.jpg"
              alt="Barbershop services overview"
              className="absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(95% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
                objectPosition: servicesImagePosition,
              }}

            />
            <div className="feature261-primary-card__image-overlay absolute inset-x-0 top-0" />
            <div className="feature261-primary-card__footer absolute inset-x-0 bottom-0 z-10 text-white">
              <div className="feature261-primary-card__footer-inner">
                <span className="feature261-primary-card__eyebrow">Barber services</span>
                <p className="feature261-primary-card__title feature261-primary-card__title--wide">
                  From skin fades to beard sculpting, every service is presented with clarity and premium detail.

                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export { Feature261 };
