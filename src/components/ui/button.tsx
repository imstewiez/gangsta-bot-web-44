import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/25 bg-primary text-primary-foreground shadow-[0_12px_32px_-18px_color-mix(in_oklab,var(--primary)_90%,transparent)] hover:bg-primary/90 hover:shadow-[0_0_24px_-8px_color-mix(in_oklab,var(--primary)_80%,transparent)] hover:-translate-y-px active:translate-y-0 active:shadow-none",
        destructive:
          "border border-destructive/25 bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-[0_0_20px_-4px_rgba(239,68,68,0.4)] hover:-translate-y-px active:translate-y-0 active:shadow-none",
        outline:
          "border border-primary/22 bg-background/35 text-foreground shadow-sm backdrop-blur-xl hover:border-primary/50 hover:bg-primary/8 hover:text-primary hover:shadow-[0_0_18px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)] hover:-translate-y-px active:translate-y-0 active:shadow-none",
        secondary:
          "border border-border/55 bg-secondary/70 text-secondary-foreground shadow-sm hover:bg-secondary/85 hover:shadow-[0_0_16px_-4px_rgba(168,85,247,0.15)] hover:-translate-y-px active:translate-y-0 active:shadow-none",
        ghost: "text-foreground/85 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_12px_-4px_rgba(168,85,247,0.15)] hover:-translate-y-px active:translate-y-0 active:shadow-none",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80 hover:shadow-[0_0_12px_-4px_rgba(168,85,247,0.2)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
