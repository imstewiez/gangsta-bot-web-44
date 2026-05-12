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

// Emoji por rank — fallback (igual ao Discord). O ideal é usar <TierIcon /> que rende SVGs.
export const TIER_EMOJI: Record<string, string> = {
  young_blood: "🏷️",
  o_gunao: "🚬",
  gangster_fodido: "♟️",
  patrao_di_zona: "👑",
  real_gangster: "🗡️",
  og: "💀",
  kingpin: "💎",
  manda_chuva: "🩸",
  bairrista: "🏠",
};

// Gradiente por tier — replicado do servidor de Discord.
// Linear-gradient ~135deg, dois stops.
export const TIER_GRADIENT: Record<string, string> = {
  manda_chuva:    "linear-gradient(135deg, #e6e6e6 0%, #b8003a 100%)",
  kingpin:        "linear-gradient(135deg, #d4d4d4 0%, #1a1a1a 100%)",
  og:             "linear-gradient(135deg, #0d0d0d 0%, #6b6b6b 100%)",
  real_gangster:  "linear-gradient(135deg, #5a0a0a 0%, #d40015 100%)",
  patrao_di_zona: "linear-gradient(135deg, #0a1a3a 0%, #2563eb 100%)",
  gangster_fodido:"linear-gradient(135deg, #2a2a2a 0%, #c95a1a 100%)",
  o_gunao:        "linear-gradient(135deg, #14361e 0%, #5fb368 100%)",
  young_blood:    "linear-gradient(135deg, #e91e63 0%, #ff8fbf 100%)",
  bairrista:      "linear-gradient(135deg, #2a2a2a 0%, #b8651a 100%)",
};

// Cor "principal" do tier — para textos e bordas.
export const TIER_ACCENT: Record<string, string> = {
  manda_chuva:    "#ff3a6a",
  kingpin:        "#cfd6e0",
  og:             "#a0a0a0",
  real_gangster:  "#ff2c3a",
  patrao_di_zona: "#3b82f6",
  gangster_fodido:"#e07a3a",
  o_gunao:        "#7fce85",
  young_blood:    "#ff7fb5",
  bairrista:      "#d28a4a",
};

// Tag "Chefia de RedWood" — vermelho sólido da firma.
export const REDWOOD_GRADIENT = "linear-gradient(135deg, #ff2c3a 0%, #8a000f 100%)";

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
