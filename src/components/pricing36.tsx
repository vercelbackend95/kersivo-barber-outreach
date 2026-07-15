"use client";

import { Pricing36PlanCards } from "@/components/pricing/Pricing36PlanCards";
import { PRICE_VAT_DISCLAIMER } from "@/lib/pricing/claimsPolicy";
import { getPricing36Copy, type Pricing36Variant } from "@/lib/pricing/pricing36Copy";
import type { SetupPlanId } from "@/lib/setup/plans";
import { cn } from "@/lib/utils";
import "@/styles/pricing36.css";
import "@/styles/components/compare3.css";

interface Pricing36Props {
  className?: string;
  variant?: Pricing36Variant;
}

const Pricing36 = ({ className, variant = "default" }: Pricing36Props) => {
  const copy = getPricing36Copy(variant);
  const calendlyUrl = (import.meta.env.PUBLIC_CALENDLY_URL ?? "").trim();

  const openLaunchWizard = (planId: SetupPlanId) => {
    window.location.assign(`/admin/launch?plan=${planId}`);
  };

  return (
    <section id="pricing" className={cn("pricing36 py-32", variant === "landing" && "pricing36--landing", className)}>
      <div className="container">
        <div className="compare3-block__header">
          <span className="compare3-block__badge">PRICING</span>
          <h2>ONE SETUP. ONE MONTHLY FEE. ZERO KERSIVO COMMISSION.</h2>
          <p>
            <strong>Launch: &pound;199 setup + &pound;39/month Care.</strong> {copy.introCommission}
          </p>
          <p className="pricing36__vat-note text-sm text-muted-foreground">{PRICE_VAT_DISCLAIMER}</p>
        </div>

        <div className="pricing36__guarantee" role="note">
          <span className="pricing36__guarantee-tag">50 / 50 setup</span>
          <p className="pricing36__guarantee-body">
            <strong>Pay 50% deposit to start; remaining 50% before go-live.</strong> Work begins after the deposit,
            completed onboarding and the start of project delivery. If you cancel before work begins, we refund the
            deposit. Once work begins, the deposit is non-refundable. If KERSIVO cannot deliver, we refund the deposit.
          </p>
        </div>

        {calendlyUrl ? (
          <p className="pricing36__calendly">
            <a href={calendlyUrl} target="_blank" rel="noopener noreferrer">
              Book a 15-min scorecard call
            </a>
          </p>
        ) : null}

        <Pricing36PlanCards variant={variant} onSelectPlan={openLaunchWizard} />
      </div>
    </section>
  );
};

export { Pricing36 };
