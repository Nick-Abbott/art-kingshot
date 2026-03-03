import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-ink shadow-none outline-none transition focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:bg-black/5",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
