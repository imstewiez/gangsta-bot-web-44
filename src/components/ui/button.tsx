import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "btn-shine border border-primary/55 bg-gradient-to-b from-primary/95 to-primary/72 text-primary-foreground shadow-[0_12px_32px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:border-primary/80 hover:shadow-[0_0_28px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] hover:-translate-y-px",
        premium:
          "btn-shine border border-primary/50 bg-gradient-to-br from-primary via-primary/85 to-accent text-primary-foreground shadow-[0_18px_44px_-20px_color-mix(in_oklab,var(--primary)_75%,transparent)] hover:border-primary/80 hover:shadow-[0_0_34px_-10px_color-mix(in_oklab,var(--primary)_85%,transparent)] hover:-translate-y-px",
        glass:
          "border border-white/10 bg-white/[0.045] text-foreground shadow-sm backdrop-blur-xl hover:border-primary/45 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_22px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:-translate-y-px",
        destructive:
          "border border-destructive/55 bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-[0_0_24px_-8px_rgba(239,68,68,0.45)] hover:-translate-y-px",
        outline:
          "border border-input/80 bg-background/45 shadow-sm backdrop-blur-md hover:border-primary/60 hover:bg-primary/8 hover:text-primary hover:shadow-[0_0_18px_-8px_color-mix(in_oklab,var(--primary)_55%,transparent)] hover:-translate-y-px",
        secondary:
          "border border-border/60 bg-secondary/80 text-secondary-foreground shadow-sm hover:border-primary/35 hover:bg-secondary hover:shadow-[0_0_18px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)] hover:-translate-y-px",
        ghost:
          "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_14px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:-translate-y-px",
        link: "h-auto rounded-none px-0 text-primary underline-offset-4 hover:underline hover:text-primary/80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        disabled={!asChild ? disabled || loading : undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
