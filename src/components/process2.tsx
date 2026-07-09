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

/** Matches Tailwind `lg` (1024px): below that, optional imageMobile is used. */
const PROCESS_IMAGE_MOBILE_MEDIA = "(max-width: 1023px)";

type ProcessStep = {
  step: string;
  title: string;
  timeline: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  /** When set, shown below `lg` instead of `image` (desktop unchanged). */
  imageMobile?: string;
  imageMobileWidth?: number;
  imageMobileHeight?: number;
  weDo: string;
  youDo: string;
  deliverable: string;
};

const ProcessStepPicture = ({
  desktopSrc,
  mobileSrc,
  width,
  height,
  alt,
}: {
  desktopSrc: string;
  mobileSrc?: string;
  width: number;
  height: number;
  alt: string;
}) => {
  const [src, setSrc] = useState(desktopSrc);

  useEffect(() => {
    if (mobileSrc == null) {
      setSrc(desktopSrc);
      return;
    }

    const mq = window.matchMedia(PROCESS_IMAGE_MOBILE_MEDIA);
    const update = () => setSrc(mq.matches ? mobileSrc : desktopSrc);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [desktopSrc, mobileSrc]);

  return (
    <img
      src={src}
      className="h-full w-full object-cover"
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  );
};

const Process2 = ({ className }: Process2Props) => {
  const process: ProcessStep[] = [
    {
      step: "01",
      title: "Brief and plan",
      timeline: "Days 1\u20134",
      image: "/images/discoverypic.webp",
      imageMobile: "/images/Launchpic.webp",
      imageWidth: 1600,
      imageHeight: 2133,
      imageMobileWidth: 1600,
      imageMobileHeight: 1107,
      weDo:
        "Audit your current setup or build the plan from scratch, map services and team, confirm domain, deposit policy, and lock the launch date.",
      youDo:
        "Send your services list, prices, team and opening hours. If you are switching, point us at your Booksy or Fresha setup.",
      deliverable:
        "A confirmed setup plan with responsibilities, timeline, and what will be moved.",
    },
    {
      step: "02",
      title: "We build your system",
      timeline: "Days 5\u201311",
      image: "/images/Buildpic.webp",
      imageMobile: "/images/Reviewpic.webp",
      imageWidth: 1600,
      imageHeight: 1067,
      imageMobileWidth: 1600,
      imageMobileHeight: 2400,
      weDo:
        "Build the booking site on your domain, configure Stripe deposits, automated SMS reminders, win-back, and pay & collect retail \u2014 ready to run on day one.",
      youDo:
        "Stay focused on cutting hair. If you are switching, keep taking bookings on Booksy/Fresha as normal.",
      deliverable:
        "A tested system that protects margin, reduces no-shows, and automates follow-up.",
    },
    {
      step: "03",
      title: "Go live",
      timeline: "Days 12\u201314",
      image: "/images/Reviewpic.webp",
      imageMobile: "/images/Launchpic.webp",
      imageWidth: 1600,
      imageHeight: 2400,
      imageMobileWidth: 1600,
      imageMobileHeight: 1107,
      weDo:
        "Push your site live on your domain, set up your Google Business Profile pointer, walk your team through the admin, and \u2014 for switchers \u2014 swap your public booking link.",
      youDo:
        "Confirm everything looks right. Then take your first booking on Kersivo at 0% commission.",
      deliverable:
        "Live system, trained team, and a clean start at 0% commission on bookings and retail.",
    },
  ];

  const [active, setActive] = useState<number>(0);
  const previousActive = usePrevious(active);

  return (
    <section id="onboarding" className={cn("process2 py-32", className)}>
      <div className="container">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-20">
          <div className="top-10 h-fit w-fit gap-3 space-y-7 py-8 lg:sticky">
            <h2 className="relative w-fit text-5xl font-semibold tracking-tight lg:text-7xl">
              Go live in two weeks.
              <br />
              We build it.
              <br />
              You just show up.
            </h2>
            <p className="text-base text-foreground/50">
              Same plan whether you are switching from Booksy/Fresha or starting your first system. We carry the build,
              you stay focused on the chair.
            </p>
            <div className="process2-image-frame relative h-90 overflow-hidden border">
              {previousActive !== undefined && (
                <div className="absolute top-0 h-full w-full">
                  <ProcessStepPicture
                    desktopSrc={process[previousActive].image}
                    mobileSrc={process[previousActive].imageMobile}
                    width={process[previousActive].imageWidth}
                    height={process[previousActive].imageHeight}
                    alt=""
                  />
                </div>
              )}
              <div key={active} className="process2-image-reveal h-full w-full">
                <ProcessStepPicture
                  desktopSrc={process[active].image}
                  mobileSrc={process[active].imageMobile}
                  width={process[active].imageWidth}
                  height={process[active].imageHeight}
                  alt={`${process[active].title} — Kersivo barbershop setup`}
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
  step: ProcessStep;
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
            Step {index + 1} of 3:{" "}
          </span>
          {step.title}
        </h3>
        <p className="text-sm font-medium uppercase tracking-wide text-foreground/70">
          {step.timeline}
        </p>
        <p className="text-foreground/70"><span className="font-semibold text-foreground">We do:</span> {step.weDo}</p>
        <p className="text-foreground/50"><span className="font-semibold text-foreground/80">You do:</span> {step.youDo}</p>
        <p className="text-foreground/70"><span className="font-semibold text-foreground">You get:</span> {step.deliverable}</p>
      </div>
    </li>
  );
};

export { Process2 };