"use client";

import { useInView } from "@/lib/framer-motion";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";


const usePrevious = <T,>(value: T): T | undefined => {
  const [prev, setPrev] = useState<T | undefined>(undefined);
  const ref = useRef(value);

  useEffect(() => {
    setPrev(ref.current);
    ref.current = value;
  }, [value]);

  return prev;
};

interface Process2Props {
  className?: string;
}

const Process2 = ({ className }: Process2Props) => {
  const process = [
    {
      step: "01",
      title: "Discovery & Setup",
      timeline: "Day 1",

      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img11.png",
      whatHappens:
        "We collect your services, team setup, brand assets, and booking rules to map the right structure.",
      deliverable: "Approved project brief + exact build plan.",

    },
    {
      step: "02",
      title: "Build & Content",
      timeline: "Days 2–6",

      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img12.png",
      whatHappens:
        "We build your booking pages, service structure, and key conversion sections around your offer.",
      deliverable: "First full working draft of your website system.",

    },
    {
      step: "03",
      title: "Review & Refinement",
      timeline: "Days 7–10",

      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img10.png",
      whatHappens:
        "You send feedback and we tighten layout, copy blocks, and customer flow before sign-off.",
      deliverable: "Final pre-launch version approved by you.",

    },
    {
      step: "04",
      title: "Launch & Handover",
      timeline: "Days 11–14",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img9.png",
      whatHappens:
        "We connect your domain, run launch checks, and prepare a practical admin walkthrough.",
      deliverable: "Live website + handover guide + admin access instructions.",

    },
  ];

  const [active, setActive] = useState<number>(0);
  const previousActive = usePrevious(active);

  return (
    <section className={cn("process2 py-32", className)}>
      <div className="container">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-20">
          <div className="top-10 h-fit w-fit gap-3 space-y-7 py-8 lg:sticky">
            <h1 className="relative w-fit text-5xl font-semibold tracking-tight lg:text-7xl">
              Our Process
            </h1>
            <p className="text-base text-foreground/50">
              A clear 4-step delivery plan built for busy UK barber teams.
            </p>
            <div className="relative h-90 overflow-hidden border">
              {previousActive !== undefined && (
                <div className="absolute top-0 h-full w-full">
                  <img
                    src={process[previousActive].image}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                </div>
              )}
              <div key={active} className="process2-image-reveal h-full w-full">
                <img
                  src={process[active].image}
                  className="h-full w-full object-cover"
                  alt=""
                />
              </div>
            </div>
          </div>
          <ul className="relative w-full lg:pl-22">
            {process.map((step, index) => (
              <ProcessCard
                key={index}
                step={step}
                index={index}
                setActive={setActive}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const ProcessCard = ({
  step,
  index,
  setActive,
}: {
  step: {
    step: string;
    title: string;
        timeline: string;
    image: string;
    whatHappens: string;
    deliverable: string;

  };
  index: number;
  setActive: (index: number) => void;
}) => {
  const ref = useRef<HTMLLIElement>(null);

  const itemInView = useInView(ref, {
    amount: 0,
    margin: "0px 0px -60% 0px",
  });

  useEffect(() => {
    if (itemInView) {
      setActive(index);
    }
  }, [itemInView, index, setActive]);

  return (
    <li
      ref={ref}
      key={index}
      className="relative flex flex-col justify-between gap-12 border-b py-8 lg:py-16"
    >
      <div className="flex w-fit items-center justify-center px-4 py-1 text-9xl tracking-tighter">
        0{index + 1}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-semibold tracking-tighter lg:text-3xl">
          Step {index + 1} — {step.title}

        </h3>
        <p className="text-sm font-medium uppercase tracking-wide text-foreground/70">
          Timeline: {step.timeline}
        </p>
        <p className="text-foreground/50">What happens: {step.whatHappens}</p>
        <p className="text-foreground/70">You get: {step.deliverable}</p>
      </div>
    </li>
  );
};

export { Process2 };