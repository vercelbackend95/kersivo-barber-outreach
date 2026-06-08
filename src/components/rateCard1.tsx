import React from "react";

import { Armchair, GlobeLock, LayoutDashboard, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type CareFeature = {
  title: string;
  description: string;
  Icon: typeof GlobeLock;
};

interface RateCard1Props {
  className?: string;
}

const LAUNCH_CARE_BULLETS = [
  "Hosting, SSL, admin and shop unlocked 24/7",
  "Client SMS reminders where you enable them",
  "Support inbox + up to 1 hour of scoped tweaks/month",
  "0% commission from Kersivo (Stripe still charges cards)",
];

const PRIORITY_CARE_BULLETS = [
  "Everything in Launch-tier Care above",
  "Priority queue + faster human responses",
  "Up to 2 hours of scoped site/booking tweaks/month",
  "Monthly pulse on performance with practical fixes",
];

const CARE_FEATURES: CareFeature[] = [
  {
    title: "Hosting & SSL",
    description:
      "We keep your storefront, diary and pickup shop reachable around the clock; SSL renewal and infra noise stay off your weekends.",
    Icon: GlobeLock,
  },
  {
    title: "One admin for bookings + retail",
    description:
      "Chairs, services, retail SKU and pickup orders share a single cockpit so your managers are not juggling tabs.",
    Icon: LayoutDashboard,
  },
  {
    title: "SMS, patching & Care hours",
    description:
      "SMS automations fire when you enable them, dependencies stay patched, and contracted builder time refreshes monthly.",
    Icon: MessagesSquare,
  },
  {
    title: "Flat Care as you add chairs",
    description:
      "More barbers does not automatically bump monthly Care; we price on attention, not headcount creep.",
    Icon: Armchair,
  },
];

const RateCard1 = ({ className }: RateCard1Props) => {
  return (
    <section
      id="ongoing-care"
      className={cn("rate-card1 scroll-mt-24", className)}
      aria-labelledby="rate-card1-heading"
    >
      <div className="container rate-card1__layout">
        <aside className="rate-card1__sidebar">
          <div className="rate-card1__heading-wrap">
            <p className="rate-card1__eyebrow">ONGOING CARE</p>
            <h2 id="rate-card1-heading" className="rate-card1__heading">
              WHAT YOUR SUBSCRIPTION BUYS EACH MONTH
            </h2>
            <p className="rate-card1__lead">
              Ongoing Care is the flat subscription next to Stripe: uptime, tooling, and the humans who keep bookings
              flowing. Launch runs at <strong>£39/month</strong>; Priority Growth at <strong>£59/month</strong> with extra
              response speed and monthly change capacity.
            </p>
            <Illustration className="rate-card1__mark rate-card1__mark--top" />
            <Illustration className="rate-card1__mark rate-card1__mark--bottom" />
          </div>

          <div className="rate-card1__price-block">
            <div className="rate-card1__plan-block" aria-label="Launch monthly care">
              <p className="rate-card1__plan-title">Launch Care</p>
              <p className="rate-card1__price">
                £39 <span>/ month</span>
              </p>
              <ul className="rate-card1__conditions">
                {LAUNCH_CARE_BULLETS.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            </div>
            <div className="rate-card1__plan-block" aria-label="Priority monthly care">
              <p className="rate-card1__plan-title">Priority Care</p>
              <p className="rate-card1__price">
                £59 <span>/ month</span>
              </p>
              <ul className="rate-card1__conditions">
                {PRIORITY_CARE_BULLETS.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            </div>
            <p className="rate-card1__plan-note">
              Your setup fee (£199 or £299) is separate; Care starts once you are live. No mystery line items stacked on top.
            </p>
          </div>
        </aside>

        <ol className="rate-card1__steps" aria-label="What we deliver inside Ongoing Care">
          {CARE_FEATURES.map(({ Icon, title, description }) => (
            <li key={title} className="rate-card1__step-item">
              <div className="rate-card1__step-icon" aria-hidden="true">
                <Icon className="rate-card1__step-svg" />
              </div>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
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
