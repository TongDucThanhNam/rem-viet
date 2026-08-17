import { cn } from "@rem-viet/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const badgeVariants = cva(
  "inline-flex min-h-5 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset [&_svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-secondary-foreground ring-secondary-foreground/10",
        success:
          "bg-success text-success-foreground ring-success-foreground/15",
        warning:
          "bg-warning text-warning-foreground ring-warning-foreground/15",
        info: "bg-info text-info-foreground ring-info-foreground/15",
        destructive:
          "bg-destructive-soft text-destructive-soft-foreground ring-destructive-soft-foreground/15",
        outline: "bg-transparent text-foreground ring-border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
