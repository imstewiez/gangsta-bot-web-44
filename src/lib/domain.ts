// Hierarquia do bairro — labels bonitos com emoji para UI.
// Nunca mostrar os IDs internos (young_blood, patrao_di_zona, etc) na UI.
export type Tier =
  | "young_blood"
  | "o_gunao"
  | "gangster_fodido"
  | "patrao_di_zona"
  | "real_gangster"
  | "og"
  | "kingpin"
  | "manda_chuva";

export type MemberRole = Tier | "bairrista";

// Etiquetas curtas (sem emoji) — para sítios densos/tabelas.
export const TIER_LABELS: Record<string, string> = {
  young_blood: "Young Blood",
  o_gunao: "O Gunão",
  gangster_fodido: "Gangster Fodido",
  patrao_di_zona: "Patrão di Zona",
  real_gangster: "Real Gangster",
  og: "OG",
  kingpin: "Kingpin",
  manda_chuva: "Manda-Chuva",
  bairrista: "Bairrista",
};

// Emoji por rank — usado para destacar a hierarquia.
export const TIER_EMOJI: Record<string, string> = {
  young_blood: "🩸",
  o_gunao: "🔥",
  gangster_fodido: "💀",
  patrao_di_zona: "👑",
  real_gangster: "🎯",
  og: "🏴",
  kingpin: "♛",
  manda_chuva: "⚡",
  bairrista: "•",
};

// Ordem hierárquica (mais baixo → mais alto).
export const TIER_ORDER: string[] = [
  "young_blood",
  "o_gunao",
  "gangster_fodido",
  "patrao_di_zona",
  "real_gangster",
  "og",
  "kingpin",
  "manda_chuva",
];

export function tierLabel(tier: string | null | undefined): string {
  if (!tier) return "—";
  return TIER_LABELS[tier] ?? tier;
}

export function tierLabelWithEmoji(tier: string | null | undefined): string {
  if (!tier) return "—";
  const emoji = TIER_EMOJI[tier] ?? "•";
  const label = TIER_LABELS[tier] ?? tier;
  return `${emoji} ${label}`;
}

export const ROLE_LABELS = TIER_LABELS;


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
