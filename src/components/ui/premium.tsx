import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { Loader2, SearchX, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type PremiumTone = "default" | "primary" | "success" | "warning" | "destructive" | "info";

type IconType = ComponentType<{ className?: string }>;

const toneStyles: Record<PremiumTone, {
  ring: string;
  icon: string;
  iconShell: string;
  value: string;
  badge: string;
}> = {
  default: {
    ring: "border-border/60",
    icon: "text-muted-foreground",
    iconShell: "bg-muted/40 ring-border/50",
    value: "text-foreground",
    badge: "border-border/60 bg-muted/40 text-muted-foreground",
  },
  primary: {
    ring: "border-primary/40",
    icon: "text-primary",
    iconShell: "bg-primary/12 ring-primary/35",
    value: "text-primary",
    badge: "border-primary/35 bg-primary/12 text-primary",
  },
  success: {
    ring: "border-success/35",
    icon: "text-success",
    iconShell: "bg-success/12 ring-success/35",
    value: "text-success",
    badge: "border-success/35 bg-success/12 text-success",
  },
  warning: {
    ring: "border-warning/35",
    icon: "text-warning",
    iconShell: "bg-warning/12 ring-warning/35",
    value: "text-warning",
    badge: "border-warning/35 bg-warning/12 text-warning",
  },
  destructive: {
    ring: "border-destructive/35",
    icon: "text-destructive",
    iconShell: "bg-destructive/12 ring-destructive/35",
    value: "text-destructive",
    badge: "border-destructive/35 bg-destructive/12 text-destructive",
  },
  info: {
    ring: "border-info/35",
    icon: "text-info",
    iconShell: "bg-info/12 ring-info/35",
    value: "text-info",
    badge: "border-info/35 bg-info/12 text-info",
  },
};

export interface LiquidCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  glow?: boolean;
}

export function LiquidCard({
  className,
  interactive = false,
  glow = false,
  children,
  ...props
}: LiquidCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/62 shadow-[0_22px_70px_-36px_rgba(0,0,0,0.95)] backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/60 before:to-transparent",
        "after:pointer-events-none after:absolute after:-right-20 after:-top-20 after:h-48 after:w-48 after:rounded-full after:bg-primary/10 after:blur-3xl after:transition-opacity after:duration-500",
        interactive && "interactive-card hover:bg-card/72",
        glow && "border-primary/40 shadow-[0_0_45px_-22px_color-mix(in_oklab,var(--primary)_55%,transparent),0_22px_70px_-36px_rgba(0,0,0,0.95)]",
        className,
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value?: ReactNode;
  subtext?: ReactNode;
  icon?: IconType;
  tone?: PremiumTone;
  loading?: boolean;
  badge?: ReactNode;
}

export function StatCard({
  className,
  label,
  value,
  subtext,
  icon: Icon,
  tone = "default",
  loading = false,
  badge,
  ...props
}: StatCardProps) {
  const styles = toneStyles[tone];

  return (
    <LiquidCard
      interactive
      className={cn("p-4 md:p-5", styles.ring, tone === "primary" && "bg-primary/8", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-display text-[10px] tracking-[0.22em] text-muted-foreground/85">
            {label}
          </div>
          <div className={cn("mt-2 min-h-9 text-3xl font-black leading-none tracking-tight tabular-nums font-display", styles.value)}>
            {loading ? <span className="block h-8 w-24 animate-pulse rounded-lg bg-primary/12" /> : value ?? "—"}
          </div>
        </div>
        {Icon && (
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset", styles.iconShell)}>
            <Icon className={cn("h-5 w-5", styles.icon)} />
          </span>
        )}
      </div>
      {(subtext || badge) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/75">
          {subtext && <span>{subtext}</span>}
          {badge && (
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", styles.badge)}>
              {badge}
            </span>
          )}
        </div>
      )}
    </LiquidCard>
  );
}

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  icon?: IconType;
  action?: ReactNode;
}

export function SectionHeader({
  className,
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)} {...props}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2 text-display text-[10px] tracking-[0.26em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
        )}
        <h2 className="flex items-center gap-2 text-display text-xl font-bold tracking-tight text-foreground md:text-2xl">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <span>{title}</span>
        </h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: ReactNode;
  icon?: IconType;
  action?: ReactNode;
}

export function EmptyState({
  className,
  title,
  description,
  icon: Icon = SearchX,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <LiquidCard className={cn("px-6 py-10 text-center", className)} {...props}>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/30">
        <Icon className="h-6 w-6 text-primary" />
      </span>
      <h3 className="mt-4 text-display text-sm font-semibold tracking-[0.18em] text-foreground">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </LiquidCard>
  );
}

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: ReactNode;
}

export function LoadingState({
  className,
  title = "A carregar",
  description,
  ...props
}: LoadingStateProps) {
  return (
    <LiquidCard className={cn("flex items-center gap-4 px-5 py-4", className)} {...props}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/30">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </span>
      <div>
        <div className="text-display text-xs tracking-[0.2em] text-foreground">{title}</div>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
    </LiquidCard>
  );
}

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  actions?: ReactNode;
}

export function FilterBar({ className, label, actions, children, ...props }: FilterBarProps) {
  return (
    <LiquidCard className={cn("p-3 md:p-4", className)} {...props}>
      {(label || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {label && <div className="text-display text-[10px] tracking-[0.24em] text-muted-foreground">{label}</div>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </LiquidCard>
  );
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PremiumTone;
  icon?: IconType;
  children: ReactNode;
}

export function StatusBadge({ className, tone = "default", icon: Icon, children, ...props }: StatusBadgeProps) {
  const styles = toneStyles[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        styles.badge,
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
