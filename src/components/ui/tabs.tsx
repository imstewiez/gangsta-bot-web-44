import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TAB_LABELS: Record<string, string> = {
  "As minhas": "Minhas",
  "Para tratar": "Gestão",
  "Para conferir": "Gestão",
  "A decorrer": "Ativas",
  "Histórico": "Arquivo",
  "Arquivo de Encomendas": "Arquivo",
};

function normalizeTabChildren(children: React.ReactNode) {
  if (typeof children !== "string") return children;
  return TAB_LABELS[children] ?? children;
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 rounded-2xl border border-primary/15 bg-card/45 p-1.5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex min-h-10 min-w-[112px] cursor-pointer items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-display text-[11px] font-black uppercase tracking-[0.12em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground/80 hover:bg-primary/8 hover:text-foreground",
      "data-[state=active]:border data-[state=active]:border-primary/35 data-[state=active]:bg-primary/18 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_18px_-10px_color-mix(in_oklab,var(--primary)_95%,transparent)]",
      className,
    )}
    {...props}
  >
    {normalizeTabChildren(children)}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
