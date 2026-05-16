import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import ballasLogo from "@/assets/ballas-logo.png";
import { ArrowRight, Lock, KeyRound, ShieldAlert } from "lucide-react";
import { CinematicBackdrop } from "@/components/layout/CinematicBackdrop";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (isServer()) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="ambient-bg relative min-h-screen overflow-hidden">
      <CinematicBackdrop />

      {/* Decorative scanlines + corner crosshair frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent 0 2px, oklch(1 0 0 / 0.6) 2px 3px)",
        }}
      />
      <CornerMarks />

      <div className="pointer-events-none absolute inset-x-0 top-0 hairline-top" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between animate-rise">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 -z-10 rounded-full bg-primary/40 blur-2xl animate-pulse-glow" />
              <img
                src={ballasLogo}
                alt="Ballas Gang"
                className="h-12 w-12 rounded-sm object-contain drop-shadow-[0_0_22px_color-mix(in_oklab,var(--primary)_85%,transparent)]"
              />
            </div>
            <div className="leading-tight">
              <div className="text-display text-sm tracking-[0.32em]">
                Ballas <span className="bg-gradient-to-b from-primary to-blood bg-clip-text text-transparent">Gang</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.32em] text-muted-foreground/80">
                <ShieldAlert className="h-3 w-3 text-primary/80" />
                Acesso reservado
              </div>
            </div>
          </div>
          <Link
            to="/login"
            className="btn-shine group inline-flex items-center gap-2 rounded-sm border border-border/80 bg-background/40 px-5 py-2.5 text-display text-xs tracking-[0.25em] text-muted-foreground backdrop-blur transition-all hover:border-primary/70 hover:text-foreground hover:shadow-[0_0_24px_-8px_var(--primary)]"
          >
            <KeyRound className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
            Entrar
          </Link>
        </header>

        {/* Hero */}
        <section className="relative my-auto py-16 animate-rise delay-100">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-primary backdrop-blur-md shadow-[0_0_30px_-10px_var(--primary)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-70 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Apenas membros
          </div>

          {/* Headline — leading-tight + pt on second line so the É acento has air */}
          <h1 className="mt-7 max-w-3xl text-display text-6xl font-bold leading-[1.05] md:text-8xl md:leading-[1.02] text-glow">
            <span className="block">O bairro</span>
            <span className="block bg-gradient-to-b from-primary via-primary/90 to-blood bg-clip-text text-transparent pt-2 md:pt-3">
              é nosso.
            </span>
          </h1>

          <div className="mt-8 flex max-w-lg items-start gap-3">
            <span className="mt-2 block h-px w-10 shrink-0 bg-gradient-to-r from-primary to-transparent" />
            <p className="text-base leading-relaxed text-muted-foreground/90">
              Acesso restrito. Membros apenas. Se não és da firma, não há nada para ti aqui.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link
              to="/login"
              className="btn-shine group relative inline-flex items-center gap-2 rounded-sm bg-gradient-to-b from-primary to-blood px-8 py-4 text-display text-sm font-bold tracking-[0.18em] text-primary-foreground shadow-[0_0_40px_-6px_var(--primary)] transition-all hover:shadow-[0_0_60px_-4px_var(--primary)] hover:-translate-y-0.5"
            >
              <span className="absolute -inset-px rounded-sm bg-gradient-to-b from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              Entrar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

          </div>


        </section>

        <footer className="border-t border-border/40 pt-6 text-[11px] uppercase tracking-[0.28em] text-muted-foreground/60">
          <span>© Ballas Gang</span>
        </footer>
      </div>
    </div>
  );
}

function CornerMarks() {
  const base =
    "pointer-events-none absolute h-6 w-6 border-primary/40";
  return (
    <>
      <div className={`${base} top-4 left-4 border-l border-t`} />
      <div className={`${base} top-4 right-4 border-r border-t`} />
      <div className={`${base} bottom-4 left-4 border-l border-b`} />
      <div className={`${base} bottom-4 right-4 border-r border-b`} />
    </>
  );
}
