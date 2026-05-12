import {
  Droplet,
  Gem,
  Skull,
  Sword,
  Crown,
  Cigarette,
  Tag,
  Home,
  type LucideIcon,
} from "lucide-react";
import { TIER_GRADIENT, REDWOOD_GRADIENT } from "@/lib/domain";

// Pawn (Gangster Fodido) — lucide não tem peças de xadrez.
function Pawn(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="6" r="3" />
      <path d="M9 9c0 2 1 3 3 3s3-1 3-3" />
      <path d="M10 12l-1 5h6l-1-5" />
      <path d="M7 21h10l-1-4H8z" />
    </svg>
  );
}

const ICON: Record<string, LucideIcon | typeof Pawn> = {
  manda_chuva: Droplet,
  kingpin: Gem,
  og: Skull,
  real_gangster: Sword,
  patrao_di_zona: Crown,
  gangster_fodido: Pawn,
  o_gunao: Cigarette,
  young_blood: Tag,
  bairrista: Home,
};

type Size = "xs" | "sm" | "md" | "lg";
const SIZE: Record<Size, { box: number; icon: number; ring: string }> = {
  xs: { box: 16, icon: 10, ring: "ring-1" },
  sm: { box: 22, icon: 12, ring: "ring-1" },
  md: { box: 30, icon: 16, ring: "ring-2" },
  lg: { box: 44, icon: 22, ring: "ring-2" },
};

export function TierIcon({
  tier,
  size = "sm",
  glow = false,
}: {
  tier: string | null | undefined;
  size?: Size;
  glow?: boolean;
}) {
  const key = tier ?? "bairrista";
  const Icon = ICON[key] ?? Home;
  const grad = TIER_GRADIENT[key] ?? TIER_GRADIENT.bairrista;
  const s = SIZE[size];
  return (
    <span
      aria-hidden
      className={
        "inline-grid place-items-center rounded-full ring-black/40 shrink-0 " +
        s.ring +
        (glow ? " shadow-[0_0_12px_-2px_currentColor]" : "")
      }
      style={{
        background: grad,
        width: s.box,
        height: s.box,
      }}
    >
      <Icon
        width={s.icon}
        height={s.icon}
        className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
      />
    </span>
  );
}

export function RedWoodIcon({ size = "sm" }: { size?: Size }) {
  const s = SIZE[size];
  return (
    <span
      aria-hidden
      className={"inline-grid place-items-center rounded-full ring-1 ring-black/40 shrink-0"}
      style={{ background: REDWOOD_GRADIENT, width: s.box, height: s.box }}
    >
      <span
        className="text-white text-[10px] font-display font-black leading-none"
        style={{ fontSize: Math.max(8, s.icon - 2) }}
      >
        R
      </span>
    </span>
  );
}
