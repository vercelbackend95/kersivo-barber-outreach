import React from "react";

import {
  ChartNoAxesCombined,
  Check,
  Globe,
  GlobeLock,
  LayoutDashboard,
  MessagesSquare,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  NO_PAUSE_SHORT,
  NO_SETUP_FEE_SHORT,
  OWNER_SELF_CONFIG_SHORT,
  PLAN_SCOPE_SHORT,
  PRICE_VAT_DISCLAIMER,
} from "@/lib/pricing/claimsPolicy";
import {
  getRateCard1Copy,
  getRateCard1LandingLayout,
  rateCard1SharedCopy,
  type RateCard1LandingIcon,
  type RateCard1Variant,
} from "@/lib/pricing/rateCard1Copy";
import { SAAS_MONTHLY_GBP } from "@/lib/seo/defaults";
import { cn } from "@/lib/utils";
import "@/styles/rateCard1.css";

type CareFeature = {
  title: string;
  description: string;
  Icon: typeof GlobeLock;
};

interface RateCard1Props {
  className?: string;
  variant?: RateCard1Variant;
}

const LANDING_ICONS: Record<RateCard1LandingIcon, LucideIcon> = {
  globe: Globe,
  dashboard: LayoutDashboard,
  users: Users,
  shoppingBag: ShoppingBag,
  scissors: Scissors,
  chart: ChartNoAxesCombined,
};

function buildCareFeatures(variant: RateCard1Variant): CareFeature[] {
  const copy = getRateCard1Copy(variant);

  return [
    {
      title: "Booking & shop — 0% KERSIVO commission",
      description: copy.bookingShopDescription,
      Icon: LayoutDashboard,
    },
    {
      title: "Always on",
      description: copy.alwaysOnDescription,
      Icon: GlobeLock,
    },
    {
      title: "Client comms",
      description: copy.clientCommsDescription,
      Icon: MessagesSquare,
    },
    {
      title: "Humans on call",
      description: rateCard1SharedCopy.humansOnCallDescription,
      Icon: ShieldCheck,
    },
    {
      title: "Keeps scaling",
      description: rateCard1SharedCopy.keepsScalingDescription,
      Icon: TrendingUp,
    },
  ];
}

