import { TIER_LABELS, TIER_ACCENT, isChefia } from "@/lib/domain";
import { TierIcon, RedWoodIcon } from "./TierIcon";

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

export function TierBadge({
  tier,
  size = "sm",
  withIcon = true,
}: {
  tier: string | null | undefined;
  size?: Size;
  withIcon?: boolean;
}) {
  if (!tier) return <span className="text-muted-foreground">—</span>;
  const label = TIER_LABELS[tier] ?? tier;
  const accent = TIER_ACCENT[tier] ?? "var(--color-foreground)";
  return (
    <span
      className={
        "inline-flex items-center rounded-full border bg-card/40 backdrop-blur text-display whitespace-nowrap " +
        PAD[size]
      }
      style={{
        borderColor: `color-mix(in oklab, ${accent} 55%, transparent)`,
        color: accent,
      }}
    >
      {withIcon && <TierIcon tier={tier} size={ICON_SIZE[size]} />}
      <span className="leading-none">{label}</span>
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
        <RedWoodIcon size={ICON_SIZE[size]} />
        <span className="leading-none">RedWood</span>
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
      <TierBadge tier={tier} size={size} />
      <AffiliationBadge tier={tier} size={size === "md" ? "sm" : "xs"} />
    </span>
  );
}
