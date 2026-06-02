import type { ReactNode } from "react";
import { Bell, Sparkles } from "lucide-react";

import { CinematicBackdrop } from "./CinematicBackdrop";
import { AppSidebar } from "./AppSidebar";
import { Reveal } from "./Reveal";

import { SidebarProvider } from "@/components/ui/sidebar";

const TICKER_MESSAGES = [
  "Ballas Gang!",
  "É a firma moh!",
  "Sim sim...",
  "Bora meter atividade!",
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="ambient-bg flex h-screen w-full overflow-hidden">
        <CinematicBackdrop />
        <AppSidebar />

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative z-40 shrink-0 px-3 pt-3 md:px-5">
            <div className="app-shell-topbar mx-auto grid w-full max-w-7xl grid-cols-1 gap-2 px-3 py-2 md:px-4 lg:grid-cols-[minmax(150px,auto)_minmax(220px,1fr)_auto] lg:items-center">
              <div className="liquid-content flex min-w-0 items-center gap-3">
                <span className="shell-liquid-mark shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </span>
                <div className="hidden min-w-0 sm:block">
                  <div className="text-display text-[10px] tracking-[0.28em] text-primary">Ballas Gang</div>
                  <div className="text-xs text-muted-foreground/70">Painel interno</div>
                </div>
              </div>

              <div className="liquid-content header-ticker min-w-0 order-3 lg:order-none" aria-label="Mensagens do header">
                <div className="header-ticker-track">
                  {TICKER_MESSAGES.map((message) => (
                    <span key={message} className="header-ticker-message">
                      <span className="header-ticker-item">
                        <span className="header-ticker-dot" />
                        {message}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="liquid-content min-w-0 justify-self-stretch lg:justify-self-end">
                <button
                  type="button"
                  title="Notificações"
                  className="relative grid h-10 w-10 place-items-center rounded-xl border border-primary/25 bg-background/45 text-primary backdrop-blur-xl transition-colors hover:bg-primary/12"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_80%,transparent)]" />
                  <span className="sr-only">Notificações</span>
                </button>
              </div>
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
