"use client";
import { motion } from "framer-motion";
import React from "react";

import VerticalCutReveal from "@/components/fancy/components/text/vertical-cut-reveal";
import { Button } from "@/components/ui/button";
import { useGoogleFont } from "@/hooks/use-google-font";
import { cn } from "@/lib/utils";

interface Hero227Props {
  className?: string;
}

const HERO_H1_LINES_DESKTOP =
  "Stop sending your clients \nto someone else's platform." as const;

const HERO_H1_LINES_MOBILE =
  "Stop sending\nyour clients\nto someone else's platform." as const;

const HERO_H1_ACCESSIBLE_LABEL =
  "Stop sending your clients to someone else's platform.";

/** Below Tailwind `md` — looser IO margin so the mock animates sooner (less empty band). */
function useHero227MockViewportMargin() {
  const [margin, setMargin] = React.useState("0px 0px -100px 0px");

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      /* Mobile: −25px od dołu IO — lżej niż −50, animacja wcześniej, mniej pustego tła */
      setMargin(mq.matches ? "0px 0px -25px 0px" : "0px 0px -100px 0px");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return margin;
}

/** Mobile: 3 short VCR lines; desktop: 2 lines — avoids 4-line word-wrap on narrow viewports. */
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

const Hero227 = ({ className }: Hero227Props) => {
  useGoogleFont("Antonio");
  const mockWhileInViewMargin = useHero227MockViewportMargin();
  const heroH1Lines = useHero227HeadlineLines();

  return (
    <section
      id="home"
      data-hero227=""
      className={cn(
        "hero227-root scroll-mt-24 bg-background pb-0 pt-8 md:pt-12",
        className,
      )}
      style={
        {
          "--font-antonio": "Antonio",
        } as React.CSSProperties
      }
    >
      <div>
        <div className="hero227-inner hero227-stack flex flex-col items-center justify-center gap-4 text-center">
          <div className="hero227-copy-layer w-full max-w-4xl md:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl px-2 sm:px-3">
            <p className="hero227-kicker">Built for independent UK barbershops</p>
            <div className="relative mx-auto w-max min-w-0 max-w-full">
              <h1
                aria-label={HERO_H1_ACCESSIBLE_LABEL}
                className="font-antonio mx-auto block w-max max-w-full text-center font-extrabold tracking-tight text-foreground text-balance hyphens-none px-1 sm:px-0 text-[clamp(2.625rem,10.5vw,3.75rem)] sm:text-[clamp(2.875rem,9vw,4.5rem)] md:text-[clamp(3rem,calc(0.75rem+7.5cqi),6.5rem)] lg:text-[clamp(3.25rem,calc(0.8rem+7cqi),7rem)] leading-[1.18] md:leading-[1.15]"
              >
                <VerticalCutReveal
                  skipScreenReaderDup
                  splitBy="lines"
                  containerClassName="hero227-heading-reveal items-center text-center"
                  wordLevelClassName="pb-[0.14em]"
                >
                  {heroH1Lines}
                </VerticalCutReveal>
              </h1>
              <HeroTitleAccent className="pointer-events-none absolute -top-1 -right-2 size-[1.125rem] min-[380px]:-right-4 min-[380px]:size-5 sm:-top-2 sm:-right-5 md:size-8 lg:size-10 lg:-right-8 xl:-right-14" aria-hidden />
            </div>
            <p className="mx-auto mt-1 max-w-2xl md:max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground/85 sm:text-base sm:leading-relaxed">
              Booking, retail and admin for UK barbershops &mdash; on your own domain, with 0%
              KERSIVO commission.
            </p>
          </div>

          <div className="hero227-mid-band w-full max-w-3xl space-y-3 px-1 sm:px-2">
            <div
              className="hero227-scenario-chip"
              role="note"
              aria-label="Example savings"
            >
              <span className="hero227-scenario-chip__label">Example</span>
              <span className="hero227-scenario-chip__body">
                4-chair shop, ~800 cuts/mo:
                {" "}
                <span className="hero227-scenario-chip__strike">~&pound;240/mo to a marketplace</span>
                {" \u2192 "}
                <span className="hero227-scenario-chip__win">&pound;0 commission on Kersivo</span>
              </span>
            </div>
            <div className="hero227-cta-pill flex flex-wrap items-center justify-center gap-3">
              <Button
                className="hero227-cta-system text-md flex h-full items-center justify-center rounded-2xl font-medium"
                asChild
              >
                <a href="#book-demo" data-demo-cta>
                  Plan My Setup
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="hero227-cta-demo text-md rounded-2xl font-medium"
                data-system-chooser-open
              >
                View Live Demo
              </Button>
            </div>
            <p className="hero227-trust-line">
              Hands-on setup. Your domain. Your client data. No KERSIVO commission.
            </p>
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
                  /* Desktop: -100px. Mobile: -25px */
                  margin: mockWhileInViewMargin,
                }}
                className="hero227-mock relative mx-auto flex shrink-0 items-center justify-center"
              >
                <div className="hero227-mock-screen-wrap">
                  <div
                    className="hero227-mock-screen"
                    role="img"
                    aria-label="Kersivo booking preview on an iPhone screen"
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

export { Hero227 };

/** Bootstrap `bi-scissors` path (matches `public/scissors.svg`). */
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
