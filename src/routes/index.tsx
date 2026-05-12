import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import redwoodLogo from "@/assets/redwood-logo.png";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-grain">
      {/* mood backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(80% 60% at 20% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 60%), radial-gradient(60% 50% at 100% 100%, color-mix(in oklab, var(--blood) 14%, transparent) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={redwoodLogo} alt="RedWood" className="h-12 w-12 rounded-sm object-contain drop-shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_65%,transparent)]" />
            <div className="leading-tight">
              <div className="text-display text-sm tracking-[0.25em]">Firma RedWood</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Bairro · desde sempre
              </div>
            </div>
          </div>
          <Link
            to="/login"
            className="rounded-sm border border-border px-4 py-2 text-display text-xs tracking-widest text-muted-foreground hover:border-primary/60 hover:text-foreground"
          >
            Entrar
          </Link>
        </header>

        <main className="my-auto max-w-2xl py-20">
          <div className="text-display text-[11px] tracking-[0.4em] text-primary">
            ⸻  Acesso reservado  ⸻
          </div>
          <h1 className="mt-6 text-display text-6xl font-bold leading-[0.95] md:text-7xl">
            O bairro
            <br />
            <span className="text-primary">é nosso.</span>
          </h1>
          <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
            Casa fechada. Quem é de cá, sabe a porta. Se chegaste aqui por engano,
            faz o teu caminho — não há nada para ver.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-sm bg-primary px-7 py-3.5 text-display text-sm font-bold tracking-wider text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_30px_-5px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
            >
              Bater à porta
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <span className="text-xs uppercase tracking-widest text-muted-foreground/70">
              Só para os de dentro
            </span>
          </div>
        </main>

        <footer className="flex items-center justify-between border-t border-border/50 pt-6 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          <span>© Firma RedWood</span>
          <span>Lealdade primeiro · resto depois</span>
        </footer>
      </div>
    </div>
  );
}
