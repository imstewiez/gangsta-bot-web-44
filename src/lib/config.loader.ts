/**
 * Config Loader — Fonte de verdade única para itens, preços e receitas.
 * Carrega o config.json centralizado e expõe helpers tipados.
 *
 * Regra: sempre que precisares de um item, preço, receita ou categoria,
 * importa deste ficheiro. NUNCA hardcodes.
 */

import config from "../../config.json";

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ItemType =
  | "weapon"
  | "magazine"
  | "print"
  | "body"
  | "accessory"
  | "material";

export type ItemTier = "orange" | "red" | "special" | null;

export type ItemSide = "venda" | "compra" | "ambos";

export type ConfigItem = {
  name: string;
  type: ItemType;
  tier: ItemTier;
  buyPrice: number | null;
  sellPrice: number | null;
  estimatedValue: number | null;
  stackable: boolean;
  weight: number;
  xpPoints: number;
  side: ItemSide;
  category: string | null;
  subcategory: string | null;
};

export type ConfigRecipe = {
  output: string; // item ID
  quantity: number;
  inputs: Record<string, number>; // item ID -> quantidade
};

// ── Dados brutos ────────────────────────────────────────────────────────────

const ITEMS = config.items as Record<string, ConfigItem>;
const RECIPES = config.recipes as Record<string, ConfigRecipe>;

// Mapa de compatibilidade numérica para o frontend (que espera id: number)
// Gerado sequencialmente pela ordem do config.json
const _ID_TO_NUMERIC = new Map<string, number>();
const _NUMERIC_TO_ID = new Map<number, string>();
let _numericIdCounter = 1;
for (const key of Object.keys(ITEMS)) {
  _ID_TO_NUMERIC.set(key, _numericIdCounter);
  _NUMERIC_TO_ID.set(_numericIdCounter, key);
  _numericIdCounter++;
}

/** Devolve o ID numérico de um item pelo string ID */
export function getNumericId(itemId: string): number {
  return _ID_TO_NUMERIC.get(itemId) ?? 0;
}

/** Devolve o string ID de um item pelo ID numérico */
export function getStringId(numericId: number): string | undefined {
  return _NUMERIC_TO_ID.get(numericId);
}

// ── Helpers de lookup ───────────────────────────────────────────────────────

/** Devolve um item pelo string ID (ex: "weapon_orange_minismg") */
export function getItemById(id: string): ConfigItem | undefined {
  return ITEMS[id];
}

/** Devolve um item pelo ID numérico (compatibilidade frontend) */
export function getItemByNumericId(numericId: number): ConfigItem | undefined {
  const id = _NUMERIC_TO_ID.get(numericId);
  return id ? ITEMS[id] : undefined;
}

/** Devolve o string ID de um item pelo nome exacto (ex: "Mini SMG") */
export function getItemIdByName(name: string): string | undefined {
  return Object.keys(ITEMS).find((k) => ITEMS[k].name === name);
}

/** Devolve um item pelo nome exacto */
export function getItemByName(name: string): ConfigItem | undefined {
  const id = getItemIdByName(name);
  return id ? ITEMS[id] : undefined;
}

/** Lista todos os items */
export function getAllItems(): Record<string, ConfigItem> {
  return ITEMS;
}

/** Lista items filtrados por type */
export function getItemsByType(type: ItemType): Record<string, ConfigItem> {
  return Object.fromEntries(
    Object.entries(ITEMS).filter(([, v]) => v.type === type)
  );
}

/** Lista items filtrados por tier */
export function getItemsByTier(tier: ItemTier): Record<string, ConfigItem> {
  return Object.fromEntries(
    Object.entries(ITEMS).filter(([, v]) => v.tier === tier)
  );
}

/** Lista items que a firma vende (venda + ambos) */
export function getSaleItems(): Record<string, ConfigItem> {
  return Object.fromEntries(
    Object.entries(ITEMS).filter(([, v]) => v.side === "venda" || v.side === "ambos")
  );
}

/** Lista items que a firma compra (compra + ambos) */
export function getBuyItems(): Record<string, ConfigItem> {
  return Object.fromEntries(
    Object.entries(ITEMS).filter(([, v]) => v.side === "compra" || v.side === "ambos")
  );
}

