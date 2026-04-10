"use client";
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
      data-hero227=""
      className={cn("hero227-root bg-background py-32", className)}
      style={
        {
          "--font-antonio": "Antonio",
        } as React.CSSProperties
      }
    >
      <div className="border-b border-muted-foreground/40">
        <div className="hero227-inner flex flex-col items-center justify-center gap-4 text-center">
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
          <div className="relative h-[500px] w-full overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 200, scale: 0.8 }}
              animate={{ opacity: 100, y: 0, scale: 1 }}
              transition={{ ease: [0, 0.71, 0.2, 1.01], duration: 0.8 }}
              className="hero227-mock relative mx-auto mt-6 flex h-[850px] w-[400px] items-center justify-center rounded-[75px] bg-black md:mt-12 md:h-[920px] md:w-[450px]"
            >
              <img
                className="absolute z-2 scale-105 object-cover"
                alt="Gold phone frame"
                src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mockups/phone-5.png"
              />
              <div className="h-full w-full">
                <div className="mt-20 flex justify-between px-0">
                  <h1 className="flex items-end gap-2 px-12 text-5xl font-semibold tracking-tight text-background md:text-6xl">
                    Mon
                    <div className="mb-2 size-3 rounded-full bg-red-500 md:size-5" />
                  </h1>
                  <div className="mt-2 mr-8 flex flex-col items-end">
                    <p className="text-lg tracking-tight text-muted-foreground md:text-xl">
                      Feburary 9
                    </p>
                    <p className="-mt-1 text-xl font-semibold tracking-tighter text-muted-foreground/50 md:text-2xl">
                      2025
                    </p>
                  </div>
                </div>
                <img
                  className="z-2 mx-auto mt-20 size-40 object-cover"
                  alt="Gold phone frame"
                  src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/block-white-1.svg"
                />
              </div>
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
