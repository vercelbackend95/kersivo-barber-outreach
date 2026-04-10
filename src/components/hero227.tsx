import { motion } from "framer-motion";
import { Copy, Globe, ShieldCheck } from "lucide-react";
import React from "react";

import VerticalCutReveal from "@/components/fancy/components/text/vertical-cut-reveal";
import { Button } from "@/components/ui/button";
import { useGoogleFont } from "@/hooks/use-google-font";
import { cn } from "@/lib/utils";

interface Hero227Props {
  className?: string;
}

const Hero227 = ({ className }: Hero227Props) => {
  useGoogleFont("Antonio");
  return (
    <section
      className={cn("bg-background py-32", className)}
      style={
        {
          "--font-antonio": "Antonio",
        } as React.CSSProperties
      }
    >
      <div className="border-b border-muted-foreground/40">
        <div className="container flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center justify-center gap-2 text-xs font-medium tracking-tight text-primary/40 md:text-lg">
              <Copy className="size-4" />
              Copy paste blocks
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-medium tracking-tight text-primary/40 md:text-lg">
              <ShieldCheck className="size-4" />
              Built by Experts
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-medium tracking-tight text-primary/40 md:text-lg">
              <Globe className="size-4 animate-spin" />
              Works Everywhere
            </div>
          </div>
          <div className="relative">
            <h1 className="font-antonio text-5xl font-extrabold tracking-tight text-foreground uppercase md:text-9xl">
              <VerticalCutReveal>New Shadcn Blocks</VerticalCutReveal>
            </h1>
            <Asterisk className="absolute -top-2 -right-6 size-5 md:size-10 lg:-right-14" />
          </div>
          <p className="max-w-xl text-muted-foreground/80">
            Lorem ipsum dolor sit, amet consectetur adipisicing elit. Ipsum
            animi, ipsam provident optio delectus neque aliquid cumque. Beatae,
            odio!
          </p>
          <div className="flex rounded-3xl bg-muted-foreground/10 p-1.5">
            <Button className="text-md flex h-full items-center justify-center rounded-2xl font-medium">
              Get Started
            </Button>
            <Button
              variant="ghost"
              className="text-md flex h-full items-center justify-center rounded-2xl font-medium opacity-40"
            >
              No Credit Card Required
            </Button>
          </div>

          {/* Iphone mockup — screen content is clipped + scaled to the glass area; frame sits on top */}
          <div className="relative flex w-full justify-center overflow-x-hidden pb-6 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 200, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ease: [0, 0.71, 0.2, 1.01], duration: 0.8 }}
              className="relative mx-auto mt-6 aspect-[400/850] w-[min(100%,360px)] overflow-hidden rounded-[75px] bg-black md:mt-10 md:w-[400px]"
            >
              {/* Bezel + screen cutout: inner UI only inside this box */}
              <div className="absolute inset-[9%_6%_10%_6%] z-[1] overflow-hidden rounded-[2rem] bg-black md:inset-[9%_5.5%_10%_5.5%] md:rounded-[2.25rem]">
                <div className="flex h-full min-h-0 flex-col px-3 pt-5 sm:px-4 sm:pt-6">
                  <div className="flex shrink-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-end gap-1.5">
                      <span className="truncate text-2xl font-semibold leading-none tracking-tight text-white sm:text-3xl">
                        Mon
                      </span>
                      <span className="mb-0.5 size-2 shrink-0 rounded-full bg-red-500 sm:mb-1 sm:size-2.5" />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] leading-tight tracking-tight text-zinc-400 sm:text-xs">Feburary 9</p>
                      <p className="-mt-0.5 text-xs font-semibold tracking-tighter text-zinc-500 sm:text-sm">2025</p>
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 items-start justify-center pt-4 sm:pt-5">
                    <img
                      className="h-auto w-[55%] max-w-[9rem] object-contain"
                      alt=""
                      src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/block-white-1.svg"
                    />
                  </div>
                </div>
              </div>
              <img
                className="pointer-events-none absolute inset-0 z-[2] h-full w-full select-none object-contain"
                alt=""
                src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mockups/phone-5.png"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Hero227 };

const Asterisk = (props: React.ComponentProps<typeof motion.svg>) => {
  return (
    <motion.svg
      initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      transition={{ duration: 0.5, bounce: 0.4, type: "spring", delay: 0.6 }}
      {...props}
      viewBox="0 0 45 45"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16.6294 44.8574L18.9282 29.0791L6.44141 38.9536L0.380859 28.5044L14.6963 22.3916L0.380859 16.6968L6.44141 6.24756L18.876 15.5996L16.6294 0.34375H28.7505L26.9219 15.2861L38.9385 6.24756L44.999 16.6968L30.6313 22.3916L44.999 28.5044L38.9385 38.9536L26.8696 29.4448L28.7505 44.8574H16.6294Z"
        fill="#FF0000"
      />
    </motion.svg>
  );
};
