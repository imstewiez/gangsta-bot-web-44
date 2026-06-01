// Hierarquia do bairro — labels bonitos com emoji para UI.
// Nunca mostrar os IDs internos (young_blood, patrao_di_zona, etc) na UI.

import {
  getTierLabels,
  getTierGradients,
  getTierAccents,
  getTierOrder,
} from "./config.loader";

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

// Cargo real do Discord. Usado em Posição/Cargo, perfil, badges principais e hierarquia.
export const DISCORD_ROLE_LABELS: Record<string, string> = {
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

// Tier/progressão interna. Usado apenas para XP, preços, progressão e coluna Tier.
export const TIER_LABELS: Record<string, string> = {
  ...getTierLabels(),
  young_blood: "Bairrista-1",
  o_gunao: "Bairrista-2",
  gangster_fodido: "Bairrista-3",
};

// (TIER_EMOJI removido — usar <TierIcon /> em todo o lado.)

// Gradiente por tier — replicado do servidor de Discord.
// Linear-gradient ~135deg, dois stops.
// Gradients sincronizados com as cores dos roles do Discord.
export const TIER_GRADIENT: Record<string, string> = getTierGradients();

// Cor "principal" do tier — para textos e bordas.
// Cores de texto/borda sincronizadas com as cores dos roles do Discord.
export const TIER_ACCENT: Record<string, string> = getTierAccents();

// Tag "Chefia de Ballas" — roxo púrpura da firma.
export const BALLAS_GRADIENT =
  "linear-gradient(135deg, #9b59b6 0%, #6c3483 100%)";

// Ordem hierárquica (mais baixo → mais alto).
export const TIER_ORDER: string[] = getTierOrder();

// Tag "Chefia de Ballas" — patrões di zona e acima representam a firma.
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

export function tierLabel(tier: string | null | undefined): string {
  if (!tier) return "—";
  return TIER_LABELS[tier] ?? tier;
}

export function roleLabel(tier: string | null | undefined): string {
  if (!tier) return "—";
  return DISCORD_ROLE_LABELS[tier] ?? tier;
}

export const ROLE_LABELS = DISCORD_ROLE_LABELS;

// Posições hierárquicas — o que aparece na coluna "Posição" e no perfil.
export const POSITION_LABELS: Record<string, string> = DISCORD_ROLE_LABELS;

export function tierColor(tier: string | null | undefined): string {
  switch (tier) {
    case "manda_chuva":
      // dourado Manda-Chuva
      return "bg-[#eec16d/0.22] text-[#eec16d] border-[#eec16d/0.55]";
    case "kingpin":
      // prateado Kingpin
      return "bg-[#b3b5b8/0.22] text-[#b3b5b8] border-[#b3b5b8/0.55]";
    case "og":
      // vinho escuro OG
      return "bg-[#470000/0.35] text-[#c94a4a] border-[#470000/0.55]";
    case "real_gangster":
      // roxo Real Gangster
      return "bg-[#9e6bff/0.22] text-[#9e6bff] border-[#9e6bff/0.55]";
    case "patrao_di_zona":
      // azul escuro Patrão
      return "bg-[#021e85/0.22] text-[#3b82f6] border-[#021e85/0.55]";
    case "gangster_fodido":
      // verde-azulado Gangster Fodido
      return "bg-[#3a8f97/0.22] text-[#3a8f97] border-[#3a8f97/0.55]";
    case "o_gunao":
      // verde musgo O Gunão
      return "bg-[#70966e/0.22] text-[#70966e] border-[#70966e/0.55]";
    case "young_blood":
      // azul claro Young Blood
      return "bg-[#4cadd0/0.22] text-[#4cadd0] border-[#4cadd0/0.55]";
    case "bairrista":
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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function fmtPrice(n: number | string | null | undefined): string {
  return fmtNum(n) + " €";
}

export function fmtCategoryLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const map: Record<string, string> = {
    armas_red: "Arma Red",
    armas_orange: "Arma Orange",
    carregadores: "Carregador",
    acessorios_armas: "Acessório",
    drogas: "Substâncias",
    materiais_craft: "Material",
    coletes: "Colete",
    lixo: "Sucata",
    madeiras: "Madeira",
    materias_primas: "Matéria-prima",
    minerios: "Minério",
    corpos: "Corpo",
    prints: "Print",
    entrega_bairrista: "Entrega",
    venda_bairrista: "Venda",
  };
  return map[raw] ?? raw;
}

/** Portuguese pluralization: returns singular if n === 1, plural otherwise. */
export function pluralPT(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
