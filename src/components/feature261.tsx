import { Zap } from "@/components/lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

interface Feature261Props {
  className?: string;
}
const TIMELINE_FOOTER_HEIGHT = "5.5rem";
const FEATURE_CARD_FOOTER_HEIGHT = "5.5rem";
const Feature261 = ({ className }: Feature261Props) => {
  const timelineImagePosition = "center 0%";
  const bookingImagePosition = "center 0%";
  const barbersImagePosition = "center 0%";
  const shopImagePosition = "center 0%";
  const servicesImagePosition = "center 0%";
  return (
    <section className={cn("feature261 py-32", className)}>
      <div className="container">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
          <div className="feature261-primary-card feature261-mobile-tall-card relative h-60 overflow-hidden rounded-3xl md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full">
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

          <div className="feature261-footer-card feature261-mobile-tall-card relative h-60 overflow-hidden rounded-3xl border md:col-span-2 md:row-span-2 md:h-[400px] lg:col-span-4 lg:h-full">
            <img
              src="/hero-assets/screens/booking.jpg"
              alt="Booking flow screen"
              className="absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(100% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
                objectPosition: bookingImagePosition,
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

          <Card className="col-span-1 rounded-3xl md:col-span-2 md:row-span-1 md:h-[192px] lg:col-span-2">
            <CardContent className="flex h-full flex-col justify-center p-4 md:p-6">
              <div className="mb-2 text-4xl font-bold md:text-4xl lg:text-6xl">
                95
                <span className="align-top text-2xl md:text-xl lg:text-3xl">%</span>
              </div>
              <p className="text-sm leading-tight md:text-sm">
                Developers choose us
                <br />
                for our exceptional quality
              </p>
            </CardContent>
          </Card>

          <div className="relative col-span-1 h-60 overflow-hidden rounded-3xl border md:col-span-2 md:row-span-1 md:h-[192px] lg:col-span-2">
            <img
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-2.svg"
              alt="shadcn UI components"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <Card className="feature261-footer-card feature261-mobile-tall-card relative col-span-1 h-60 overflow-hidden rounded-3xl bg-muted md:col-span-4 md:row-span-1 md:h-[300px] lg:col-span-4">
            <img
              src="/hero-assets/screens/barbers.jpg"
              alt="Barbers team at work"
              className="absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(100% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
                objectPosition: barbersImagePosition,
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

          <Card className="col-span-1 rounded-3xl md:col-span-2 md:row-span-1 md:h-[300px] lg:col-span-3">
            <CardContent className="flex h-full flex-col justify-center p-4 md:p-5">
              <div className="mb-3">
                <span className="text-4xl font-bold md:text-3xl lg:text-6xl">300</span>
                <span className="align-top text-2xl font-bold md:text-xl lg:text-3xl">+</span>
              </div>
              <p className="mb-4 text-sm md:text-sm">Delighted developers</p>
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Avatar
                    key={i}
                    className="h-8 w-8 border-2 border-border md:h-8 md:w-8 lg:h-10 lg:w-10"
                  >
                    <AvatarImage
                      src={`https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-${i + 1}.webp`}
                    />
                    <AvatarFallback>DEV{i}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="feature261-footer-card feature261-mobile-tall-card relative col-span-1 h-60 overflow-hidden rounded-3xl md:col-span-3 md:row-span-1 md:h-[300px] lg:col-span-5">
            <img
              src="/hero-assets/screens/shop.jpg"
              alt="Barbershop interior"
              className="absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(100% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
                objectPosition: shopImagePosition,
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
          <Card className="feature261-footer-card feature261-mobile-tall-card relative col-span-1 h-60 overflow-hidden rounded-3xl md:col-span-3 md:row-span-1 md:h-[300px] lg:col-span-4">
            <img
              src="/hero-assets/screens/services.jpg"
              alt="Barbershop services overview"
              className="absolute inset-x-0 top-0 w-full object-cover"
              style={{
                bottom: FEATURE_CARD_FOOTER_HEIGHT,
                height: `calc(100% - ${FEATURE_CARD_FOOTER_HEIGHT})`,
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