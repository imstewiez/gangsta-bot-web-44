import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "primary";

const TONE_MAP: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  primary: "bg-primary/15 text-primary border-primary/30",
};

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
  size = "sm",
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium uppercase tracking-wider",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-[11px]",
        TONE_MAP[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