function RateCard1Landing({ className }: { className?: string }) {
  const layout = getRateCard1LandingLayout();

  return (
    <section
      id="pricing"
      className={cn("rate-card1 rate-card1--landing scroll-mt-24", className)}
      aria-labelledby="rate-card1-heading"
      data-section="ongoing-care"
    >
      <div id="ongoing-care" className="container rate-card1__landing">
        <header className="rate-card1__landing-intro">
          <p className="rate-card1__eyebrow">{layout.eyebrow}</p>
          <h2 id="rate-card1-heading" className="rate-card1__landing-heading">
            {layout.headingBeforePrice}
            {SAAS_MONTHLY_GBP}
            {layout.headingAfterPrice}
          </h2>
          <p className="rate-card1__landing-lead">{layout.lead}</p>
        </header>

        <div className="rate-card1__offer">
          <div className="rate-card1__offer-body">
            <div className="rate-card1__offer-decision" aria-label="Monthly subscription">
              <p className="rate-card1__plan-title">{layout.planLabel}</p>
              <p className="rate-card1__price">
                £{SAAS_MONTHLY_GBP} <span>/ month</span>
              </p>
              <p className="rate-card1__offer-value">{layout.planValueLine}</p>
              <ul className="rate-card1__offer-trust">
                {layout.trustPoints.map((point) => (
                  <li key={point}>
                    <span className="rate-card1__offer-trust-icon" aria-hidden="true">
                      <Check strokeWidth={2.5} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href="/admin/launch"
                className="btn btn--primary rate-card1__cta"
                data-track="saas_subscribe_click"
              >
                {layout.ctaLabel}
              </a>
              <p className="rate-card1__offer-checkout">{layout.checkoutNote}</p>
              <p className="rate-card1__offer-billing">{layout.billingNote}</p>
            </div>

            <div className="rate-card1__offer-included">
              <h3 className="rate-card1__offer-included-heading">{layout.includedHeading}</h3>
              <ul className="rate-card1__offer-included-list">
                {layout.includedItems.map((item) => {
                  const Icon = LANDING_ICONS[item.icon];
                  return (
                    <li key={item.heading} className="rate-card1__offer-included-item">
                      <span className="rate-card1__offer-icon" aria-hidden="true">
                        <Icon strokeWidth={1.85} />
                      </span>
                      <div>
                        <h4 className="rate-card1__offer-included-title">{item.heading}</h4>
                        <p className="rate-card1__offer-included-desc">{item.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <ul className="rate-card1__offer-foot" aria-label="Also included with your plan">
            {layout.supportItems.map((item) => (
              <li key={item}>
                <span className="rate-card1__offer-foot-check" aria-hidden="true">
                  <Check strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rate-card1__landing-conditions">
          <p>{layout.conditionsLine1}</p>
          <p>{layout.conditionsLine2}</p>
        </div>
      </div>
    </section>
  );
}

function RateCard1Default({ className }: { className?: string }) {
  const variant: RateCard1Variant = "default";
  const copy = getRateCard1Copy(variant);
  const careFeatures = buildCareFeatures(variant);

  return (
    <section
      id="pricing"
      className={cn("rate-card1 scroll-mt-24", className)}
      aria-labelledby="rate-card1-heading"
      data-section="ongoing-care"
    >
      <div id="ongoing-care" className="container rate-card1__layout">
        <aside className="rate-card1__sidebar">
          <div className="rate-card1__heading-wrap">
            <p className="rate-card1__eyebrow">WHAT&apos;S INCLUDED</p>
            <h2 id="rate-card1-heading" className="rate-card1__heading">
              WHAT YOUR SUBSCRIPTION BUYS EACH MONTH
            </h2>
            <p className="rate-card1__lead">
              One flat <strong>£{SAAS_MONTHLY_GBP}/month</strong> per physical location, billed automatically. Booking,
              shop, admin, hosting, SSL, domain renewal, support and platform updates —{' '}
              <strong>{copy.leadCommissionLabel}</strong> on bookings and retail. Standard Stripe payment-processing
              fees still apply.
            </p>
            <Illustration className="rate-card1__mark rate-card1__mark--top" />
            <Illustration className="rate-card1__mark rate-card1__mark--bottom" />
          </div>

          <div className="rate-card1__price-block">
            <div
              className="rate-card1__plan-block rate-card1__plan-block--solo"
              aria-label="Monthly subscription"
            >
              <p className="rate-card1__plan-title">Monthly subscription</p>
              <p className="rate-card1__price">
                £{SAAS_MONTHLY_GBP} <span>/ month</span>
              </p>
              <p className="rate-card1__plan-subtext">{copy.planSubtext}</p>
              <ul className="rate-card1__conditions">
                {copy.ongoingCareBullets.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
              <a
                href="/admin/launch"
                className="btn btn--primary rate-card1__cta"
                data-track="saas_subscribe_click"
              >
                {copy.ctaLabel}
              </a>
            </div>
            <ul className="rate-card1__pills" aria-label="Also included">
              {copy.planPills.map((pill) => (
                <li key={pill}>{pill}</li>
              ))}
            </ul>
            <p className="rate-card1__plan-note">
              {NO_SETUP_FEE_SHORT} No minimum term. {PLAN_SCOPE_SHORT} {OWNER_SELF_CONFIG_SHORT} {NO_PAUSE_SHORT}{' '}
              {PRICE_VAT_DISCLAIMER}
            </p>
          </div>
        </aside>

        <ol className="rate-card1__steps" aria-label="What we deliver with your subscription">
          {careFeatures.map(({ Icon, title, description }) => (
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
}

const RateCard1 = ({ className, variant = "default" }: RateCard1Props) => {
  if (variant === "landing") {
    return <RateCard1Landing className={className} />;
  }
  return <RateCard1Default className={className} />;
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
