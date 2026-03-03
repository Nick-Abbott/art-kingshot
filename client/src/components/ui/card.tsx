import * as React from "react";
import { cn } from "../../lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl bg-panel p-5 shadow-soft", className)}
      {...props}
    />
  )
);

Card.displayName = "Card";
