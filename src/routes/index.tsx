import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import redwoodLogo from "@/assets/redwood-logo.png";
import { Activity, ShieldCheck, Boxes, Users, ArrowRight } from "lucide-react";

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
      {/* floating ambient orbs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-[460px] w-[460px] rounded-full bg-primary/15 blur-[120px] animate-float-slow" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-blood/15 blur-[120px] animate-float-slow" style={{ animationDelay: "3s" }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hairline-top" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between animate-rise">
          <div className="flex items-center gap-3">
            <img
              src={redwoodLogo}
              alt="Firma RedWood"
              className="h-12 w-12 rounded-sm object-contain drop-shadow-[0_0_22px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
            />
            <div className="leading-tight">
              <div className="text-display text-sm tracking-[0.28em]">Firma RedWood</div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                Bairro · desde sempre
              </div>
            </div>
          </div>
          <Link
            to="/login"
            className="btn-shine rounded-sm border border-border/80 px-5 py-2.5 text-display text-xs tracking-widest text-muted-foreground transition-all hover:border-primary/70 hover:text-foreground hover:shadow-[0_0_24px_-8px_var(--primary)]"
          >
            Entrar
          </Link>
        </header>

        {/* Hero grid */}
        <section className="my-auto grid grid-cols-12 gap-8 py-16">
          {/* Left — manifesto */}
          <div className="col-span-12 lg:col-span-7 animate-rise delay-100">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Acesso reservado
            </div>

            <h1 className="mt-7 text-display text-6xl font-bold leading-[0.92] md:text-8xl text-glow">
              O bairro
              <br />
              <span className="bg-gradient-to-b from-primary to-blood bg-clip-text text-transparent">
                é nosso.
              </span>
            </h1>

            <p className="mt-8 max-w-lg text-base leading-relaxed text-muted-foreground">
              Casa fechada. Quem é de cá, sabe a porta. Se chegaste aqui por engano,
              faz o teu caminho — não há nada para ver.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="btn-shine group inline-flex items-center gap-2 rounded-sm bg-primary px-7 py-3.5 text-display text-sm font-bold tracking-wider text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_40px_-6px_var(--primary)]"
              >
                Bater à porta
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70">
                Só para os de dentro
              </span>
            </div>

            {/* Stats strip */}
            <div className="mt-14 grid max-w-lg grid-cols-3 gap-4 border-t border-border/50 pt-6">
              <Stat label="Membros" value="48" />
              <Stat label="Operações" value="312" />
              <Stat label="Lealdade" value="∞" />
            </div>
          </div>

          {/* Right — live ops card */}
          <div className="col-span-12 lg:col-span-5 animate-rise delay-200">
            <div className="card-frame rounded-xl p-6">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-display text-sm tracking-widest">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Operações em curso
                </h3>
                <span className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Live
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <FeedRow
                  icon={<Boxes className="h-4 w-4" />}
                  title="Carregamento #402"
                  meta="Armazém · Capo Vercetti"
                  status="Em trânsito"
                  tone="primary"
                />
                <FeedRow
                  icon={<Users className="h-4 w-4" />}
                  title="Novo recruta · Ghost"
                  meta="A aguardar aprovação"
                  status="Pendente"
                  tone="muted"
                />
                <FeedRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Lavagem finalizada"
                  meta="450 000 € · taxa 15%"
                  status="Concluído"
                  tone="success"
                />
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                <div className="flex -space-x-2">
                  {["R", "E", "W"].map((l, i) => (
                    <span
                      key={l}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold"
                      style={{ background: i === 2 ? "var(--primary)" : undefined }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 italic">
                  Protocolo seguro
                </span>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-border/40 pt-6 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          <span className="flex items-center gap-2">
            <Activity className="h-3 w-3" /> © Firma RedWood
          </span>
          <span>Lealdade primeiro · resto depois</span>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-display text-3xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function FeedRow({
  icon, title, meta, status, tone,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  status: string;
  tone: "primary" | "muted" | "success";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/30",
    muted: "bg-muted/50 text-muted-foreground border-border",
    success: "bg-success/10 text-success border-success/30",
  };
  const iconBg: Record<string, string> = {
    primary: "bg-gradient-to-br from-primary to-blood text-primary-foreground shadow-[0_0_20px_-6px_var(--primary)]",
    muted: "bg-secondary text-muted-foreground",
    success: "bg-success/20 text-success",
  };
  return (
    <div className="group flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3 transition-all hover:border-primary/30 hover:bg-background/70">
      <div className="flex items-center gap-3">
        <div className={"flex h-9 w-9 items-center justify-center rounded-md " + iconBg[tone]}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{meta}</div>
        </div>
      </div>
      <span className={"rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider " + tones[tone]}>
        {status}
      </span>
    </div>
  );
}
