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
  | "carregadores"
  | "acessorios"
  | "coletes"
  | "corpos"
  | "prints"
  | "outros";

export const ARMORY_CAT_ORDER: ArmoryCategory[] = [
  "armas_orange",
  "armas_red",
  "carregadores",
  "corpos",
  "prints",
  "coletes",
  "acessorios",
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

// ── Armas banidas (não aparecem em nenhuma página) ─────────────────────────
const BANNED_WEAPON_NAMES: string[] = [];

function isBannedWeapon(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase().trim();
  return BANNED_WEAPON_NAMES.some((w) => n === w.toLowerCase().trim());
}

import { getItemByName } from "./config.loader";

export function isOrangeWeapon(name: string | null): boolean {
  if (!name) return false;
  const item = getItemByName(name);
  if (item) return item.tier === "orange";
  // fallback para nomes que não estão no config
  const n = name.toLowerCase().trim();
  if (/\bcorpo\b|\bprint\b|\besquema\b|\bblueprint\b|\bchassi\b/.test(n)) return false;
  return false;
}

// ── Filtro UNIFICADO para TODAS as páginas ─────────────────────────────────
// Retorna a categoria se o item deve aparecer, ou null se deve ser escondido.
// Usar esta função em vez de replicar filtros ad-hoc em cada página.
export function filterItemForDisplay(
  itemName: string,
  category: string | null,
  subcategory: string | null,
): ArmoryCategory | null {
  const name = itemName.toLowerCase();

  // Banidas
  if (isBannedWeapon(itemName)) return null;
  // MK2 — totalmente banido
  if (/mk2/i.test(itemName)) return null;

  const cat = itemDisplayCategory(itemName, category, subcategory);

  // Categorias escondidas
  if (cat === "outros") return null;

  // Apenas colete padrão
  if (cat === "coletes" && !/padrão/.test(name)) return null;

  // Apenas acessórios permitidos explicitamente
  if (cat === "acessorios") {
    const allowed = /silenciador|barrel|muzzle|grip|mira|extensivo|mag expandido/i;
    if (!allowed.test(itemName)) return null;
  }

  // Armas red/orange — já filtradas pela categoria acima, não precisam de whitelist

  // Carregadores: apenas as 3 opções genéricas (Orange / Red / Especial).
  // Esconde carregadores específicos por arma (TEC-9 Carregador, PDW Carregador, etc.).
  if (cat === "carregadores") {
    if (!/^carregador\s+(orange|red|especial|special)$/i.test(itemName.trim())) return null;
  }

  return cat;
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

  // 0. Revolver é excluído explicitamente
  if (name === "revolver") return "outros";

  // 1. Carregadores — tudo na mesma categoria
  if (
    sub === "carregadores" ||
    sub === "municoes" ||
    cat === "municoes" ||
    sub === "craft_carregadores" ||
    name.includes("carregador")
  ) {
    return "carregadores";
  }

  // 2. Armas — usar categorias do config.json como fonte de verdade
  if (cat === "armas_orange" || sub === "armas_orange") return "armas_orange";
  if (cat === "armas_red" || sub === "armas_red") return "armas_red";
  if (sub === "craft_weapons" || cat === "craft_weapons") {
    // Neste caso, usamos o tier se disponível
    if (sub === "armas_orange" || cat === "armas_orange") return "armas_orange";
    return "armas_red";
  }

  // Fallback: detectar armas pelo nome (apenas se não tiver categoria definida)
  const isWeaponByName =
    !name.includes("print") &&
    !name.includes("corpo") &&
    !name.includes("carregador") &&
    /\b(carabina|combat|p90|\.50|smg|rifle|shotgun|sniper|fuzil|ak\b|m4|g36|scar|barrett|awp|deagle|glock|tec|uzi|mp5|mp7|vector|compact|assault|heavy|mini|micro|machine|ap\s|sns\s|revolver)\b/.test(
      name,
    );
  if (isWeaponByName) {
    return "armas_red"; // fallback genérico
  }

  // 3. Corpos
  if (cat === "corpos" || sub === "corpos" || /corpo|chassi/.test(name))
    return "corpos";

  // 4. Prints (só se NÃO for arma — já verificado acima)
  if (cat === "prints" || sub === "prints" || /print|esquema|blueprint/.test(name))
    return "prints";

  // 5. Acessórios / coletes
  if (
    sub === "acessorios" ||
    sub === "acessorios_armas" ||
    cat === "acessorios" ||
    cat === "acessorios_armas"
  )
    return "acessorios";
  if (sub === "coletes" || cat === "coletes") return "coletes";

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


