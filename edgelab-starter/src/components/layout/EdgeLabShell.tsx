import type { ReactNode } from "react";
import { Menu, Sparkles } from "lucide-react";

import { EdgeLabSidebar } from "./EdgeLabSidebar";

export function EdgeLabShell({ children }: { children: ReactNode }) {
  return (
    <div className="ambient-bg flex h-dvh w-dvw overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_36%),radial-gradient(circle_at_bottom_right,color-mix(in_oklab,var(--info)_14%,transparent),transparent_32%)]" />
      <EdgeLabSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 px-4 pt-4 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between rounded-3xl border border-border/40 bg-card/50 px-4 py-3 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <button className="grid h-10 w-10 place-items-center rounded-2xl border border-border/40 bg-background/40 lg:hidden" type="button" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </button>
              <span className="hidden h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary sm:grid">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-display text-xs tracking-[0.22em] text-primary">EdgeLab</p>
                <p className="truncate text-xs text-muted-foreground">Strategy backtesting workspace</p>
              </div>
            </div>

            <div className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground md:block">
              v0.1 Research Build
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6 md:py-9 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function EdgeLabPageHeader({ eyebrow, title, description, icon: Icon = Sparkles }: { eyebrow?: string; title: string; description?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-7">
      <div className="mb-2 flex items-center gap-2 text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-display text-[11px] tracking-[0.28em]">{eyebrow ?? "EdgeLab"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/35 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-display text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="mt-5 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    </div>
  );
}
