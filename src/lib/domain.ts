// Hierarquia do bairro — labels bonitos com emoji para UI.
// Nunca mostrar os IDs internos (young_blood, patrao_di_zona, etc) na UI.

import { getTierOrder } from "./config.loader";

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

// Cargo/posição principal — deve bater com o que o Discord mostra à comunidade.
// Usado em Cargo/Posição, perfil, hierarquia e badges coloridas.
export const ROLE_LABELS: Record<string, string> = {
  young_blood: "Bairrista-1",
  o_gunao: "Bairrista-2",
  gangster_fodido: "Bairrista-3",
  patrao_di_zona: "Chefe de Moradores",
  real_gangster: "Oficiais-1",
  og: "Oficiais-2",
  kingpin: "Sub-Chefe",
  manda_chuva: "Chefe",
  bairrista: "Bairrista",
};

// Tier/descrição — informação secundária, sem substituir o cargo.
export const TIER_LABELS: Record<string, string> = {
  young_blood: "Entrada / Tier 1",
  o_gunao: "Progressão / Tier 2",
  gangster_fodido: "Progressão / Tier 3",
  patrao_di_zona: "Gestão de moradores",
  real_gangster: "Oficial de rua",
  og: "Oficial sénior",
  kingpin: "Subchefia",
  manda_chuva: "Chefia máxima",
  bairrista: "Bairro",
};

// Gradientes reais CSS para ícones/badges. Não usar classes Tailwind aqui.
export const TIER_GRADIENT: Record<string, string> = {
  manda_chuva: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
  kingpin: "linear-gradient(135deg, #fb7185 0%, #9f1239 100%)",
  og: "linear-gradient(135deg, #facc15 0%, #92400e 100%)",
  real_gangster: "linear-gradient(135deg, #c084fc 0%, #6d28d9 100%)",
  patrao_di_zona: "linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)",
  gangster_fodido: "linear-gradient(135deg, #22d3ee 0%, #0f766e 100%)",
  o_gunao: "linear-gradient(135deg, #34d399 0%, #166534 100%)",
  young_blood: "linear-gradient(135deg, #94a3b8 0%, #334155 100%)",
  bairrista: "linear-gradient(135deg, #7c3aed 0%, #3b0764 100%)",
};

export const TIER_ACCENT: Record<string, string> = {
  manda_chuva: "#ef4444",
  kingpin: "#fb7185",
  og: "#facc15",
  real_gangster: "#c084fc",
  patrao_di_zona: "#8b5cf6",
  gangster_fodido: "#22d3ee",
  o_gunao: "#34d399",
  young_blood: "#94a3b8",
  bairrista: "#a855f7",
};

export const BALLAS_GRADIENT = "linear-gradient(135deg, #a855f7 0%, #581c87 100%)";

// Ordem hierárquica (mais baixo → mais alto).
export const TIER_ORDER: string[] = getTierOrder();

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
  return ROLE_LABELS[tier] ?? tier;
}

// Posição/cargo principal — mantém nome antigo para compatibilidade.
export const POSITION_LABELS: Record<string, string> = ROLE_LABELS;

export function tierColor(tier: string | null | undefined): string {
  switch (tier) {
    case "manda_chuva":
      return "bg-red-500/15 text-red-300 border-red-400/50";
    case "kingpin":
      return "bg-rose-500/15 text-rose-300 border-rose-400/50";
    case "og":
      return "bg-yellow-400/15 text-yellow-300 border-yellow-400/50";
    case "real_gangster":
      return "bg-purple-400/15 text-purple-300 border-purple-400/50";
    case "patrao_di_zona":
      return "bg-violet-500/15 text-violet-300 border-violet-400/50";
    case "gangster_fodido":
      return "bg-cyan-400/15 text-cyan-300 border-cyan-400/50";
    case "o_gunao":
      return "bg-emerald-400/15 text-emerald-300 border-emerald-400/50";
    case "young_blood":
      return "bg-slate-400/15 text-slate-300 border-slate-400/50";
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