/** Lista items por categoria/subcategoria */
export function getItemsByCategory(
  category: string,
  subcategory?: string
): Record<string, ConfigItem> {
  return Object.fromEntries(
    Object.entries(ITEMS).filter(([, v]) => {
      if (v.category !== category) return false;
      if (subcategory !== undefined && v.subcategory !== subcategory) return false;
      return true;
    })
  );
}

// ── Helpers de receitas ─────────────────────────────────────────────────────

/** Devolve uma receita pelo ID (ex: "recipe_minismg") */
export function getRecipeById(id: string): ConfigRecipe | undefined {
  return RECIPES[id];
}

/** Devolve a receita que produz um dado item ID */
export function getRecipeForItem(itemId: string): ConfigRecipe | undefined {
  return Object.values(RECIPES).find((r) => r.output === itemId);
}

/** Devolve a receita que produz um item pelo nome */
export function getRecipeForItemName(name: string): ConfigRecipe | undefined {
  const id = getItemIdByName(name);
  return id ? getRecipeForItem(id) : undefined;
}

/** Lista todas as receitas */
export function getAllRecipes(): Record<string, ConfigRecipe> {
  return RECIPES;
}

/** Calcula o custo total de materiais de uma receita (usando buyPrice dos ingredientes) */
export function getRecipeMaterialCost(recipeId: string): number {
  const recipe = RECIPES[recipeId];
  if (!recipe) return 0;
  let cost = 0;
  for (const [ingId, qty] of Object.entries(recipe.inputs)) {
    const ing = ITEMS[ingId];
    cost += (ing?.buyPrice ?? 0) * qty;
  }
  return cost;
}

// ── Helpers de preços ───────────────────────────────────────────────────────

/** Devolve o preço de venda (sellPrice) de um item pelo ID */
export function getSellPrice(itemId: string): number | null {
  return ITEMS[itemId]?.sellPrice ?? null;
}

/** Devolve o preço de compra/custo (buyPrice) de um item pelo ID */
export function getBuyPrice(itemId: string): number | null {
  return ITEMS[itemId]?.buyPrice ?? null;
}

/** Devolve o valor estimado de um item pelo ID */
export function getEstimatedValue(itemId: string): number | null {
  return ITEMS[itemId]?.estimatedValue ?? null;
}

// ── Helpers de display / categorias ─────────────────────────────────────────

export const ARMORY_CATEGORIES = [
  "armas_orange",
  "armas_red",
  "carregadores",
  "corpos",
  "prints",
  "coletes",
  "acessorios",
  "reciclagem",
  "outros",
] as const;

export type ArmoryCategory = (typeof ARMORY_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  armas_orange: "Armas Orange",
  armas_red: "Armas Red",
  carregadores: "Carregadores",
  corpos: "Corpos",
  prints: "Prints",
  coletes: "Coletes",
  acessorios: "Acessórios",
  outros: "Outros",
  municoes: "Munições",
  materiais: "Materiais",
  equipamento: "Equipamento",
  metais: "Metais",
  componentes: "Componentes",
  reciclagem: "Reciclagem",
  dinheiro: "Dinheiro",
};

/** Devolve o label bonito de uma categoria */
export function getCategoryLabel(category: string | null): string {
  if (!category) return "Outros";
  return CATEGORY_LABELS[category] ?? category;
}

// ── Tier pricing helpers (compatibilidade com pricing antigo) ───────────────

// Tier pricing lido do config.json
const APP = (config as any).app ?? {};
const TIER_WEAPON_SURCHARGE: Record<string, number> = APP.tierPricing?.weaponSurcharge ?? {};
const TIER_MAGAZINE_PRICES: Record<string, Record<string, number>> = APP.tierPricing?.magazinePrices ?? {};

/**
 * Devolve o preço de venda de uma arma consoante o tier do membro.
 */
export function getWeaponSalePrice(basePrice: number, memberTier: string | null): number {
  if (!memberTier) return basePrice;
  const surcharge = TIER_WEAPON_SURCHARGE[memberTier] ?? 0;
  return basePrice + surcharge;
}

