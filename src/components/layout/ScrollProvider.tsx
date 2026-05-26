import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Global scroll utilities mounted once at root:
 *  - Thin gradient scroll progress bar at the top of the viewport.
 *  - IntersectionObserver that reveals every [data-reveal] / .reveal element.
 *  - Re-scans on every route change so pages get the reveal animation for free.
 */
export function ScrollProvider() {
  const [progress, setProgress] = useState(0);
  const routerState = useRouterState({ select: (s) => s.location.pathname });

  // Progress bar
  useEffect(() => {
    const update = () => {
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      const p = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      setProgress(p);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Scroll reveal — auto-observe on every route change
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    // Slight delay so newly-rendered content is in the DOM.
    const t = window.setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>(".reveal:not(.is-visible), [data-reveal]:not(.is-visible)")
        .forEach((el) => {
          el.classList.add("reveal");
          io.observe(el);
        });
    }, 30);

    return () => {
      window.clearTimeout(t);
      io.disconnect();
    };
  }, [routerState]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-primary/80 to-blood transition-[width] duration-150 ease-out"
        style={{
          width: `${progress}%`,
          boxShadow:
            "0 0 12px color-mix(in oklab, var(--primary) 60%, transparent)",
        }}
      />
    </div>
  );
}
