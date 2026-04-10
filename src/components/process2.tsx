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
      title: "Discovery & setup",
      timeline: "Day 1",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img11.png",
      whatHappens:
        "We pull together your logo, photos, service list, who's on the team, opening hours, and how you want clients to book. Buy-and-collect retail ships with the system—you'll add and manage products in your own admin when we're done; here we just agree what should feel ready for opening day.",
      deliverable:
        "A clear, short plan you sign off on—so when we build, nobody's guessing what \"done\" looks like.",
    },
    {
      step: "02",
      title: "Build & wiring",
      timeline: "Days 2–10",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img12.png",
      whatHappens:
        "We build your public site, the booking flow clients use, the admin you run daily, and the retail pickup flow—already wired together, not three tools stuck on afterwards.",
      deliverable: "A working version you can click through yourself, from a client's first visit to what you see behind the scenes.",
    },
    {
      step: "03",
      title: "Review & sign-off",
      timeline: "Days 11–12",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img10.png",
      whatHappens:
        "You use it like a real week in the shop and send honest notes. We tweak layout, wording, and the customer journey until it feels right for your team and your clients.",
      deliverable: "Your green light on the version we'll take live.",
    },
    {
      step: "04",
      title: "Launch & handover",
      timeline: "Days 13–14",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img9.png",
      whatHappens:
        "We connect your domain, run final checks, then walk you through day-to-day life in the system—bookings, pickup orders, your team, and where to see the numbers when you want them—so launch day feels familiar, not frantic.",
      deliverable: "Your site live on your own URL, simple handover notes, and your admin access ready to use.",
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
              Our process
            </h1>
            <p className="text-base text-foreground/50">
              You&apos;ve already seen what&apos;s inside—here&apos;s how we get you live. Four clear stages from kickoff to
              launch: client booking, buy-and-collect retail, and your back office, together on your own site.               Most UK
              shops go live in about 14 days; we give you a straight checklist so you always know what we need next.
            </p>
            <div className="process2-image-frame relative h-90 overflow-hidden border">
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
          <span className="sr-only">
            Step {index + 1} of 4:{" "}
          </span>
          {step.title}
        </h3>
        <p className="text-sm font-medium uppercase tracking-wide text-foreground/70">
          Timeline: {step.timeline}
        </p>
        <p className="text-foreground/50">What we do: {step.whatHappens}</p>
        <p className="text-foreground/70">What you get: {step.deliverable}</p>
      </div>
    </li>
  );
};

export { Process2 };