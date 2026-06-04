import type { ReactNode } from "react";
import { Activity } from "lucide-react";

import { CinematicBackdrop } from "./CinematicBackdrop";
import { AppSidebar } from "./AppSidebar";
import { HeaderNotifications } from "./HeaderNotifications";
import { HeaderTicker } from "./HeaderTicker";
import { MobileSidebarButton } from "./MobileSidebarButton";
import { ViewAsExitButton } from "./ViewAsExitButton";
import { Reveal } from "./Reveal";

import { SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="ambient-bg relative flex h-dvh w-dvw max-w-dvw overflow-hidden">
        <CinematicBackdrop />
        <AppSidebar />

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative z-40 w-full max-w-full shrink-0 overflow-hidden px-3 pt-3 md:px-5">
            <div className="app-shell-topbar mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 md:px-4">
              <div className="liquid-content flex min-w-0 items-center">
                <MobileSidebarButton />
              </div>

              <HeaderTicker />

              <div className="liquid-content flex min-w-0 items-center justify-end gap-2 justify-self-end">
                <ViewAsExitButton />
                <HeaderNotifications />
              </div>
            </div>
          </header>

          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
            <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-7 md:px-6 md:py-9 xl:px-8">
              {children}
            </main>

            <footer className="mx-auto flex w-full max-w-7xl items-center justify-between overflow-hidden border-t border-border/20 px-4 py-5 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/35 font-display md:px-6 xl:px-8">
              <span>© Ballas Gang</span>
            </footer>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
  icon: Icon = Activity,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const section = eyebrow || "Ballas Gang";

  return (
    <div className="page-header relative mb-7 max-w-full overflow-hidden md:mb-9">
      <div className="flex max-w-full flex-col gap-4 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <Reveal delay={0} direction="up">
            <div className="page-header-kicker mb-2 flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_16px_color-mix(in_oklab,var(--primary)_80%,transparent)]" />
              <span className="truncate text-display text-[11px] tracking-[0.28em] text-primary md:tracking-[0.35em]">{section}</span>
            </div>
          </Reveal>

          <Reveal delay={60} direction="up">
            <div className="page-header-title-row flex min-w-0 max-w-full items-center gap-3">
              <span className="page-header-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/35 bg-primary/10 text-primary backdrop-blur-xl shadow-[0_0_28px_-16px_color-mix(in_oklab,var(--primary)_90%,transparent)] md:h-11 md:w-11">
                <Icon className="h-5 w-5" />
              </span>
              <h1 className="min-w-0 max-w-full truncate text-display text-[1.9rem] font-black leading-[0.95] tracking-tight text-foreground md:text-4xl">
                {title}
              </h1>
            </div>
          </Reveal>
        </div>

        {action && <div className="page-header-action relative min-w-0 shrink-0 md:pb-1">{action}</div>}
      </div>
      <div className="hairline-top opacity-60" />
    </div>
  );
}
