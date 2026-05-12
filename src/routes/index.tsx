import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import redwoodLogo from "@/assets/redwood-logo.png";
import { ArrowRight, Lock } from "lucide-react";
import { CinematicBackdrop } from "@/components/layout/CinematicBackdrop";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="ambient-bg relative min-h-screen overflow-hidden">
      <CinematicBackdrop />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hairline-top" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between animate-rise">
          <div className="flex items-center gap-3">
            <img
              src={redwoodLogo}
              alt="RedWood"
              className="h-11 w-11 rounded-sm object-contain drop-shadow-[0_0_22px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
            />
            <div className="leading-tight">
              <div className="text-display text-sm tracking-[0.28em]">RedWood</div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                Privado
              </div>
            </div>
          </div>
          <Link
            to="/login"
            className="btn-shine inline-flex items-center gap-2 rounded-sm border border-border/80 bg-background/40 px-4 py-2 text-display text-xs tracking-widest text-muted-foreground backdrop-blur transition-all hover:border-primary/70 hover:text-foreground hover:shadow-[0_0_24px_-8px_var(--primary)]"
          >
            Entrar
          </Link>
        </header>

        <section className="my-auto py-16 animate-rise delay-100">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-primary backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Acesso reservado
          </div>

          <h1 className="mt-8 text-display text-6xl font-bold leading-[0.95] md:text-8xl text-glow">
            RedWood.
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground/90">
            Se tens lugar, entra. Se não tens, não há nada para ver.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="btn-shine group inline-flex items-center gap-2 rounded-sm bg-primary px-7 py-3.5 text-display text-sm font-bold tracking-wider text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_40px_-6px_var(--primary)]"
            >
              Entrar com Discord
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70">
              <Lock className="h-3 w-3" /> Só para membros
            </span>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-border/40 pt-6 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          <span>© RedWood</span>
          <span className="hidden sm:inline">Casa fechada</span>
        </footer>
      </div>
    </div>
  );
}
