"use client";

import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";

import { SetupDepositModal } from "@/components/setup/SetupDepositModal";
import { Separator } from "@/components/ui/separator";
import { getPricing36Copy, type Pricing36Variant } from "@/lib/pricing/pricing36Copy";
import { getSetupPlan, type SetupPlanId } from "@/lib/setup/plans";
import { formatGbp } from "@/lib/shop/money";
import { cn } from "@/lib/utils";

interface Pricing36Props {
  className?: string;
  variant?: Pricing36Variant;
}

const Pricing36 = ({ className, variant = "default" }: Pricing36Props) => {
  const copy = getPricing36Copy(variant);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SetupPlanId>("launch");

  const openDepositModal = (planId: SetupPlanId) => {
    setSelectedPlan(planId);
    setModalOpen(true);
  };

  const activePlan = getSetupPlan(selectedPlan);
  const calendlyUrl = (import.meta.env.PUBLIC_CALENDLY_URL ?? "").trim();

  return (
    <section id="pricing" className={cn("pricing36 py-32", variant === "landing" && "pricing36--landing", className)}>
      <div className="container">
        <div className="compare3-block__header">
          <span className="compare3-block__badge">PRICING</span>
          <h2>ONE SETUP. ONE MONTHLY FEE. ZERO COMMISSION.</h2>
          <p>
            <strong>Launch: &pound;199 setup + &pound;39/month Care.</strong> {copy.introCommission}{" "}
            Stripe applies only to online card payments, on your own account.
          </p>
        </div>

        <div className="pricing36__guarantee" role="note">
          <span className="pricing36__guarantee-tag">Risk-free setup</span>
          <p className="pricing36__guarantee-body">
            <strong>Pay 50% to start, 50% only on go-live.</strong> We carry the build risk. You only pay the second half
            once your system is live, tested, and signed off by you.
          </p>
        </div>

        {calendlyUrl ? (
          <p className="pricing36__calendly">
            <a href={calendlyUrl} target="_blank" rel="noopener noreferrer">
              Book a 15-min scorecard call
            </a>
          </p>
        ) : null}

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="pricing36__plan-frame pricing36__plan-frame--launch flex h-full flex-col rounded-4xl p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="pricing36__plan-header flex items-center justify-between">
                  <p className="text-xl font-semibold">Launch</p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-6xl font-bold">
                    £199
                    <span className="text-base font-semibold text-muted-foreground">
                      / setup
                    </span>
                  </p>
                  <p className="text-xl font-semibold">+ £39/month Ongoing Care</p>
                  <p className="text-sm text-muted-foreground">
                    {copy.launchSubtext}
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  {copy.launchBullets.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-green-500" />
                      <p className="font-medium">{item}</p>
                    </li>
                  ))}
                </ul>
                <div className="pricing36__anchors">
                  <p className="pricing36__anchor pricing36__anchor--switcher">
                    <span className="pricing36__anchor-tag">Switching</span>
                    {copy.launchSwitcherAnchor}
                  </p>
                  <p className="pricing36__anchor pricing36__anchor--newcomer">
                    <span className="pricing36__anchor-tag pricing36__anchor-tag--newcomer">Starting fresh</span>
                    {copy.launchNewcomerAnchor}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="group pricing36__plan-cta flex w-full items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
                onClick={() => openDepositModal("launch")}
                data-track="launch_stripe_click"
                data-setup-plan="launch"
              >
                {copy.launchCtaLabel}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="pricing36__plan-frame pricing36__plan-frame--growth flex h-full flex-col rounded-4xl p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="pricing36__plan-header flex items-center justify-between gap-2">
                  <p className="text-xl font-semibold">Priority Growth</p>
                  <span className="compare3-block__badge">Best Value</span>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-6xl font-bold">
                    £299
                    <span className="text-base font-semibold text-muted-foreground">
                      / setup
                    </span>
                  </p>
                  <p className="text-xl font-semibold">+ £39/month Ongoing Care</p>
                  <p className="text-sm text-muted-foreground">
                    {copy.prioritySubtext}
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  {copy.priorityBullets.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-green-500" />
                      <p className="font-medium">{item}</p>
                    </li>
                  ))}
                </ul>
                <div className="pricing36__anchors">
                  <p className="pricing36__anchor pricing36__anchor--switcher">
                    <span className="pricing36__anchor-tag">Switching</span>
                    {copy.prioritySwitcherAnchor}
                  </p>
                  <p className="pricing36__anchor pricing36__anchor--newcomer">
                    <span className="pricing36__anchor-tag pricing36__anchor-tag--newcomer">Starting fresh</span>
                    {copy.priorityNewcomerAnchor}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="group pricing36__plan-cta flex w-full items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
                onClick={() => openDepositModal("priority")}
                data-track="priority_growth_stripe_click"
                data-setup-plan="priority"
              >
                {copy.priorityCtaLabel}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>

        {variant !== "landing" ? (
          <p className="pricing36__questions">
            Questions first? Email{" "}
            <a href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a>
            {copy.questionsSuffix ? ` ${copy.questionsSuffix}` : null}
          </p>
        ) : null}
      </div>

      <SetupDepositModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        planId={selectedPlan}
        planName={activePlan.name}
        depositFormatted={formatGbp(activePlan.depositPence)}
      />
    </section>
  );
};

export { Pricing36 };
