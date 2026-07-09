"use client";
import { motion } from "framer-motion";
import React from "react";

import VerticalCutReveal from "@/components/fancy/components/text/vertical-cut-reveal";
import { Button } from "@/components/ui/button";
import { useGoogleFont } from "@/hooks/use-google-font";
import { cn } from "@/lib/utils";

interface BarbershopBookingHeroProps {
  className?: string;
}

const HERO_H1_LINES_DESKTOP =
  "Barbershop Booking System \nBuilt On Your Own Domain" as const;

const HERO_H1_LINES_MOBILE =
  "Barbershop Booking \nSystem Built \nOn Your Own Domain" as const;

const HERO_H1_ACCESSIBLE_LABEL =
  "Barbershop Booking System Built On Your Own Domain";

function useHero227MockViewportMargin() {
  const [margin, setMargin] = React.useState("0px 0px -100px 0px");

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setMargin(mq.matches ? "0px 0px -25px 0px" : "0px 0px -100px 0px");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return margin;
}

function useHero227HeadlineLines() {
  const [lines, setLines] = React.useState<
    typeof HERO_H1_LINES_DESKTOP | typeof HERO_H1_LINES_MOBILE
  >(HERO_H1_LINES_DESKTOP);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setLines(mq.matches ? HERO_H1_LINES_MOBILE : HERO_H1_LINES_DESKTOP);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return lines;
}

const BarbershopBookingHero = ({ className }: BarbershopBookingHeroProps) => {
  useGoogleFont("Antonio");
  const mockWhileInViewMargin = useHero227MockViewportMargin();
  const heroH1Lines = useHero227HeadlineLines();

  return (
    <section
      id="hero"
      data-hero227=""
      className={cn(
        "hero227-root hero227-root--landing scroll-mt-24 bg-background pb-0 pt-8 md:pt-12 lg:pt-[2.65rem]",
        className,
      )}
      style={
        {
          "--font-antonio": "Antonio",
        } as React.CSSProperties
      }
    >
      <div>
        <div className="hero227-inner hero227-stack hero227-landing-grid flex flex-col items-center justify-center gap-4 text-center">
          <div className="hero227-landing-copy flex w-full flex-col items-center gap-4">
            <div className="hero227-copy-layer w-full max-w-4xl md:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl px-2 sm:px-3">
              <p className="hero227-kicker">Built for independent UK barbershops</p>
              <div className="hero227-heading-wrap relative w-full min-w-0 max-w-full">
                <h1
                  aria-label={HERO_H1_ACCESSIBLE_LABEL}
                  className="hero227-heading--landing font-antonio block w-full max-w-full font-extrabold tracking-tight text-foreground text-balance hyphens-none px-1 sm:px-0 text-[clamp(2.35rem,10vw,3.75rem)] sm:text-[clamp(2.25rem,7.5vw,3.75rem)] md:text-[clamp(2.5rem,calc(0.65rem+5.5cqi),4.25rem)] lg:text-[clamp(2.75rem,calc(0.7rem+5cqi),4.75rem)] leading-[1.18] md:leading-[1.15]"
                >
                  <VerticalCutReveal
                    skipScreenReaderDup
                    splitBy="lines"
                    containerClassName="hero227-heading-reveal hero227-heading-reveal--landing items-center text-center"
                    wordLevelClassName="pb-[0.14em]"
                  >
                    {heroH1Lines}
                  </VerticalCutReveal>
                </h1>
                <HeroTitleAccent
                  className="pointer-events-none absolute -top-2 right-2 size-6 sm:size-7 md:size-8 lg:top-0 lg:right-4 lg:size-10"
                  aria-hidden
                />
              </div>
              <p className="mx-auto mt-1 max-w-2xl md:max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground/85 sm:text-base sm:leading-relaxed">
                Booking, retail pickup and admin for UK barbershops &mdash; with 0%
                KERSIVO commission on bookings and retail.
              </p>
            </div>

            <div className="hero227-mid-band w-full max-w-3xl space-y-3 px-1 sm:px-2">
              <p className="hero227-price-line">
                Launch from &pound;199 setup + &pound;39/month Care.
              </p>
              <div className="hero227-cta-pill flex flex-wrap items-center justify-center gap-3">
                <Button
                  className="hero227-cta-system text-md flex h-full items-center justify-center rounded-2xl font-medium"
                  asChild
                >
                  <a href="#pricing" data-track="plan_my_setup_click">Plan My Setup</a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="hero227-cta-demo text-md rounded-2xl font-medium"
                  data-system-chooser-open
                  data-track="view_live_demo_click"
                >
                  View Live Demo
                </Button>
              </div>
              <p className="hero227-trust-line hero227-trust-line--landing" role="list">
                <span className="hero227-trust-line__item" role="listitem">
                  Your domain
                </span>
                <span className="hero227-trust-line__sep" aria-hidden="true">
                  ·
                </span>
                <span className="hero227-trust-line__item" role="listitem">
                  Your clients
                </span>
                <span className="hero227-trust-line__sep" aria-hidden="true">
                  ·
                </span>
                <span className="hero227-trust-line__item" role="listitem">
                  Booking + retail
                </span>
                <span className="hero227-trust-line__sep" aria-hidden="true">
                  ·
                </span>
                <span className="hero227-trust-line__item" role="listitem">
                  0% KERSIVO commission
                </span>
              </p>
            </div>
          </div>

          <div className="hero227-mock-stack relative flex w-full shrink-0 items-center justify-center overflow-visible py-8 md:py-10">
            <div className="hero227-mock-clip shrink-0">
              <motion.div
                initial={{ opacity: 0, y: 200, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ease: [0, 0.71, 0.2, 1.01], duration: 0.8 }}
                viewport={{
                  once: true,
                  amount: 0.2,
                  margin: mockWhileInViewMargin,
                }}
                className="hero227-mock relative mx-auto flex shrink-0 items-center justify-center"
              >
                <div className="hero227-mock-screen-wrap">
                  <div
                    className="hero227-mock-screen"
                    role="img"
                    aria-label="KERSIVO booking preview on an iPhone screen"
                  />
                </div>
                <img
                  className="hero227-mock-frame"
                  alt=""
                  src="/images/hero/phone-5.webp"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { BarbershopBookingHero };

/** Bootstrap `bi-scissors` path (matches the homepage hero accent). */
const SCISSORS_PATH_D =
  "M3.5 3.5c-.614-.884-.074-1.962.858-2.5L8 7.226 11.642 1c.932.538 1.472 1.616.858 2.5L8.81 8.61l1.556 2.661a2.5 2.5 0 1 1-.794.637L8 9.73l-1.572 2.177a2.5 2.5 0 1 1-.794-.637L7.19 8.61zm2.5 10a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m7 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0";

const HeroTitleAccent = (props: React.ComponentProps<typeof motion.svg>) => {
  const { className, ...rest } = props;
  return (
    <motion.svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="#dc2626"
      aria-hidden
      initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
      animate={{ opacity: 1, rotate: 25, scale: 1 }}
      transition={{ duration: 0.5, bounce: 0.4, type: "spring", delay: 0.6 }}
      className={cn("shrink-0", className)}
      {...rest}
    >
      <path d={SCISSORS_PATH_D} />
    </motion.svg>
  );
};
