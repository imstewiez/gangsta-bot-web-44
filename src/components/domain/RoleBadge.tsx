import {
  TIER_LABELS,
  TIER_EMOJI,
  tierColor,
  isChefia,
  REDWOOD_BADGE_CLASS,
  BAIRRISTA_BADGE_CLASS,
} from "@/lib/domain";

type Size = "xs" | "sm" | "md";

const SIZE: Record<Size, string> = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

export function TierBadge({
  tier,
  size = "sm",
  withEmoji = true,
}: {
  tier: string | null | undefined;
  size?: Size;
  withEmoji?: boolean;
}) {
  if (!tier) return <span className="text-muted-foreground">—</span>;
  const label = TIER_LABELS[tier] ?? tier;
  const emoji = TIER_EMOJI[tier];
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-sm border text-display whitespace-nowrap " +
        SIZE[size] +
        " " +
        tierColor(tier)
      }
    >
      {withEmoji && emoji && <span aria-hidden>{emoji}</span>}
      <span>{label}</span>
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
  const klass = chefia ? REDWOOD_BADGE_CLASS : BAIRRISTA_BADGE_CLASS;
  const label = chefia ? "Chefia de RedWood" : "Bairrista";
  const emoji = chefia ? "🟥" : "🏠";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-sm border text-display whitespace-nowrap " +
        SIZE[size] +
        " " +
        klass
      }
    >
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
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
    <span className="inline-flex flex-wrap items-center gap-1">
      <TierBadge tier={tier} size={size} />
      <AffiliationBadge tier={tier} size={size === "md" ? "sm" : "xs"} />
    </span>
  );
}
