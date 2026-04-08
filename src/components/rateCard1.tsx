import React from "react";

import { Ticket } from "@/components/lucide-react";
import { cn } from "@/lib/utils";

interface RateCard1Props {
  className?: string;
}

const CARE_PLAN_BULLETS = [
  "Guaranteed 0% commission from Kersivo—Stripe card fees only",
  "Hosting & SSL on us",
  "Full admin & shop",
  "SMS reminders (where enabled)",
  "1h Kersivo dev / month",
];

const CARE_FEATURES = [
  {
    title: "Hosting & SSL",
    description:
      "We keep your site, booking, and shop online—SSL renewals and baseline uptime work are on us, not on your weekend.",
  },
  {
    title: "One admin for everything",
    description:
      "Diary, barbers, services, retail, and pickup orders in one panel—sensible day-to-day edits without a dev queue.",
  },
  {
    title: "SMS, patches & builder hour",
    description:
      "Client SMS when enabled, security and dependency updates, plus one hour a month for small in-scope tweaks.",
  },
  {
    title: "Same Care price as you grow",
    description:
      "No per-barber surcharge—add chairs or staff without the monthly plan creeping up.",
  },
];

const RateCard1 = ({ className }: RateCard1Props) => {
  return (
    <section className={cn("rate-card1", className)}>
      <div className="container rate-card1__layout">
        <aside className="rate-card1__sidebar">
          <div className="rate-card1__heading-wrap">
            <p className="rate-card1__eyebrow">ONGOING CARE</p>
            <h2 className="rate-card1__heading">MANAGED CARE</h2>
            <p className="rate-card1__lead">
              After your included hosting/admin months: hosting, full admin + shop, SMS (where enabled), security patches,
              and <strong>1h dev/month</strong>.
            </p>
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