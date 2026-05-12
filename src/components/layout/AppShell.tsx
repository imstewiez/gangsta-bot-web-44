import { TopNav } from "./TopNav";
import type { ReactNode } from "react";
import { CinematicBackdrop } from "./CinematicBackdrop";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="ambient-bg min-h-screen">
      <CinematicBackdrop />
      <div className="hairline-top sticky top-0 z-50" />
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-10 animate-rise">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 py-8 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50 flex items-center justify-between border-t border-border/40 mt-12">
        <span>© Firma RedWood</span>
        <span>Lealdade primeiro · resto depois</span>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow, title, description, action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
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
          <h1 className="text-display text-4xl md:text-5xl font-bold tracking-tight leading-[0.95] text-glow">
            {title}
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
