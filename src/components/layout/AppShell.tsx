import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CinematicBackdrop } from "./CinematicBackdrop";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      setScrolled((t.scrollTop ?? 0) > 8);
    };
    const scroller = document.querySelector<HTMLDivElement>("[data-app-scroll]");
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller?.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <SidebarProvider>
      <div className="ambient-bg flex h-screen w-full overflow-hidden">
        <CinematicBackdrop />
        <AppSidebar />

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <header
            className={[
              "shrink-0 z-40 relative flex h-14 items-center gap-2 border-b px-3 transition-all duration-300",
              scrolled
                ? "border-border/70 bg-background/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 shadow-[0_8px_24px_-12px_oklch(0_0_0_/_0.5)]"
                : "border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/30",
            ].join(" ")}
          >
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell />
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px hairline-top" />
          </header>

          <div data-app-scroll className="flex-1 overflow-y-auto">
            <main className="mx-auto w-full max-w-7xl px-4 py-10 animate-rise">
              {children}
            </main>

            <footer className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-border/40 px-4 py-8 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50 font-display">
              <span>© Ballas Gang</span>
              <span className="hidden sm:inline opacity-60">Cinematic Noir Edition</span>
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
    <div className="relative mb-10 reveal">
      {/* Decorative left rule */}
      <div aria-hidden className="absolute -left-4 top-1 hidden h-12 w-px bg-gradient-to-b from-primary/70 via-primary/30 to-transparent md:block" />

      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="min-w-0">
          {eyebrow && (
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-display text-[10px] tracking-[0.42em] text-primary/90 uppercase">
                {eyebrow}
              </span>
              <span aria-hidden className="ml-1 h-px w-8 bg-gradient-to-r from-primary/60 to-transparent" />
            </div>
          )}
          <h1 className="text-display text-3xl md:text-5xl font-bold tracking-tight leading-[0.95] text-glow flex items-center gap-3">
            {Icon && (
              <span className="grid place-items-center h-11 w-11 rounded-md bg-gradient-to-br from-primary/20 to-blood/10 ring-1 ring-inset ring-primary/40 text-primary shadow-[inset_0_1px_0_oklch(1_0_0_/_0.08)]">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <span className="truncate">{title}</span>
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
