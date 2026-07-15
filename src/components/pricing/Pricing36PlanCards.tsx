"use client";

import { ArrowRight, Check } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { getPricing36Copy, type Pricing36Variant } from "@/lib/pricing/pricing36Copy";
import type { SetupPlanId } from "@/lib/setup/plans";

export type Pricing36PlanCardsProps = {
  variant?: Pricing36Variant;
  onSelectPlan: (planId: SetupPlanId) => void;
};

/**
 * Shared Launch / Priority Growth cards used by landing Pricing36 and Launch Wizard.
 * Visuals and copy must stay identical to the pricing section.
 */
export function Pricing36PlanCards({
  variant = "default",
  onSelectPlan,
}: Pricing36PlanCardsProps) {
  const copy = getPricing36Copy(variant);

  return (
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
            onClick={() => onSelectPlan("launch")}
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
              <span className="compare3-block__badge">Most support</span>
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
            onClick={() => onSelectPlan("priority")}
            data-track="priority_growth_stripe_click"
            data-setup-plan="priority"
          >
            {copy.priorityCtaLabel}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
