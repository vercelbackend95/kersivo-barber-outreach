import React from "react";

import { Ticket } from "@/components/lucide-react";
import { cn } from "@/lib/utils";

interface RateCard1Props {
  className?: string;
}

const CARE_PLAN_BULLETS = [
  "Hosting included",
  "Ongoing maintenance",
  "Full admin access",
];

const CARE_FEATURES = [
  {
    title: "Hosting included",
    description:
      "Your website stays live, connected and reliably available with hosting handled for you.",
  },
  {
    title: "Security monitoring",
    description:
      "Ongoing monitoring helps keep your site secure, stable and protected.",
  },
  {
    title: "Maintenance and updates",
    description:
      "We keep core parts of the site maintained so everything continues to run smoothly.",
  },
  {
    title: "Monthly dev support",
    description:
      "Small edits, updates or improvements can be handled without starting from scratch every time.",
  },
  {
    title: "Full admin access",
    description:
      "You keep access to your admin system so you can manage bookings, content and products with ease.",
  },
];

const RateCard1 = ({ className }: RateCard1Props) => {
  return (
    <section className={cn("rate-card1", className)}>
      <div className="container rate-card1__layout">
        <aside className="rate-card1__sidebar">
          <div className="rate-card1__heading-wrap">
            <p className="rate-card1__eyebrow">ONGOING CARE</p>
            <h2 className="rate-card1__heading">Keep your site running smoothly</h2>
            <Illustration className="rate-card1__mark rate-card1__mark--top" />
            <Illustration className="rate-card1__mark rate-card1__mark--bottom" />
          </div>

          <div className="rate-card1__price-block">
            <p className="rate-card1__price">
              £40 <span>/ month</span>
            </p>
            <ul className="rate-card1__conditions" aria-label="Monthly care plan includes">
              {CARE_PLAN_BULLETS.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
            <p className="rate-card1__note">
              After launch, every website stays supported on one simple monthly care plan.
            </p>
          </div>
        </aside>

        <ol className="rate-card1__steps" aria-label="Ongoing care plan features">
          {CARE_FEATURES.map((step) => (
            <li key={step.title} className="rate-card1__step-item">
              <div className="rate-card1__step-icon" aria-hidden="true">
                <Ticket className="rate-card1__ticket" />
              </div>
              <div>
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