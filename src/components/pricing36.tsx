import { ArrowRight, Check } from "@/components/lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Pricing36Props {
  className?: string;
}

const Pricing36 = ({ className }: Pricing36Props) => {
  return (
    <section className={cn("py-32", className)}>
      <div className="container">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex h-full flex-col rounded-4xl bg-gradient-to-r from-blue-500 to-purple-500 p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-semibold">Starter Plan</p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-6xl font-bold">
                    $19
                    <span className="text-base font-semibold text-muted-foreground">
                      /month
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Complete Solution For Your Team Productivity
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">Team collaboration tools</p>
                      <p className="text-sm text-muted-foreground">
                        Enable seamless collaboration with shared workspaces
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">Advanced project tracking</p>
                      <p className="text-sm text-muted-foreground">
                        Monitor project progress with detailed analytics and
                        reports
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">Automated task management</p>
                      <p className="text-sm text-muted-foreground">
                        Streamline workflows with intelligent task automation
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">Priority customer support</p>
                      <p className="text-sm text-muted-foreground">
                        Get expert assistance with priority support channels and
                        quick response times.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <a
                href="#"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
              >
                Subscribe
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex h-full flex-col rounded-4xl bg-primary p-px">
              <div className="h-full rounded-[31px] bg-background p-8">
                <p className="text-xl font-semibold">Enterprise Plan</p>
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-6xl font-bold">
                    $49
                    <span className="text-base font-semibold text-muted-foreground">
                      /month
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Complete solution for your Enterprise Workflows
                  </p>
                </div>
                <Separator className="my-6" />
                <ul className="space-y-6">
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">Unlimited team members</p>
                      <p className="text-sm text-muted-foreground">
                        Scale without limits with unlimited user access and
                        collaboration tools.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">
                        Advanced analytics dashboard
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Get deep insights with comprehensive reporting tools
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">Custom workflow automation</p>
                      <p className="text-sm text-muted-foreground">
                        Create tailored workflows to optimize team efficiency
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">Dedicated success manager</p>
                      <p className="text-sm text-muted-foreground">
                        Receive personalized guidance from dedicated specialists
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <a
                href="#"
                className="group flex items-center justify-center gap-1.5 py-3 text-center font-medium text-background"
              >
                Contact Us
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