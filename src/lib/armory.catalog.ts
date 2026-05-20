// =============================================================
// ARMORY CATALOG — Fonte de verdade única para TODAS as categorias,
// icons, cores e labels. Usado por todas as páginas.
// =============================================================

import {
  Crosshair,
  Swords,
  Sword,
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
  type LucideIcon,
} from "lucide-react";

export type ArmoryCategory =
  | "armas_orange"
  | "armas_red"
  | "armas_brancas"
  | "carregadores"
  | "acessorios"
  | "acessorios_armas"
  | "coletes"
  | "drogas"
  | "craft_armas"
  | "craft_carregadores"
  | "materiais_craft"
  | "lixo"
  | "madeiras"
  | "materias_primas"
  | "minerios"
  | "corpos"
  | "prints"
  | "outros";

export const ARMORY_CAT_ORDER: ArmoryCategory[] = [
  "armas_orange",
  "armas_red",
  "carregadores",
  "acessorios",
  "acessorios_armas",
  "coletes",
  "drogas",
  "craft_armas",
  "craft_carregadores",
  "materiais_craft",
  "lixo",
  "madeiras",
  "materias_primas",
  "minerios",
  "corpos",
  "prints",
  "armas_brancas",
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
  armas_brancas: {
    label: "Armas Brancas",
    icon: Sword,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    headerColor: "text-cyan-400",
    tone: "info",
  },
  carregadores: {
    label: "Craft Carregadores",
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
  acessorios_armas: {
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
  drogas: {
    label: "Drogas",
    icon: Pill,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    headerColor: "text-purple-400",
    tone: "success",
  },
  craft_armas: {
    label: "Craft Armas",
    icon: Hammer,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    headerColor: "text-orange-400",
    tone: "primary",
  },
  craft_carregadores: {
    label: "Craft Carregadores",
    icon: FlaskConical,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    headerColor: "text-blue-400",
    tone: "muted",
  },
  materiais_craft: {
    label: "Materiais Craft",
    icon: Cog,
    color: "text-stone-400",
    bg: "bg-stone-500/10",
    border: "border-stone-500/30",
    headerColor: "text-stone-400",
    tone: "muted",
  },
  lixo: {
    label: "Lixo",
    icon: Recycle,
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    headerColor: "text-muted-foreground",
    tone: "muted",
  },
  madeiras: {
    label: "Madeiras",
    icon: Trees,
    color: "text-amber-700",
    bg: "bg-amber-700/10",
    border: "border-amber-700/30",
    headerColor: "text-amber-700",
    tone: "success",
  },
  materias_primas: {
    label: "Matérias-primas",
    icon: Cog,
    color: "text-stone-400",
    bg: "bg-stone-500/10",
    border: "border-stone-500/30",
    headerColor: "text-stone-400",
    tone: "muted",
  },
  minerios: {
    label: "Minérios",
    icon: Pickaxe,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    headerColor: "text-slate-400",
    tone: "info",
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

// Print tiers — uniform labels across the app
export const PRINT_LABELS: Record<string, string> = {
  azul: "Print Azul",
  amarela: "Print Amarela",
  vermelha: "Print Vermelha",
  laranja: "Print Laranja",
  orange: "Orange",
  red: "Red",
};

export const PRINT_BADGE_CLASS: Record<string, string> = {
  azul: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  amarela: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  vermelha: "bg-red-500/15 text-red-400 border-red-500/40",
  laranja: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  red: "bg-red-500/15 text-red-400 border-red-500/40",
};

// Weapons that are Orange regardless of their print tier
const ORANGE_WEAPON_NAMES = [
  "AP Pistol",
  "Machine Pistol",
  "Micro SMG",
  "Mini SMG",
  "Pistol XM3",
  "TEC Pistol",
  "Compact Rifle",
  "Assault Shotgun",
  "Gusenberg",
  "Heavy Shotgun",
  "SNS Pistol",
];

function isOrangeWeapon(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return ORANGE_WEAPON_NAMES.some((o) => n.includes(o.toLowerCase()));
}

// Map DB tier → display category for weapons
export function weaponDisplayCategory(
  recipeCat: string | null,
  tier: string | null,
  itemName: string | null,
): ArmoryCategory | null {
  if (recipeCat === "craft_carregadores") return "carregadores";
  if (recipeCat === "craft_weapons") {
    if (tier === "orange") return "armas_orange";
    if (isOrangeWeapon(itemName)) return "armas_orange";
    return "armas_red";
  }
  return null;
}

// Map item subcategory → display category for catalog/pricing
export function pricingDisplayCategory(
  sub: string | null,
  itemName?: string | null,
): ArmoryCategory | null {
  if (sub === "armas_orange") return "armas_orange";
  if (sub === "armas_red" || sub === "azul" || sub === "vermelha" || sub === "amarela") {
    if (isOrangeWeapon(itemName ?? null)) return "armas_orange";
    return "armas_red";
  }
  if (sub === "carregadores") return "carregadores";
  return null;
}

// Subcategory label override — replace ugly raw names
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

// Ingredient unit prices (from DB) — single source of truth
export const INGREDIENT_UNIT_PRICE: Record<string, number> = {
  "Aço": 1000,
  "Peças": 1400,
  "Cobre": 65,
  "Pólvora": 100,
  "Barra de Ouro": 500,
  "Print Azul": 50000,
  "Print Amarela": 100000,
  "Print Vermelha": 70000,
  "Print Laranja": 10000,
  "Corpo Mini SMG": 20000,
  "Corpo Pistol XM3": 20000,
  "Corpo UZI": 20000,
  "Corpo TEC-9": 20000,
  "Corpo TEC Pistol": 20000,
  "Corpo AP Pistol": 20000,
};
