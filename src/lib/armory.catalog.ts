// =============================================================
// ARMORY CATALOG — Fonte de verdade única para TODAS as categorias,
// icons, cores e labels. Usado por todas as páginas.
// =============================================================

import {
  Crosshair,
  Swords,
  Package,
  Cylinder,
  Telescope,
  Shield,
  Pill,
  Hammer,
  FlaskConical,
  Cog,
  Recycle,
  Trees,
  Pickaxe,
  Box,
  Layers,
  Skull,
  Banknote,
  type LucideIcon,
} from "lucide-react";

import {
  getAllowedAccessoryPatterns,
  getAllowedMagazinePattern,
  getColetePattern,
  getBannedWeaponPatterns,
  getItemByName,
} from "./config.loader";

export type ArmoryCategory =
  | "armas_orange"
  | "armas_red"
  | "carregadores"
  | "acessorios"
  | "coletes"
  | "corpos"
  | "prints"
  | "reciclagem"
  | "materiais"
  | "metais"
  | "madeiras"
  | "texteis"
  | "componentes"
  | "droga"
  | "equipamento"
  | "dinheiro"
  | "outros";

export const ARMORY_CAT_ORDER: ArmoryCategory[] = [
  "armas_orange",
  "armas_red",
  "carregadores",
  "corpos",
  "prints",
  "coletes",
  "acessorios",
  "reciclagem",
  "materiais",
  "metais",
  "madeiras",
  "texteis",
  "componentes",
  "droga",
  "equipamento",
  "dinheiro",
  "outros",
];

export const ARMORY_CAT_CONFIG: Record<
  ArmoryCategory,
  {
    label: string;
    icon: LucideIcon;
    color: string;
    bg: string;
    border: string;
    headerColor: string;
    tone: string;
  }
> = {
  armas_orange: {
    label: "Armas Orange",
    icon: Swords,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    headerColor: "text-orange-400",
    tone: "warning",
  },
  armas_red: {
    label: "Armas Red",
    icon: Skull,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    headerColor: "text-red-400",
    tone: "destructive",
  },
  carregadores: {
    label: "Carregadores",
    icon: Cylinder,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    headerColor: "text-blue-400",
    tone: "primary",
  },
  acessorios: {
    label: "Acessórios",
    icon: Telescope,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    headerColor: "text-yellow-400",
    tone: "info",
  },
  coletes: {
    label: "Coletes",
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    headerColor: "text-emerald-400",
    tone: "warning",
  },
  corpos: {
    label: "Corpos",
    icon: Box,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    headerColor: "text-rose-400",
    tone: "warning",
  },
  prints: {
    label: "Prints",
    icon: Layers,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    headerColor: "text-primary",
    tone: "primary",
  },
  reciclagem: {
    label: "Reciclagem",
    icon: Recycle,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    headerColor: "text-green-400",
    tone: "muted",
  },
  materiais: {
    label: "Materiais",
    icon: Cog,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    headerColor: "text-slate-400",
    tone: "muted",
  },
  metais: {
    label: "Metais",
    icon: Pickaxe,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    headerColor: "text-zinc-400",
    tone: "muted",
  },
  madeiras: {
    label: "Madeiras",
    icon: Trees,
    color: "text-amber-600",
    bg: "bg-amber-600/10",
    border: "border-amber-600/30",
    headerColor: "text-amber-600",
    tone: "muted",
  },
  texteis: {
    label: "Têxteis",
    icon: FlaskConical,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    headerColor: "text-pink-400",
    tone: "muted",
  },
  componentes: {
    label: "Componentes",
    icon: Hammer,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    headerColor: "text-cyan-400",
    tone: "muted",
  },
  droga: {
    label: "Droga",
    icon: Pill,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    headerColor: "text-purple-400",
    tone: "muted",
  },
  equipamento: {
    label: "Equipamento",
    icon: Crosshair,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    headerColor: "text-indigo-400",
    tone: "muted",
  },
  dinheiro: {
    label: "Dinheiro",
    icon: Banknote,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    headerColor: "text-emerald-500",
    tone: "muted",
  },
  outros: {
    label: "Outros",
    icon: Package,
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    headerColor: "text-muted-foreground",
    tone: "muted",
  },
};

