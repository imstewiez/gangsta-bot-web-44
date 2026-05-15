import type { ReactNode } from "react";
import { CinematicBackdrop } from "./CinematicBackdrop";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { RedWoodBrand } from "./RedWoodBrand";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="ambient-bg flex h-screen w-full overflow-hidden">
        <CinematicBackdrop />
        <AppSidebar />

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="shrink-0 z-40 flex h-14 items-center gap-2 border-b border-border/60 bg-background/70 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="ml-auto flex items-center gap-3">
              <RedWoodBrand size="sm" />
              <NotificationBell />
            </div>
            <div aria-hidden className="absolute inset-x-0 -bottom-px hairline-top" />
          </header>

          <div className="flex-1 overflow-y-auto">
            <main className="mx-auto w-full max-w-7xl px-4 py-10 animate-rise">
              {children}
            </main>

            <footer className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-border/40 px-4 py-8 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
              <span>© Ballas Gang</span>
              <span>Sangue · Roxo · Bairro</span>
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
    <div className="relative mb-10 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          {eyebrow && (
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-display text-[11px] tracking-[0.35em] text-primary">{eyebrow}</span>
            </div>
          )}
          <h1 className="text-display text-4xl md:text-5xl font-bold tracking-tight leading-[0.95] text-glow flex items-center gap-3">
            {Icon && (
              <span className="grid place-items-center h-11 w-11 rounded-md bg-primary/15 ring-1 ring-inset ring-primary/40 text-primary">
                <Icon className="h-6 w-6" />
              </span>
            )}
            <span>{title}</span>
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="hairline-top" />
    </div>
  );
}
