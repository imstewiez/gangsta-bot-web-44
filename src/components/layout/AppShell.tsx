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
          <header className="relative z-40 shrink-0 border-b border-border/40 bg-background/42 px-3 py-2 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/32 md:px-5">
            <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-xl border border-border/40 bg-white/[0.035] text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary" />
              <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
                <div className="h-7 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                <div className="min-w-0">
                  <div className="text-display text-[10px] tracking-[0.32em] text-primary/90">Ballas Gang</div>
                  <div className="truncate text-xs text-muted-foreground/75">Gestão interna do bairro · operação, materiais e membros</div>
                </div>
              </div>
              <div className="ml-auto flex min-w-0 items-center justify-end gap-3">
                <ViewAsSwitcher />
              </div>
            </div>
            <div aria-hidden className="absolute inset-x-0 -bottom-px hairline-top opacity-70" />
          </header>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6 md:py-10 xl:px-8">
              {children}
            </main>

            <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-border/25 px-4 py-6 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/45 font-display md:px-6 xl:px-8">
              <span>© Ballas Gang</span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary/55" />
                Built for the block
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
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-border/45 bg-card/38 px-5 py-5 shadow-[0_22px_70px_-42px_rgba(0,0,0,0.95)] backdrop-blur-2xl md:mb-10 md:px-6 md:py-6">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <Reveal delay={0} direction="up">
              <div className="mb-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="text-display text-[11px] tracking-[0.35em] text-primary">{eyebrow}</span>
              </div>
            </Reveal>
          )}
          <Reveal delay={eyebrow ? 60 : 0} direction="up">
            <h1 className="flex items-center gap-3 text-display text-3xl font-black leading-[0.95] tracking-tight text-glow md:text-5xl">
              {Icon && (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/14 text-primary ring-1 ring-inset ring-primary/40 shadow-[0_0_24px_-10px_color-mix(in_oklab,var(--primary)_85%,transparent)]">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0 break-words">{title}</span>
            </h1>
          </Reveal>
          {description && (
            <Reveal delay={eyebrow ? 120 : 60} direction="up">
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">{description}</p>
            </Reveal>
          )}
        </div>
        {action && <div className="relative shrink-0">{action}</div>}
      </div>
    </div>
  );
}