export const PRINT_LABELS: Record<string, string> = {
  azul: "Print Azul",
  amarela: "Print Amarela",
  vermelha: "Print Vermelha",
  laranja: "Print Laranja",
  orange: "Print Orange",
  red: "Print Red",
};

export const PRINT_BADGE_CLASS: Record<string, string> = {
  azul: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  amarela: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  vermelha: "bg-red-500/15 text-red-400 border-red-500/40",
  laranja: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  red: "bg-red-500/15 text-red-400 border-red-500/40",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isBannedWeapon(name: string | null): boolean {
  if (!name) return false;
  const n = normalize(name);
  const bannedPatterns = getBannedWeaponPatterns();
  return bannedPatterns.some((w) => n.includes(normalize(w)));
}

export function isOrangeWeapon(name: string | null): boolean {
  if (!name) return false;
  const item = getItemByName(name);
  if (item) return item.tier === "orange";
  return false;
}

export function filterItemForDisplay(
  itemName: string,
  category: string | null,
  subcategory: string | null,
): ArmoryCategory | null {
  const name = normalize(itemName);
  if (isBannedWeapon(itemName)) return null;

  const cat = itemDisplayCategory(itemName, category, subcategory);

  // Apenas o colete padrão é público nas páginas de encomenda/preçário.
  // A gestão de materiais continua a mostrar todos.
  if (cat === "coletes") {
    const coletePattern = normalize(getColetePattern());
    if (coletePattern && !name.includes(coletePattern)) return null;
  }

  if (cat === "acessorios") {
    const allowedPatterns = getAllowedAccessoryPatterns().map(normalize).filter(Boolean);
    if (allowedPatterns.length > 0 && !allowedPatterns.some((p) => name.includes(p))) return null;
  }

  if (cat === "carregadores") {
    const magPattern = getAllowedMagazinePattern();
    if (magPattern && !new RegExp(magPattern, "i").test(itemName.trim())) return null;
  }

  return cat;
}

export function itemDisplayCategory(
  itemName: string,
  category: string | null,
  subcategory: string | null,
): ArmoryCategory {
  const name = normalize(itemName);
  const sub = normalize(subcategory);
  const cat = normalize(category);

  if (name === "revolver") return "outros";

  // Coletes têm prioridade sobre acessórios/equipamento. Isto corrige itens
  // criados como categoria "equipamento" mas cujo nome é "Colete Padrão".
  if (name.includes("colete") || sub === "coletes" || cat === "coletes") return "coletes";

  if (
    sub === "carregadores" ||
    sub === "municoes" ||
    cat === "municoes" ||
    sub === "craft_carregadores" ||
    name.includes("carregador")
  ) return "carregadores";

  if (cat === "armas_orange" || sub === "armas_orange") return "armas_orange";
  if (cat === "armas_red" || sub === "armas_red") return "armas_red";
  if (sub === "craft_weapons" || cat === "craft_weapons") return "armas_red";

  if (cat === "corpos" || sub === "corpos" || /corpo|chassi/.test(name)) return "corpos";
  if (cat === "prints" || sub === "prints" || /print|esquema|blueprint/.test(name)) return "prints";
  if (cat === "reciclagem" || sub === "reciclagem") return "reciclagem";

  if (cat === "metais" || sub === "metais") return "metais";
  if (cat === "madeiras" || sub === "madeiras") return "madeiras";
  if (cat === "texteis" || sub === "texteis") return "texteis";
  if (cat === "componentes" || sub === "componentes") return "componentes";
  if (cat === "droga" || sub === "droga" || name.includes("haxixe") || name.includes("opio") || name.includes("meth")) return "droga";
  if (cat === "dinheiro" || sub === "dinheiro" || name.includes("dinheiro sujo")) return "dinheiro";

  if (
    sub === "acessorios" ||
    sub === "acessorios_armas" ||
    cat === "acessorios" ||
    cat === "acessorios_armas"
  ) return "acessorios";

  if (cat === "materiais" || sub === "materiais") return "materiais";
  if (cat === "equipamento" || sub === "equipamento") return "equipamento";

  return "outros";
}

export function itemSubLabel(
  category: string | null,
  recipeCategory: string | null,
): string {
  if (recipeCategory === "craft_weapons") return "Craft Armas";
  if (recipeCategory === "craft_carregadores") return "Craft Carregadores";
  if (category === "armas_fogo") return "Craft Armas";
  if (category === "municoes") return "Craft Carregadores";
  return "—";
}
