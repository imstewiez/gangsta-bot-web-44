import type { ReactNode } from "react";
import { CinematicBackdrop } from "./CinematicBackdrop";
import { AppSidebar } from "./AppSidebar";
import { ViewAsSwitcher } from "./ViewAsSwitcher";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Reveal } from "./Reveal";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="ambient-bg flex h-screen w-full overflow-hidden">
        <CinematicBackdrop />
        <AppSidebar />

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="shrink-0 z-40 flex h-14 items-center gap-2 border-b border-border/40 bg-background/60 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <div className="ml-auto flex items-center gap-3">
              <ViewAsSwitcher />
            </div>
            <div aria-hidden className="absolute inset-x-0 -bottom-px hairline-top opacity-60" />
          </header>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
              {children}
            </main>

            <footer className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-border/30 px-4 py-6 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/40 font-display">
              <span>© Ballas Gang</span>
              <span className="hidden sm:inline">Built for the block</span>
            </footer>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function PageHeader({
  eyebrow, title, description, action, icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative mb-8 md:mb-10">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          {eyebrow && (
            <Reveal delay={0} direction="up">
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="text-display text-[11px] tracking-[0.35em] text-primary">{eyebrow}</span>
              </div>
            </Reveal>
          )}
          <Reveal delay={eyebrow ? 60 : 0} direction="up">
            <h1 className="text-display text-3xl md:text-4xl font-bold tracking-tight leading-[0.95] text-glow flex items-center gap-3">
              {Icon && (
                <span className="grid place-items-center h-10 w-10 rounded-md bg-primary/15 ring-1 ring-inset ring-primary/40 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <span>{title}</span>
            </h1>
          </Reveal>
          {description && (
            <Reveal delay={eyebrow ? 120 : 60} direction="up">
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
            </Reveal>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="hairline-top opacity-60" />
    </div>
  );
}
