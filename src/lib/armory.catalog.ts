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
  | "carregadores_orange"
  | "carregadores_red"
  | "carregadores_especial"
  | "acessorios"
  | "acessorios_armas"
  | "coletes"
  | "extras"
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
  "carregadores_orange",
  "carregadores_red",
  "carregadores_especial",
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
  "extras",
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
    label: "Carregadores",
    icon: Cylinder,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    headerColor: "text-blue-400",
    tone: "primary",
  },
  carregadores_orange: {
    label: "Carregadores Orange",
    icon: Cylinder,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    headerColor: "text-orange-400",
    tone: "warning",
  },
  carregadores_red: {
    label: "Carregadores Red",
    icon: Cylinder,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    headerColor: "text-red-400",
    tone: "destructive",
  },
  carregadores_especial: {
    label: "Carregadores Especial",
    icon: Cylinder,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    headerColor: "text-yellow-400",
    tone: "warning",
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
  extras: {
    label: "Extras",
    icon: Package,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    headerColor: "text-yellow-400",
    tone: "info",
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

// ── Armas permitidas por categoria ──────────────────────────────────────────
// Apenas estas armas aparecem nas secções Red / Orange. Tudo o resto é escondido.

export const RED_WEAPON_NAMES = [
  "Heavy Pistol",
  "Pistol .50",
  "Combat PDW",
  "P90",
  "Bullpup Rifle",
  "Carabina Rifle",
];

export const ORANGE_WEAPON_NAMES = [
  "Mini SMG",
  "Pistol XM3",
  "Micro SMG",
  "TEC 9",
  "TEC Pistol",
  "AP Pistol",
];

export function isAllowedRedWeapon(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return RED_WEAPON_NAMES.some((w) => n.includes(w.toLowerCase()));
}

export function isAllowedOrangeWeapon(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return ORANGE_WEAPON_NAMES.some((w) => n.includes(w.toLowerCase()));
}

export function isOrangeWeapon(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return ORANGE_WEAPON_NAMES.some((o) => n.includes(o.toLowerCase()));
}

export function isAllowedWeapon(name: string | null): boolean {
  return isAllowedRedWeapon(name) || isAllowedOrangeWeapon(name);
}

// ── Classificação UNIFICADA para TODAS as páginas ──────────────────────────
// Usar esta função em vez de lógicas ad-hoc. Garante consistência entre
// armazém, preçário, encomendas, receitas, etc.
export function itemDisplayCategory(
  itemName: string,
  category: string | null,
  subcategory: string | null,
): ArmoryCategory {
  const name = itemName.toLowerCase();
  const sub = subcategory;
  const cat = category;

  // 1. Carregadores FIRST (têm "carregador" no nome)
  if (
    sub === "carregadores" ||
    sub === "municoes" ||
    cat === "municoes" ||
    sub === "craft_carregadores" ||
    name.includes("carregador")
  ) {
    if (name.includes("especial")) return "carregadores_especial";
    if (
      name.includes("red") ||
      /carregador.*(ak|m4|g36|scar|fal|sniper|barrett|kar98|awp)/.test(name)
    )
      return "carregadores_red";
    if (
      name.includes("orange") ||
      /carregador.*(ap pistol|mini smg|micro smg|tec|uzi|pistol xm3)/.test(name)
    )
      return "carregadores_orange";
    return "carregadores";
  }

  // 2. Armas (ANTES de corpos/prints — algumas armas têm category="prints" na DB)
  // Verificar primeiro pelo nome se é uma arma permitida
  if (isAllowedWeapon(itemName)) {
    if (isOrangeWeapon(itemName)) return "armas_orange";
    return "armas_red";
  }

  if (sub === "armas_orange" || cat === "armas_orange") return "armas_orange";
  if (sub === "armas_red" || cat === "armas_red") {
    if (isOrangeWeapon(itemName)) return "armas_orange";
    return "armas_red";
  }
  if (sub === "azul" || sub === "vermelha" || sub === "amarela") {
    if (isOrangeWeapon(itemName)) return "armas_orange";
    return "armas_red";
  }
  if (sub === "craft_weapons" || cat === "craft_weapons") {
    if (isOrangeWeapon(itemName)) return "armas_orange";
    return "armas_red";
  }

  // Fallback: detectar armas pelo nome
  const isWeaponByName =
    !name.includes("print") &&
    !name.includes("corpo") &&
    !name.includes("carregador") &&
    /\b(carabina|combat|p90|\.50|smg|rifle|shotgun|sniper|fuzil|ak\b|m4|g36|scar|barrett|awp|deagle|glock|tec|uzi|mp5|mp7|vector|compact|assault|heavy|mini|micro|machine|ap\s|sns\s|revolver)\b/.test(
      name,
    );
  if (isWeaponByName) {
    if (isOrangeWeapon(itemName)) return "armas_orange";
    return "armas_red";
  }

  // 3. Corpos
  if (cat === "corpos" || sub === "corpos" || /corpo|chassi/.test(name))
    return "corpos";

  // 4. Prints (só se NÃO for arma — já verificado acima)
  if (cat === "prints" || sub === "prints" || /print|esquema|blueprint/.test(name))
    return "prints";

  // 5. Materiais de craft / minérios / matérias-primas / madeiras / lixo
  if (
    cat === "materiais" ||
    cat === "materias_primas" ||
    cat === "componentes" ||
    cat === "minerios" ||
    cat === "madeiras" ||
    cat === "lixo"
  ) {
    if (name.includes("carvão") || name.includes("carvao")) return "materiais_craft";
    if (sub === "lixo") return "lixo";
    if (sub === "madeiras") return "madeiras";
    if (sub === "materias_primas") return "materias_primas";
    if (sub === "minerios") return "minerios";
    if (sub === "materiais_craft") return "materiais_craft";
    if (cat === "lixo") return "lixo";
    if (cat === "madeiras") return "madeiras";
    if (cat === "minerios") return "minerios";
    if (cat === "materias_primas") return "materias_primas";
    return "materiais_craft";
  }

  // 6. Drogas
  if (cat === "drogas" || sub === "drogas") return "drogas";

  // 7. Lixo / Madeiras / Matérias-primas / Minérios / Materiais craft (subcategory direta)
  if (sub === "lixo") return "lixo";
  if (sub === "madeiras") return "madeiras";
  if (sub === "materias_primas") return "materias_primas";
  if (sub === "minerios") return "minerios";
  if (sub === "materiais_craft") return "materiais_craft";

  // 8. Acessórios / coletes / armas brancas
  if (
    sub === "acessorios" ||
    sub === "acessorios_armas" ||
    cat === "acessorios" ||
    cat === "acessorios_armas"
  )
    return "acessorios";
  if (sub === "coletes" || cat === "coletes") return "coletes";
  if (sub === "armas_brancas" || cat === "armas_brancas") return "armas_brancas";

  // 9. Outros
  return "outros";
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
