import bgGangster from "@/assets/bg-gangster.jpg";

/**
 * Cinematic Noir backdrop.
 * Fixed full-bleed layer used across the entire app.
 * Layers (bottom → top):
 *   1. dark photograph (heavily desaturated, deep blacks)
 *   2. deep noir colour wash bound to the violet palette
 *   3. soft drifting violet glow + cold ambient glow
 *   4. vignette + film grain
 *   5. faint horizontal scanlines for a cinematic feel
 */
export function CinematicBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 1 — Photo layer */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${bgGangster})`,
          filter: "saturate(0.35) brightness(0.4) contrast(1.05)",
          transform: "scale(1.05)",
        }}
      />

      {/* 2 — Deep noir wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.08 0.020 300 / 0.78) 0%, oklch(0.07 0.018 300 / 0.92) 55%, oklch(0.05 0.015 300 / 0.98) 100%)",
        }}
      />

      {/* 3 — Drifting violet + cold ambient orbs (sober) */}
      <div className="absolute -top-40 left-1/4 h-[560px] w-[560px] rounded-full bg-primary/15 blur-[160px] animate-float-slow" />
      <div
        className="absolute -bottom-40 right-1/4 h-[620px] w-[620px] rounded-full bg-blood/15 blur-[180px] animate-float-slow"
        style={{ animationDelay: "4s" }}
      />

      {/* 4 — Vignette + grain */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 75% at 50% 50%, transparent 40%, oklch(0 0 0 / 0.9) 100%), radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.035) 1px, transparent 0)",
          backgroundSize: "100% 100%, 3px 3px",
        }}
      />

      {/* 5 — Subtle horizontal scanlines (cinematic) */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 2px, oklch(0 0 0) 2px 3px)",
        }}
      />
    </div>
  );
}
