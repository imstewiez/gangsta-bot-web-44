import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import ballasLogo from "@/assets/ballas-logo.png";
import { ArrowRight, Lock } from "lucide-react";
import { CinematicBackdrop } from "@/components/layout/CinematicBackdrop";
import { Reveal } from "@/components/layout/Reveal";

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

      <div className="pointer-events-none fixed inset-x-0 top-0 hairline-top z-50" />

      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8"
      >
        <header className="relative z-10 flex items-center">
          <Reveal delay={0} direction="down">
            <div className="flex items-center gap-4 group">
              <div className="relative shrink-0">
                <span className="absolute inset-0 -z-10 rounded-full bg-primary/40 blur-3xl animate-pulse-glow scale-150" />
                <img
                  src={ballasLogo}
                  alt="Ballas Gang"
                  draggable={false}
                  className="logo-hd h-20 w-20 md:h-24 md:w-24 select-none object-contain transition-transform duration-500 group-hover:scale-110"
                  style={parallax(6)}
                />
              </div>
              <div className="leading-tight">
                <div className="text-display text-sm md:text-base tracking-[0.3em]">
                  Ballas{" "}
                  <span className="bg-gradient-to-b from-primary via-primary to-blood bg-clip-text text-transparent">
                    Gang
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </header>

        <div className="relative my-auto py-16">
          <Reveal delay={100} direction="up">
            <h1
              className="max-w-3xl text-display text-5xl font-bold leading-[1.05] md:text-7xl md:leading-[1.0] text-glow"
              style={parallax(-3)}
            >
              <span className="block">O BAIRRO</span>
              <span className="block bg-gradient-to-br from-primary via-primary/90 to-blood bg-clip-text text-transparent pt-2 md:pt-3">
                É NOSSO.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={250} direction="up">
            <div className="mt-10">
              <Link
                to="/login"
                className="btn-shine group relative inline-flex cursor-pointer items-center gap-3 rounded-sm bg-gradient-to-b from-primary to-blood px-8 py-3.5 text-display text-sm font-bold tracking-[0.18em] text-primary-foreground shadow-[0_0_40px_-6px_var(--primary)] transition-all duration-300 hover:shadow-[0_0_60px_-2px_var(--primary)] hover:-translate-y-1 active:translate-y-0"
              >
                <Lock className="h-4 w-4 transition-transform group-hover:rotate-12" />
                Entrar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={400} direction="up">
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/40">
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
            <div className="h-8 w-[1px] bg-gradient-to-b from-muted-foreground/40 to-transparent animate-bounce-slow" />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
