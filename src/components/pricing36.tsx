import { ArrowRight, Check } from "@/components/lucide-react";

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
          <h2>TWO SETUPS, ONE PLATFORM</h2>
          <p>
            <strong>£695</strong> or <strong>£995</strong> one-time—<strong>total as shown</strong>.{" "}
            <strong>50% to start, 50% before go-live.</strong> Essential: <strong>1 month</strong> hosting + admin; PRO:{" "}
            <strong>3 months</strong>.
          </p>
        </div>


        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex h-full flex-col rounded-4xl bg-gradient-to-r from-blue-500 to-purple-500 p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-semibold">Essential</p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-6xl font-bold">
                    £695
                    <span className="text-base font-semibold text-muted-foreground">
                      / one-time
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Full system; up to 20 products at launch; 1 month hosting + admin included.
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Custom site (pages per brief) · mobile-first</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Booking on your domain + full admin (team, diary, shop, reports)</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Shop: Stripe checkout, buy-and-collect, up to 20 products at setup</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Contact form, map, hours</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">1 month hosting + admin &amp; shop—then £40/mo Care to continue</p>
                  </li>
                </ul>
              </div>
              <a
                href="#book-demo"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
              >
                Choose Essential Setup
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex h-full flex-col rounded-4xl bg-primary p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xl font-semibold">PRO</p>
                  <p className="recommended-badge text-sm font-semibold text-primary">
                    Recommended
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-6xl font-bold">
                    £995
                    <span className="text-base font-semibold text-muted-foreground">
                      / one-time
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    3 months hosting + admin; up to 50 products; more polish &amp; homepage focus.
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Everything in Essential</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">
                      3 months hosting + admin &amp; shop · up to 50 products · featured products · stronger homepage CTAs
                    </p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Extra layout &amp; polish vs Essential (per brief)</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">
                      <a href="#faq" className="text-primary underline-offset-4 hover:underline">
                        Managed Care
                      </a>{" "}
                      includes client SMS <span className="text-muted-foreground">(where enabled)</span>—on PRO we prep it
                      at go-live
                    </p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Priority launch · go-live week support</p>
                  </li>
                </ul>
              </div>
              <a
                href="#book-demo"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
              >
                Choose PRO Setup
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