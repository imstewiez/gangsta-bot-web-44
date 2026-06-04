import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type WorkflowTabItem = {
  value: string;
  label: string;
  hint?: string;
};

export function WorkflowTabs({ items, variant = "primary", className }: { items: WorkflowTabItem[]; variant?: "primary" | "secondary"; className?: string }) {
  const isPrimary = variant === "primary";
  return (
    <TabsList
      className={cn(
        "flex h-auto w-full flex-wrap items-stretch justify-start gap-1 border-primary/15 bg-card/45 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl",
        isPrimary ? "rounded-2xl" : "rounded-xl border-border/35 bg-background/35 p-1",
        className,
      )}
    >
      {items.map((item) => (
        <TabsTrigger
          key={item.value}
          value={item.value}
          className={cn(
            "interactive-tab group min-w-[132px] flex-1 flex-col items-start gap-0.5 rounded-xl px-4 text-left transition-all",
            isPrimary ? "min-h-[54px] py-2.5" : "min-h-[42px] py-2",
            "data-[state=active]:bg-primary/18 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_18px_-10px_color-mix(in_oklab,var(--primary)_90%,transparent)]",
            "data-[state=active]:from-transparent data-[state=active]:to-transparent",
          )}
        >
          <span className="text-display text-[12px] font-black uppercase tracking-[0.13em] text-inherit">{item.label}</span>
          {item.hint && <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground/70 group-data-[state=active]:text-primary/70">{item.hint}</span>}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
