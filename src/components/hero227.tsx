"use client";
import { motion } from "framer-motion";
import { ReceiptPoundSterling, ShoppingBag } from "lucide-react";
import React from "react";

import VerticalCutReveal from "@/components/fancy/components/text/vertical-cut-reveal";
import { Button } from "@/components/ui/button";
import { useGoogleFont } from "@/hooks/use-google-font";
import { cn } from "@/lib/utils";

interface Hero227Props {
  className?: string;
}

const TRUST_ROW_ITEMS = [
  { label: "Live in ~14 days", variant: "clock" as const },
  { label: "£0 booking fees", variant: "poundZero" as const },
  { label: "No shop cut from us", variant: "noCut" as const },
];

const trustGlyphStroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Dial center (12,12), face radius 8 — hands from origin toward edge. */
const HERO_TRUST_CLOCK_R = 8;
const HERO_TRUST_CLOCK_HOUR_LEN = HERO_TRUST_CLOCK_R * 0.58;
const HERO_TRUST_CLOCK_MINUTE_LEN = HERO_TRUST_CLOCK_R * 0.92;

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

function HeroTrustGlyph({ variant }: { variant: (typeof TRUST_ROW_ITEMS)[number]["variant"] }) {
  if (variant === "poundZero") {
    return (
      <ReceiptPoundSterling
        className="size-5 shrink-0"
        strokeWidth={2}
        aria-hidden
      />
    );
  }

  if (variant === "noCut") {
    return (
      <ShoppingBag
        className="size-5 shrink-0"
        strokeWidth={2}
        aria-hidden
      />
    );
  }

  return (
    <svg
      className="size-5 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r={HERO_TRUST_CLOCK_R} {...trustGlyphStroke} />
      <g transform="translate(12 12)">
        <line
          x1="0"
          y1="0"
          x2="0"
          y2={-HERO_TRUST_CLOCK_HOUR_LEN}
          {...trustGlyphStroke}
        />
        <line
          x1="0"
          y1="0"
          x2="0"
          y2={-HERO_TRUST_CLOCK_MINUTE_LEN}
          {...trustGlyphStroke}
        />
      </g>
    </svg>
  );
}

const Hero227 = ({ className }: Hero227Props) => {
  useGoogleFont("Antonio");
  const mockWhileInViewMargin = useHero227MockViewportMargin();

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
        <div className="hero227-inner flex flex-col items-center justify-center gap-4 text-center">
          <motion.div
            className="flex flex-wrap items-center justify-center gap-6 opacity-75"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.08 } },
              hidden: {},
            }}
          >
            {TRUST_ROW_ITEMS.map((item) => (
              <motion.div
                key={item.label}
                className="flex items-center justify-center gap-2 text-xs font-medium tracking-tight text-[color:var(--accent-hover)] md:text-lg"
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.38,
                      ease: [0, 0.71, 0.2, 1],
                    },
                  },
                }}
              >
                <HeroTrustGlyph variant={item.variant} />
                {item.label}
              </motion.div>
            ))}
          </motion.div>
          <div className="relative">
            <h1 className="font-antonio text-5xl font-extrabold tracking-tight text-foreground uppercase md:text-9xl">
              <VerticalCutReveal splitBy="lines">
                {
                  "Barber website — zero booking fees\nBookings, shop pickup & one admin"
                }
              </VerticalCutReveal>
            </h1>
            <HeroTitleAccent className="absolute -top-2 -right-6 size-5 md:size-10 lg:-right-14" />
          </div>
          <p className="max-w-xl text-muted-foreground/80">
            Ditch the patchwork of booking links, spreadsheets and a bolt-on shop.
            Kersivo is one barber website with client bookings, retail pickup and a
            single admin your team runs daily—with no booking fees from us.
          </p>
          <div className="hero227-cta-pill flex rounded-3xl bg-muted-foreground/10 p-1.5">
            <Button
              className="hero227-cta-system text-md flex h-full items-center justify-center rounded-2xl font-medium"
              asChild
            >
              <a href="#contact">
                <span className="md:hidden">GET STARTED</span>
                <span className="hidden md:inline">GET THE SYSTEM</span>
              </a>
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="hero227-cta-demo text-md flex h-full items-center justify-center rounded-2xl font-medium text-muted-foreground"
              data-system-chooser-open
            >
              WATCH PERFORMANCE
            </Button>
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
                    aria-label="Podgląd aplikacji na ekranie iPhone’a"
                  />
                </div>
                <img
                  className="hero227-mock-frame"
                  alt=""
                  src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mockups/phone-5.png"
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
