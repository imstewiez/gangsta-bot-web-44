import type { ReactNode } from "react";

import { CinematicBackdrop } from "./CinematicBackdrop";
import { AppSidebar } from "./AppSidebar";
import { ViewAsSwitcher } from "./ViewAsSwitcher";
import { Reveal } from "./Reveal";

import { SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="ambient-bg flex h-screen w-full overflow-hidden">
        <CinematicBackdrop />
        <AppSidebar />

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative z-40 shrink-0 px-3 pt-3 md:px-5">
            <div className="app-shell-topbar mx-auto flex w-full max-w-7xl items-center justify-end px-3 py-2 md:px-4">
              <ViewAsSwitcher />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6 md:py-9 xl:px-8">
              {children}
            </main>

            <footer className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-border/20 px-4 py-5 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/35 font-display md:px-6 xl:px-8">
              <span>© Ballas Gang</span>
            </footer>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function PageHeader({
  eyebrow, title, action, icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative mb-7 md:mb-9">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div className="min-w-0">
          {eyebrow && (
            <Reveal delay={0} direction="up">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_16px_color-mix(in_oklab,var(--primary)_80%,transparent)]" />
                <span className="text-display text-[11px] tracking-[0.35em] text-primary">{eyebrow}</span>
              </div>
            </Reveal>
          )}
          <Reveal delay={eyebrow ? 60 : 0} direction="up">
            <h1 className="flex items-center gap-3 text-display text-3xl font-black leading-[0.95] tracking-tight text-foreground md:text-4xl">
              {Icon && (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/35 bg-primary/10 text-primary backdrop-blur-xl">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0 break-words">{title}</span>
            </h1>
          </Reveal>
        </div>
        {action && <div className="relative shrink-0">{action}</div>}
      </div>
      <div className="hairline-top opacity-60" />
    </div>
  );
}
