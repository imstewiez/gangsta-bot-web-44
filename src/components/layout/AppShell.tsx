import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { CinematicBackdrop } from "./CinematicBackdrop";
import { AppSidebar } from "./AppSidebar";
import { ViewAsSwitcher } from "./ViewAsSwitcher";
import { Reveal } from "./Reveal";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="ambient-bg flex h-screen w-full overflow-hidden">
        <CinematicBackdrop />
        <AppSidebar />

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative z-40 shrink-0 px-3 pt-3 md:px-5">
            <div className="mx-auto w-full max-w-7xl rounded-[1.35rem] border border-white/10 bg-background/34 px-3 py-2 shadow-[0_18px_70px_-42px_rgba(0,0,0,0.95)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/24">
              <div aria-hidden className="pointer-events-none absolute inset-x-8 top-3 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
              <div className="relative flex min-h-10 flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
                <SidebarTrigger className="h-9 w-9 shrink-0 rounded-xl border border-border/45 bg-white/[0.04] text-muted-foreground hover:border-primary/45 hover:bg-primary/10 hover:text-primary" />

                <div className="hidden min-w-0 items-center gap-3 lg:flex">
                  <div className="h-7 w-px bg-gradient-to-b from-transparent via-primary/35 to-transparent" />
                  <div className="min-w-0">
                    <div className="text-display text-[10px] tracking-[0.32em] text-primary/90">Painel interno</div>
                    <div className="truncate text-xs text-muted-foreground/65">Operação · Membros · Inventário</div>
                  </div>
                </div>

                <div className="ml-auto flex min-w-0 flex-1 justify-end lg:flex-none">
                  <ViewAsSwitcher />
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6 md:py-9 xl:px-8">
              {children}
            </main>

            <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-border/20 px-4 py-6 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/40 font-display md:px-6 xl:px-8">
              <span>© Ballas Gang</span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary/55" />
                Gestão interna
              </span>
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
          {description && (
            <Reveal delay={eyebrow ? 120 : 60} direction="up">
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
            </Reveal>
          )}
        </div>
        {action && <div className="relative shrink-0">{action}</div>}
      </div>
      <div className="hairline-top opacity-60" />
    </div>
  );
}
