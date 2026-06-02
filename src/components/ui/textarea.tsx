import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[74px] w-full rounded-xl border border-input/85 bg-background/35 px-3 py-2 text-base shadow-sm backdrop-blur-xl placeholder:text-muted-foreground/70 focus-visible:border-primary/55 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/55 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
