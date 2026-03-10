import * as React from "react";

import { cn } from "@/lib/utils";

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button };
