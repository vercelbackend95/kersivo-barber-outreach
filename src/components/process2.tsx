"use client";

import { useInView } from "@/lib/framer-motion";
import { CornerDownRight } from "@/components/lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

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
      title: "Intro",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img11.png",
      description:
        "We start with a short conversation to understand your barbershop, services, style and what you want the website to do for you.",
    },
    {
      step: "02",
      title: "Content & Setup",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img12.png",
      description:
        "You send over the key details — like your logo, photos, services, pricing, opening hours and products — and we shape the site structure from there.",
    },
    {
      step: "03",
      title: "Build & Review",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img10.png",
      description:
        "We build the full setup, send it over for review, and make the final changes before launch.",
    },
    {
      step: "04",
      title: "Launch & Ongoing Care",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/guri4/img9.png",
      description:
        "Once approved, we launch the site and keep everything running with hosting, updates and ongoing care.",
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
A simple 4-step setup. You send the basics — we handle the heavy lifting.
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
            <Button
                          type="button"
              data-demo-cta
              className="process2-contact-button flex items-center justify-start gap-2"
            >
              <CornerDownRight className="process2-contact-icon" />
              Get in touch
            </Button>
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
    image: string;
    description: string;
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
      <div>
        <h3 className="mb-4 text-2xl font-semibold tracking-tighter lg:text-3xl">
          {step.title}
        </h3>
        <p className="text-foreground/50">{step.description}</p>
      </div>
    </li>
  );
};

export { Process2 };