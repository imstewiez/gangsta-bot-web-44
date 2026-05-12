// Domain enums mirroring the bot's hierarchy
export type Tier = "young_blood" | "o_gunao" | "gangster_fodido";
export type MemberRole =
  | "manda_chuva"
  | "kingpin"
  | "og"
  | "real_gangster"
  | "patrao_di_zona"
  | "bairrista";

export const TIER_LABELS: Record<Tier, string> = {
  young_blood: "Young Blood",
  o_gunao: "O Gunão",
  gangster_fodido: "Gangster Fodido",
};

export const ROLE_LABELS: Record<string, string> = {
  manda_chuva: "Manda-Chuva",
  kingpin: "Kingpin",
  og: "OG",
  real_gangster: "Real Gangster",
  patrao_di_zona: "Patrão di Zona",
  bairrista: "Bairrista",
};

export function tierColor(tier: Tier | string | null | undefined): string {
  switch (tier) {
    case "gangster_fodido":
      return "bg-primary/20 text-primary border-primary/40";
    case "o_gunao":
      return "bg-warning/20 text-warning border-warning/40";
    case "young_blood":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function fmtNum(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return String(n);
  return new Intl.NumberFormat("pt-PT").format(v);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}
