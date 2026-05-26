import bgGangster from "@/assets/bg-gangster.jpg";

/**
 * Fixed full-bleed cinematic backdrop used across the entire app.
 * Sits behind all content via z-index. Layers:
 *  - dark gangster alley photo
 *  - red ambient orbs
 *  - vignette + grain
 */
export function CinematicBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Photo layer */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${bgGangster})`,
          filter: "saturate(0.85) brightness(0.55)",
        }}
      />
      {/* Color wash to bind it to the palette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.10 0.030 300 / 0.60) 0%, oklch(0.09 0.025 300 / 0.82) 60%, oklch(0.07 0.020 300 / 0.94) 100%)",
        }}
      />
      {/* Animated violet glows */}
      <div className="absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-primary/30 blur-[140px] animate-float-slow" />
      <div
        className="absolute -bottom-32 -right-24 h-[560px] w-[560px] rounded-full bg-blood/30 blur-[140px] animate-float-slow"
        style={{ animationDelay: "3.5s" }}
      />
      {/* Vignette + grain */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% 50%, transparent 45%, oklch(0 0 0 / 0.85) 100%), radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.04) 1px, transparent 0)",
          backgroundSize: "100% 100%, 3px 3px",
        }}
      />
    </div>
  );
}
