import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import ballasLogo from "@/assets/ballas-logo.png";
import { ArrowRight, Lock } from "lucide-react";
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

  const parallax = (factor: number) => ({
    transform: `translate3d(${mouse.x * factor}px, ${mouse.y * factor + scrollY * factor * 0.05}px, 0)`,
  });

  return (
    <div className="ambient-bg relative min-h-screen overflow-x-hidden">
      <CinematicBackdrop />

      <CornerMarks />

      <div className="pointer-events-none fixed inset-x-0 top-0 hairline-top z-50" />

      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8"
      >
        <header className="relative z-10 flex items-center animate-rise">
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
            </div>
          </div>
        </header>

        <div className="relative my-auto py-16">
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

          <h1
            className="max-w-3xl text-display text-6xl font-bold leading-[1.02] md:text-8xl md:leading-[1.0] text-glow animate-rise delay-200"
            style={parallax(-4)}
          >
            <span className="block">O bairro</span>
            <span className="block bg-gradient-to-br from-primary via-primary/90 to-blood bg-clip-text text-transparent pt-2 md:pt-3">
              é nosso.
            </span>
          </h1>

          <div className="mt-12 animate-rise delay-400">
            <Link
              to="/login"
              className="btn-shine group relative inline-flex cursor-pointer items-center gap-3 rounded-sm bg-gradient-to-b from-primary to-blood px-9 py-4 text-display text-sm font-bold tracking-[0.2em] text-primary-foreground shadow-[0_0_40px_-6px_var(--primary)] transition-all duration-300 hover:shadow-[0_0_70px_-2px_var(--primary)] hover:-translate-y-1 active:translate-y-0"
            >
              <span className="absolute -inset-px rounded-sm bg-gradient-to-b from-white/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <Lock className="h-4 w-4 transition-transform group-hover:rotate-12" />
              Entrar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

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
