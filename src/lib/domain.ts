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

// (TIER_EMOJI removido — usar <TierIcon /> em todo o lado.)


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

// Hierarquia oficial do bairro (mais baixo → mais alto):
// 1 Young Blood · 2 O Gunão · 3 Gangster Fodido · 4 Real Gangster
// 5 OG · 6 Patrão di Zona · 7 Kingpin · 8 Manda-Chuva
export const TIER_ORDER: string[] = [
  "young_blood",
  "o_gunao",
  "gangster_fodido",
  "real_gangster",
  "og",
  "patrao_di_zona",
  "kingpin",
  "manda_chuva",
];

// Tier numérico (1–8) — útil para filtros, ordenação e comparações.
export const TIER_TIER: Record<string, number> = TIER_ORDER.reduce(
  (acc, t, i) => ({ ...acc, [t]: i + 1 }),
  {} as Record<string, number>
);

export function tierTier(tier: string | null | undefined): number {
  if (!tier) return 0;
  return TIER_TIER[tier] ?? 0;
}

// Tag "Chefia de RedWood" — Real Gangster e acima representam a firma.
// (Mantido como estava: chefia = ranks ≥ 4 na hierarquia oficial.)
export const CHEFIA_TIERS = new Set<string>([
  "real_gangster",
  "og",
  "patrao_di_zona",
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

/** @deprecated usar <TierIcon /> + tierLabel(). Mantido só para retro-compat. */
export function tierLabelWithEmoji(tier: string | null | undefined): string {
  return tierLabel(tier);
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

export function fmtMoney(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(v) + " €";
}

// ───────── Label mappers (PT-PT) ─────────
// Fonte de verdade para nomes "humanos" — usa em vez de mostrar códigos crus da DB.

export const MOVEMENT_LABELS: Record<string, string> = {
  saldo_inicial: "Saldo inicial",
  entrega_bairrista: "Entrega",
  venda_bairrista: "Venda",
  entrega_oficial: "Entrega oficial",
  fornecimento_org: "Fornecimento",
  consumo_saida: "Saída — consumo",
  devolucao_saida: "Saída — devolução",
  ajuste_manual: "Ajuste manual",
  perda_saida: "Perdido",
  apreendido: "Apreendido",
  craftado: "Craftado",
  produzido: "Produzido",
};

export function formatMovementType(t: string | null | undefined): string {
  if (!t) return "—";
  return MOVEMENT_LABELS[t] ?? t.replace(/_/g, " ");
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "À espera",
  approved: "Aceite",
  in_progress: "A tratar",
  ready: "Pronta",
  fulfilled: "Entregue",
  denied: "Recusada",
  cancelled: "Cancelada",
};

export const ORDER_STATUS_TONE: Record<string, string> = {
  pending: "warning",
  approved: "info",
  in_progress: "info",
  ready: "primary",
  fulfilled: "success",
  denied: "destructive",
  cancelled: "muted",
};

export function formatOrderStatus(s: string | null | undefined): string {
  if (!s) return "—";
  return ORDER_STATUS_LABELS[s] ?? s;
}

export const SAIDA_STATUS_LABELS: Record<string, string> = {
  planeada: "Planeada",
  em_curso: "Em curso",
  pausada: "Pausada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

export const SAIDA_STATUS_TONE: Record<string, string> = {
  planeada: "info",
  em_curso: "warning",
  pausada: "muted",
  finalizada: "success",
  cancelada: "destructive",
  expirada: "destructive",
};

export function formatSaidaStatus(s: string | null | undefined): string {
  if (!s) return "—";
  return SAIDA_STATUS_LABELS[s] ?? s;
}

// Fonte única de verdade para nomes de eventos da Auditoria.
// Cobre verbos genéricos + eventos específicos do bairro.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // verbos genéricos
  create: "Criou",
  update: "Atualizou",
  delete: "Apagou",
  liquidate: "Liquidou",
  approve: "Aceitou",
  deny: "Recusou",
  fulfill: "Entregou",
  promote: "Promoveu",
  demote: "Despromoveu",
  role_change: "Mudou cargo",
  notify: "Notificou",

  // membros
  member_promoted: "Promoção",
  member_demoted: "Despromoção",
  member_kicked: "Expulsão",
  member_joined: "Entrada no bairro",
  member_renamed: "Renomeação",
  member_tier_set: "Tier alterado",
  member_stats_adjusted: "Stats ajustadas",

  // encomendas
  order_new: "Encomenda criada",
  order_created: "Encomenda criada",
  order_approved: "Encomenda aceite",
  order_denied: "Encomenda recusada",
  order_fulfilled: "Encomenda entregue",
  order_cancelled: "Encomenda cancelada",

  // entregas / inventário
  delivery_created: "Entrega registada",
  inventory_in: "Entrada de stock",
  inventory_out: "Saída de stock",

  // saídas
  operation_created: "Saída planeada",
  operation_started: "Saída iniciada",
  operation_finalized: "Saída finalizada",
  operation_closed: "Saída fechada",

  // prémios
  prize_set: "Prémio definido",
  prize_delivered: "Prémio entregue",

  // ranking / sistema
  rankings_recompute: "Ranking recalculado",

  // tags
  tag_request: "Pedido de tag",
  tag_approved: "Tag aprovada",
  tag_denied: "Tag recusada",
};

export function formatAuditAction(a: string | null | undefined): string {
  if (!a) return "—";
  return AUDIT_ACTION_LABELS[a] ?? a.replace(/_/g, " ");
}

// ───────── Categorias de itens (PT-PT bonito) ─────────
// Transforma slugs internos (ex: "armas_red", "drogas") em labels apresentáveis.
export const CATEGORY_LABELS: Record<string, string> = {
  armas: "Armas",
  armas_red: "Armas",
  municoes: "Munições",
  municao: "Munições",
  carregadores: "Carregadores",
  coletes: "Coletes",
  acessorios: "Acessórios",
  drogas: "Drogas",
  consumiveis: "Consumíveis",
  materiais: "Materiais",
  veiculos: "Veículos",
  outros: "Outros",
};

export function formatCategoryLabel(c: string | null | undefined): string {
  if (!c) return "Outros";
  const key = c.toLowerCase().trim();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  // fallback: capitalizar e tirar underscores
  return key
    .replace(/_/g, " ")
    .replace(/\b([a-záéíóúâêîôûãõç])/gi, (m) => m.toUpperCase());
}

// "Embeleza" nomes de itens vindos da DB — capitaliza palavras e arruma espaços.
export function prettyItemName(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-záéíóúâêîôûãõç])([a-záéíóúâêîôûãõç]*)/gi,
      (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
}

