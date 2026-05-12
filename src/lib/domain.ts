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
  young_blood: "🏷️",
  o_gunao: "🚬",
  gangster_fodido: "♟️",
  patrao_di_zona: "👑",
  real_gangster: "🍁",
  og: "💀",
  kingpin: "💎",
  manda_chuva: "🩸",
  bairrista: "🏠",
};

// Tag "Chefia de RedWood" — patrões di zona e acima representam a firma.
export const CHEFIA_TIERS = new Set<string>([
  "patrao_di_zona",
  "real_gangster",
  "og",
  "kingpin",
  "manda_chuva",
]);

export function isChefia(tier: string | null | undefined): boolean {
  return !!tier && CHEFIA_TIERS.has(tier);
}

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


export function tierColor(tier: string | null | undefined): string {
  switch (tier) {
    case "manda_chuva":
      // rosa-sangue, topo da hierarquia
      return "bg-[oklch(0.55_0.22_0)/0.22] text-[oklch(0.85_0.15_0)] border-[oklch(0.55_0.22_0)/0.55]";
    case "kingpin":
      // diamante / ciano gelado
      return "bg-[oklch(0.55_0.15_200)/0.22] text-[oklch(0.85_0.12_200)] border-[oklch(0.55_0.15_200)/0.55]";
    case "og":
      // chumbo / preto-violeta
      return "bg-[oklch(0.30_0.04_300)/0.45] text-[oklch(0.88_0.03_300)] border-[oklch(0.50_0.05_300)/0.55]";
    case "real_gangster":
      // vermelho RedWood clássico
      return "bg-primary/22 text-primary border-primary/55";
    case "patrao_di_zona":
      // azul chefia
      return "bg-info/22 text-info border-info/55";
    case "gangster_fodido":
      // verde-musgo
      return "bg-[oklch(0.45_0.10_150)/0.30] text-[oklch(0.85_0.12_150)] border-[oklch(0.55_0.12_150)/0.55]";
    case "o_gunao":
      // âmbar tabaco
      return "bg-warning/22 text-warning border-warning/55";
    case "young_blood":
      // rosa fresco
      return "bg-[oklch(0.60_0.18_350)/0.22] text-[oklch(0.85_0.14_350)] border-[oklch(0.60_0.18_350)/0.55]";
    case "bairrista":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// Cor da tag "Chefia de RedWood" — sempre vermelho RedWood.
export const REDWOOD_BADGE_CLASS =
  "bg-primary/15 text-primary border-primary/45";
export const BAIRRISTA_BADGE_CLASS =
  "bg-muted text-muted-foreground border-border";


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