/**
 * Devolve o preço de venda de um carregador consoante o tier do membro.
 */
export function getMagazineSalePrice(
  magTier: "orange" | "red" | "special",
  memberTier: string | null
): number {
  if (!memberTier) {
    const base = { orange: 330, red: 660, special: 990 };
    return base[magTier];
  }
  return (
    TIER_MAGAZINE_PRICES[magTier]?.[memberTier] ??
    TIER_MAGAZINE_PRICES[magTier]?.gangster_fodido ??
    0
  );
}

// ── App config helpers (tiers, XP, filtros, etc.) ───────────────────────────

export function getAppConfig() { return APP; }

// Tiers
export function getTierOrder(): string[] { return APP.tiers?.order ?? []; }
export function getTierLabels(): Record<string, string> { return APP.tiers?.labels ?? {}; }
export function getTierGradients(): Record<string, string> { return APP.tiers?.gradients ?? {}; }
export function getTierAccents(): Record<string, string> { return APP.tiers?.accents ?? {}; }
export function getTierPositions(): Record<string, string> { return APP.tiers?.positions ?? {}; }
export function getTierBenefits(): Record<string, string[]> { return APP.tiers?.benefits ?? {}; }
export function isManagerTier(tier: string | null): boolean { return tier ? APP.tiers?.managerTiers?.includes(tier) ?? false : false; }
export function isInventoryTier(tier: string | null): boolean { return tier ? APP.tiers?.inventoryTiers?.includes(tier) ?? false : false; }
export function isSuperAdminTier(tier: string | null): boolean { return tier ? APP.tiers?.superadminTiers?.includes(tier) ?? false : false; }
export function isAdminTier(tier: string | null): boolean { return tier ? APP.tiers?.adminTiers?.includes(tier) ?? false : false; }

// XP
export function getXpPoints(): Record<string, number> { return APP.xpPoints ?? {}; }
export function getPromotions(): Array<{ from: string; to: string; threshold: number }> { return APP.promotions ?? []; }

// Filtros
export function getOrderAllowedCategories(): string[] { return APP.filters?.orderAllowedCategories ?? []; }
export function getInventoryExcludedItems(): string[] { return APP.filters?.inventoryExcludedItems ?? []; }
export function getBannedWeaponPatterns(): string[] { return APP.filters?.bannedWeaponPatterns ?? []; }
export function getAllowedAccessoryPatterns(): string[] { return APP.filters?.allowedAccessoryPatterns ?? []; }
export function getAllowedMagazinePattern(): string { return APP.filters?.allowedMagazinePattern ?? ""; }
export function getColetePattern(): string { return APP.filters?.coletePattern ?? ""; }

// Outros
export function getPrizeTypes(): string[] { return APP.prizeTypes ?? []; }
export function getOperationTypes(): Record<string, { label: string; color: string; bg: string }> { return APP.operationTypes ?? {}; }
export function getOrderWorkflow() { return APP.orderWorkflow ?? {}; }

/**
 * Devolve o preço de venda tierizado de um item pelo ID.
 */
export function getTierPrice(itemId: string, memberTier: string | null): number | null {
  const item = ITEMS[itemId];
  if (!item) return null;

  const basePrice = item.sellPrice ?? item.estimatedValue ?? 0;
  const name = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Corpos e prints mantêm sempre o preço base
  if (/\bcorpo\b|\bprint\b/.test(name)) return basePrice;

  // Carregadores
  if (item.type === "magazine" || /carregador/.test(name)) {
    const magTier = name.includes("special")
      ? "special"
      : name.includes("red")
        ? "red"
        : "orange";
    return getMagazineSalePrice(magTier, memberTier);
  }

  // Armas de fogo
  if (
    item.type === "weapon" ||
    /mini smg|xm3|micro smg|tec-?9|tec pistol|ap pistol|compact rifle|heavy|\.50|p90|pdw|bullpup|carabina/.test(
      name
    )
  ) {
    return getWeaponSalePrice(basePrice, memberTier);
  }

  return basePrice;
}
