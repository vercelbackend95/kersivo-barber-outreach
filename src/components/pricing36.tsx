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
          <span className="compare3-block__badge">SETUP OPTIONS</span>
          <h2>CHOOSE THE SETUP THAT FITS YOUR BARBERSHOP</h2>
          <p>
Both packages include a custom barber website system — the difference is how far you want to push the presentation, sales flow and retail setup.
          </p>
        </div>


        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex h-full flex-col rounded-4xl bg-gradient-to-r from-blue-500 to-purple-500 p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-semibold">Base</p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-6xl font-bold">
                    £695
                    <span className="text-base font-semibold text-muted-foreground">
                      / one-time
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
A strong starting point for barbers who want a sharp, professional website system that covers the essentials.
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Custom barber website</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Built-in booking system</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">
                      Services, gallery and reviews
                    </p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">
                      Contact details, map and opening hours
                    </p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">1 month of full admin access included</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Shop setup for up to 20 products</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Mobile-first responsive build</p>
                  </li>
                </ul>
              </div>
              <a
                href="#book-demo"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
              >
                Choose Base
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex h-full flex-col rounded-4xl bg-primary p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xl font-semibold">Premium</p>
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
For barbershops that want a sharper presentation, a stronger sales setup and a more premium client experience.
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Everything in Base</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">
                      More tailored premium presentation
                    </p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Stronger homepage sales flow</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">3 months of full admin access included</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Shop setup for up to 50 products</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Featured product setup</p>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <p className="font-medium">Priority launch</p>
                  </li>
                </ul>
              </div>
              <a
                href="#book-demo"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
              >
                Choose Premium
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