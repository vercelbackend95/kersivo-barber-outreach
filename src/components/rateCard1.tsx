import React from "react";

import { Ticket } from "@/components/lucide-react";
import { cn } from "@/lib/utils";

interface RateCard1Props {
  className?: string;
}

const BOOKING_CONDITIONS = [
  "Minimal booking period — 2 months",
  "Schedule a call if you need more clarification",
  "Pause or cancel whenever you wish",
];

const PROCESS_STEPS = [
  {
    step: "01",
    title: "First Revision — 42 Hours",
    description:
      "Initial pricing analysis and market research completed within 42 hours. We deliver focused recommendations based on competitor activity and your shop positioning.",
  },
  {
    step: "02",
    title: "Strategy Refinement — 72 Hours",
    description:
      "Detailed pricing model setup with clear service tiers and value communication. Every scenario is aligned to margin goals and booking demand.",
  },
  {
    step: "03",
    title: "Implementation Plan — 5 Days",
    description:
      "Complete rollout roadmap with timeline and responsibilities. You get a practical launch sequence for updating pricing across channels.",
  },
  {
    step: "04",
    title: "Testing & Optimization — 1 Week",
    description:
      "A/B testing setup and performance tracking for conversion and retention. We monitor key metrics and adjust pricing based on data.",
  },
  {
    step: "05",
    title: "Final Review — 10 Days",
    description:
      "Comprehensive pricing audit with final recommendations and handoff materials so your team can manage pricing confidently.",
  },
];

const RateCard1 = ({ className }: RateCard1Props) => {
  return (
    <section className={cn("rate-card1", className)}>
      <div className="container rate-card1__layout">
        <aside className="rate-card1__sidebar">
          <div className="rate-card1__heading-wrap">
            <h2 className="rate-card1__heading">
              Simple
              <br />
              Pricing
            </h2>
            <Illustration className="rate-card1__mark rate-card1__mark--top" />
            <Illustration className="rate-card1__mark rate-card1__mark--bottom" />
          </div>

          <div className="rate-card1__price-block">
            <p className="rate-card1__price">
              $3,499 <span>/month</span>
            </p>
            <ul className="rate-card1__conditions" aria-label="Booking conditions">
              {BOOKING_CONDITIONS.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </div>
        </aside>

        <ol className="rate-card1__steps" aria-label="Pricing delivery timeline">
          {PROCESS_STEPS.map((step) => (
            <li key={step.step} className="rate-card1__step-item">
              <div className="rate-card1__step-icon" aria-hidden="true">
                <Ticket className="rate-card1__ticket" />
              </div>
              <div>
                <p className="rate-card1__step-number">Step {step.step}</p>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export { RateCard1 };

const Illustration = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="22"
      height="20"
      viewBox="0 0 22 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line x1="0.607422" y1="2.57422" x2="21.5762" y2="2.57422" stroke="currentColor" strokeWidth="4" />
      <line x1="19.5762" y1="19.624" x2="19.5762" y2="4.57422" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
};
