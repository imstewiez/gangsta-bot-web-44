import { ROLE_LABELS, TIER_DESCRIPTION_LABELS, TIER_ACCENT, TIER_GRADIENT, isChefia } from "@/lib/domain";
import { TierIcon, BallasIcon } from "./TierIcon";

type Size = "xs" | "sm" | "md";

const PAD: Record<Size, string> = {
  xs: "pl-0.5 pr-2 py-0.5 text-[10px] gap-1",
  sm: "pl-0.5 pr-2.5 py-0.5 text-xs gap-1.5",
  md: "pl-1 pr-3 py-1 text-sm gap-2",
};

const ICON_SIZE: Record<Size, "xs" | "sm" | "md"> = {
  xs: "xs",
  sm: "sm",
  md: "md",
};

function badgeBase(size: Size) {
  return (
    "inline-flex items-center rounded-full border text-display font-black uppercase tracking-wide whitespace-nowrap backdrop-blur " +
    PAD[size]
  );
}

export function RoleBadge({
  tier,
  size = "sm",
  withIcon = true,
}: {
  tier: string | null | undefined;
  size?: Size;
  withIcon?: boolean;
}) {
  if (!tier) return <span className="text-muted-foreground">—</span>;
  const label = ROLE_LABELS[tier] ?? tier;
  const accent = TIER_ACCENT[tier] ?? "var(--color-foreground)";
  const gradient = TIER_GRADIENT[tier] ?? "linear-gradient(135deg, rgba(168,85,247,.22), rgba(88,28,135,.22))";
  return (
    <span
      className={badgeBase(size)}
      style={{
        borderColor: `color-mix(in oklab, ${accent} 62%, transparent)`,
        color: accent,
        background: `linear-gradient(135deg, color-mix(in oklab, ${accent} 18%, transparent), rgba(8,4,16,.55))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 18%, transparent), 0 0 16px -10px ${accent}`,
      }}
    >
      {withIcon && <TierIcon tier={tier} size={ICON_SIZE[size]} glow />}
      <span className="leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,.75)]">{label}</span>
      <span
        aria-hidden
        className="ml-0.5 h-1.5 w-1.5 rounded-full opacity-70"
        style={{ background: gradient }}
      />
    </span>
  );
}

export function TierBadge({
  tier,
  size = "sm",
}: {
  tier: string | null | undefined;
  size?: Size;
  withIcon?: boolean;
}) {
  if (!tier) return <span className="text-muted-foreground">—</span>;
  const label = TIER_DESCRIPTION_LABELS[tier] ?? "—";
  return (
    <span
      className={
        "inline-flex items-center rounded-full border border-border/70 bg-muted/25 text-display font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap " +
        (size === "xs" ? "px-2 py-0.5 text-[10px]" : size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]")
      }
    >
      {label}
    </span>
  );
}

export function AffiliationBadge({
  tier,
  size = "xs",
}: {
  tier: string | null | undefined;
  size?: Size;
}) {
  const chefia = isChefia(tier);
  if (chefia) {
    return (
      <span
        className={
          "inline-flex items-center rounded-full border border-primary/55 text-primary text-display whitespace-nowrap " +
          PAD[size]
        }
      >
        <BallasIcon size={ICON_SIZE[size]} />
        <span className="leading-none">Ballas</span>
      </span>
    );
  }
  return (
    <span
      className={
        "inline-flex items-center rounded-full border border-border text-muted-foreground text-display whitespace-nowrap " +
        PAD[size]
      }
    >
      <TierIcon tier="bairrista" size={ICON_SIZE[size]} />
      <span className="leading-none">Bairrista</span>
    </span>
  );
}

export function MemberIdentity({
  tier,
  size = "sm",
}: {
  tier: string | null | undefined;
  size?: Size;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RoleBadge tier={tier} size={size} />
      <AffiliationBadge tier={tier} size={size === "md" ? "sm" : "xs"} />
    </span>
  );
}
