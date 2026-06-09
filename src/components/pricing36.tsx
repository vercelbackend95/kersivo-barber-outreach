import { ArrowRight, Check } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Pricing36Props {
  className?: string;
}

const Pricing36 = ({ className }: Pricing36Props) => {
  return (
    <section id="pricing" className={cn("pricing36 py-32", className)}>
      <div className="container">
        <div className="compare3-block__header">
          <span className="compare3-block__badge">PRICING</span>
          <h2>ONE SETUP. ONE MONTHLY FEE. ZERO COMMISSION.</h2>
          <p>
            <strong>Launch: &pound;199 setup + &pound;39/month Care.</strong> Kersivo never takes a cut of your bookings or retail.
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

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="pricing36__plan-frame pricing36__plan-frame--launch flex h-full flex-col rounded-4xl p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="flex items-center justify-between">
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
                    Hosting, SMS, support, platform updates, and 1h scoped tweaks/month — same Care on every plan.
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Custom site + booking + admin + pickup shop setup</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Domain setup + deployment handled by us</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">0% Kersivo commission (Stripe card fees only)</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Hosting + SSL included while subscription is active</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Ongoing Care: SMS, no-show protection, support, platform updates, 1h tweaks/month</p>
                  </li>
                </ul>
                <div className="pricing36__anchors">
                  <p className="pricing36__anchor pricing36__anchor--switcher">
                    <span className="pricing36__anchor-tag">Switching</span>
                    Many busy shops on marketplace apps see subscription plus traffic-related fees in the ~&pound;120&ndash;&pound;300/mo range &mdash; line it up with your own statements.
                  </p>
                  <p className="pricing36__anchor pricing36__anchor--newcomer">
                    <span className="pricing36__anchor-tag pricing36__anchor-tag--newcomer">Starting fresh</span>
                    Live booking on your own domain in about two weeks. 0% commission from booking #1.
                  </p>
                </div>
              </div>
              <a
                href="#book-demo"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
                data-demo-cta
              >
                Plan my setup on Launch
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="pricing36__plan-frame pricing36__plan-frame--growth flex h-full flex-col rounded-4xl p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xl font-semibold">Priority Growth</p>
                  <p className="recommended-badge text-sm font-semibold text-primary">
                    Anchor Plan
                  </p>
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
                    Same £39/month Care as Launch — extra setup polish and priority launch queue during the build.
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Everything in Launch</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Priority launch queue during setup</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Extra setup polish for key pages and product catalogue depth</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Same Ongoing Care: hosting, SMS, support, platform updates, 1h tweaks/month</p>
                  </li>
                </ul>
                <div className="pricing36__anchors">
                  <p className="pricing36__anchor pricing36__anchor--switcher">
                    <span className="pricing36__anchor-tag">Switching</span>
                    When marketplace fees scale with chairs and volume, a flat Care plan keeps margin predictable next to Stripe only.
                  </p>
                  <p className="pricing36__anchor pricing36__anchor--newcomer">
                    <span className="pricing36__anchor-tag pricing36__anchor-tag--newcomer">Starting fresh</span>
                    Faster launch queue and deeper catalogue setup if you want to grow harder from day one.
                  </p>
                </div>
              </div>
              <a
                href="#book-demo"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
                data-demo-cta
              >
                Plan my setup on Priority Growth
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Pricing36 };
