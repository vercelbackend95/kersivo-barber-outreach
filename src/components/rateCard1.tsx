import React from "react";

import { GlobeLock, LayoutDashboard, MessagesSquare, ShieldCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type CareFeature = {
  title: string;
  description: string;
  Icon: typeof GlobeLock;
};

interface RateCard1Props {
  className?: string;
}

const ONGOING_CARE_BULLETS = [
  "Online booking — 0% Kersivo commission",
  "Your shop online — 0% Kersivo commission on retail",
  "SMS reminders when you enable them",
  "No-show protection on bookings",
  "Hosting, SSL, admin + shop live 24/7",
  "Support inbox + 1 hour scoped tweaks/month",
  "Platform updates — performance and scale as you add barbers and chairs",
];

const CARE_FEATURES: CareFeature[] = [
  {
    title: "Booking & shop — 0% commission",
    description:
      "Clients book and buy on your domain. Kersivo never takes a cut of bookings or retail; Stripe charges cards on your account only.",
    Icon: LayoutDashboard,
  },
  {
    title: "Always on",
    description:
      "Hosting, SSL renewal, admin panel and pickup shop stay reachable 24/7 — infra noise stays off your weekends.",
    Icon: GlobeLock,
  },
  {
    title: "Client comms",
    description:
      "SMS reminders fire when you enable them. No-show protection helps cut empty chairs without awkward chase-ups.",
    Icon: MessagesSquare,
  },
  {
    title: "Humans on call",
    description:
      "Support inbox for day-to-day questions, plus up to one hour of scoped site or booking tweaks each month.",
    Icon: ShieldCheck,
  },
  {
    title: "Keeps scaling",
    description:
      "We ship platform updates so the system stays fast and handles more barbers and chairs as your shop grows.",
    Icon: TrendingUp,
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
              One flat <strong>£39/month</strong> after go-live. Booking, shop, admin, SMS, support, and ongoing platform
              updates — <strong>0% Kersivo commission</strong> on bookings and retail. Stripe charges cards on your
              account only.
            </p>
            <Illustration className="rate-card1__mark rate-card1__mark--top" />
            <Illustration className="rate-card1__mark rate-card1__mark--bottom" />
          </div>

          <div className="rate-card1__price-block">
            <div
              className="rate-card1__plan-block rate-card1__plan-block--solo"
              aria-label="Ongoing monthly care"
            >
              <p className="rate-card1__plan-title">Ongoing Care</p>
              <p className="rate-card1__price">
                £39 <span>/ month</span>
              </p>
              <ul className="rate-card1__conditions">
                {ONGOING_CARE_BULLETS.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            </div>
            <p className="rate-card1__plan-note">
              Your setup fee (£199 or £299) is separate; Care starts once you are live. No mystery line items stacked on
              top.
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
