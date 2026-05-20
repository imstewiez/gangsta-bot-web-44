import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import ballasLogo from "@/assets/ballas-logo.png";
import { ArrowRight, ShieldAlert, Lock, Eye, Crown } from "lucide-react";
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
  const [scrollY, setScrollY] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    const onMouse = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setMouse({ x: (e.clientX - cx) / cx, y: (e.clientY - cy) / cy });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  // Reveal-on-scroll
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const parallax = (factor: number) => ({
    transform: `translate3d(${mouse.x * factor}px, ${mouse.y * factor + scrollY * factor * 0.05}px, 0)`,
  });

  return (
    <div className="ambient-bg relative min-h-screen overflow-x-hidden">
      <CinematicBackdrop />

      {/* Scanlines */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[5] opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent 0 2px, oklch(1 0 0 / 0.7) 2px 3px)",
        }}
      />

      <CornerMarks />

      <div className="pointer-events-none fixed inset-x-0 top-0 hairline-top z-50" />

      {/* HERO */}
      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8"
      >
        {/* Header */}
        <header className="relative z-10 flex items-center justify-between animate-rise">
          <div className="flex items-center gap-4 group">
            <div className="relative shrink-0">
              <span className="absolute inset-0 -z-10 rounded-full bg-primary/40 blur-3xl animate-pulse-glow scale-150" />
              <span className="absolute inset-0 -z-10 rounded-full bg-blood/30 blur-2xl scale-125" />
              <img
                src={ballasLogo}
                alt="Ballas Gang"
                draggable={false}
                className="logo-hd h-20 w-20 md:h-24 md:w-24 select-none object-contain transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                style={parallax(8)}
              />
            </div>
            <div className="leading-tight">
              <div className="text-display text-base md:text-lg tracking-[0.34em]">
                Ballas{" "}
                <span className="bg-gradient-to-b from-primary via-primary to-blood bg-clip-text text-transparent">
                  Gang
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.34em] text-muted-foreground/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Acesso reservado
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 font-mono">
            <Lock className="h-3 w-3" />
            Sessão encriptada
          </div>
        </header>

        {/* Hero block */}
        <div className="relative my-auto py-16">
          {/* Floating logo ghost behind text */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block"
            style={parallax(-14)}
          >
            <img
              src={ballasLogo}
              alt=""
              className="logo-hd h-[480px] w-[480px] object-contain opacity-[0.07] mix-blend-screen"
            />
          </div>

          <div className="animate-rise delay-100">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-[0.32em] text-primary/90 backdrop-blur-sm">
              <Crown className="h-3 w-3" />
              Só para os de dentro
            </div>
          </div>

          <h1
            className="mt-7 max-w-3xl text-display text-6xl font-bold leading-[1.02] md:text-8xl md:leading-[1.0] text-glow animate-rise delay-200"
            style={parallax(-4)}
          >
            <span className="block">O bairro</span>
            <span className="block bg-gradient-to-br from-primary via-primary/90 to-blood bg-clip-text text-transparent pt-2 md:pt-3">
              é nosso.
            </span>
          </h1>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground/85 animate-rise delay-300">
            Aqui não se entra a perguntar. Quem é da casa, sabe o caminho.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-5 animate-rise delay-400">
            <Link
              to="/login"
              className="btn-shine group relative inline-flex cursor-pointer items-center gap-3 rounded-sm bg-gradient-to-b from-primary to-blood px-9 py-4 text-display text-sm font-bold tracking-[0.2em] text-primary-foreground shadow-[0_0_40px_-6px_var(--primary)] transition-all duration-300 hover:shadow-[0_0_70px_-2px_var(--primary)] hover:-translate-y-1 active:translate-y-0"
            >
              <span className="absolute -inset-px rounded-sm bg-gradient-to-b from-white/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <Lock className="h-4 w-4 transition-transform group-hover:rotate-12" />
              Entrar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
            </Link>

            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground/60">
              <span className="text-primary">▌</span> canal privado · sangue · roxo
            </div>
          </div>

          {/* Scroll cue */}
          <div className="mt-16 flex items-center gap-3 text-[10px] uppercase tracking-[0.34em] text-muted-foreground/50 animate-bounce-slow">
            <div className="h-px w-10 bg-muted-foreground/30" />
            Desliza
          </div>
        </div>
      </section>

      {/* CREED */}
      <section className="relative mx-auto max-w-6xl px-6 py-32">
        <div
          data-reveal
          className="reveal mx-auto max-w-3xl text-center"
        >
          <div className="text-display text-[11px] tracking-[0.5em] text-primary/80 mb-6">
            — O código —
          </div>
          <p className="text-display text-3xl md:text-5xl leading-[1.2] text-glow">
            <span className="text-foreground/40">Não somos </span>
            uma organização.
            <br />
            <span className="bg-gradient-to-r from-primary to-blood bg-clip-text text-transparent">
              Somos família.
            </span>
          </p>
        </div>

        {/* 3 tenets */}
        <div className="mt-20 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border/40 bg-border/30 md:grid-cols-3">
          {TENETS.map((t, i) => (
            <div
              key={t.title}
              data-reveal
              className="reveal group relative bg-background/60 p-8 backdrop-blur-sm transition-all duration-500 hover:bg-background/40"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent transition-all duration-500 group-hover:via-primary/60" />
              <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-sm bg-primary/10 ring-1 ring-inset ring-primary/30 text-primary transition-all duration-300 group-hover:bg-primary/20 group-hover:ring-primary/60 group-hover:scale-110">
                <t.icon className="h-5 w-5" />
              </div>
              <div className="text-display text-xs tracking-[0.34em] text-primary/80">
                0{i + 1}
              </div>
              <div className="mt-2 text-display text-xl tracking-wide">{t.title}</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground/85">
                {t.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* DOOR */}
      <section className="relative mx-auto max-w-4xl px-6 py-32 text-center">
        <div data-reveal className="reveal">
          <p className="text-display text-2xl md:text-4xl leading-tight">
            <span className="text-muted-foreground/60">Se chegaste até aqui,</span>
            <br />
            <span className="text-glow">já sabes o que fazer.</span>
          </p>

          <div className="mt-10">
            <Link
              to="/login"
              className="btn-shine group relative inline-flex items-center gap-3 rounded-sm border border-primary/40 bg-background/30 px-8 py-4 text-display text-sm font-bold tracking-[0.2em] text-foreground backdrop-blur-md transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_50px_-8px_var(--primary)] hover:-translate-y-1"
            >
              <ShieldAlert className="h-4 w-4 text-primary" />
              Bate à porta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
            </Link>
          </div>
        </div>

        <footer className="mt-32 border-t border-border/30 pt-6 text-[10px] uppercase tracking-[0.32em] text-muted-foreground/40">
          © Ballas Gang · Sangue · Roxo · Bairro
        </footer>
      </section>
    </div>
  );
}

const TENETS = [
  {
    icon: Eye,
    title: "Discrição",
    body: "Boca fechada. O que se passa em casa, fica em casa.",
  },
  {
    icon: Crown,
    title: "Lealdade",
    body: "Primeiro o bairro, depois tudo o resto. Sempre.",
  },
  {
    icon: ShieldAlert,
    title: "Respeito",
    body: "Ganha-se com tempo. Perde-se num segundo.",
  },
];

function CornerMarks() {
  const base = "pointer-events-none fixed h-8 w-8 border-primary/40 z-40";
  return (
    <>
      <div className={`${base} top-4 left-4 border-l border-t`} />
      <div className={`${base} top-4 right-4 border-r border-t`} />
      <div className={`${base} bottom-4 left-4 border-l border-b`} />
      <div className={`${base} bottom-4 right-4 border-r border-b`} />
    </>
  );
}
