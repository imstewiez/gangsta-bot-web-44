// Pure helpers + types — safe for client AND server. NO server-only imports.

const MANAGER_TIERS = new Set(["patrao_di_zona", "kingpin", "manda_chuva"]);
const INVENTORY_TIERS = new Set([
  "patrao_di_zona",
  "og",
  "kingpin",
  "manda_chuva",
]);
const SUPERADMIN_TIERS = new Set(["manda_chuva"]);
const ADMIN_TIERS = new Set(["kingpin", "manda_chuva"]);

export function isSuperAdmin(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (member.tier && SUPERADMIN_TIERS.has(member.tier)) return true;
  if (member.role_label === "manda_chuva") return true;
  return false;
}

export function isAdmin(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (isSuperAdmin(member)) return true;
  if (member.tier && ADMIN_TIERS.has(member.tier)) return true;
  if (member.role_label === "kingpin" || member.role_label === "admin" || member.role_label === "chefia")
    return true;
  return false;
}

export function isManager(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (isAdmin(member)) return true;
  if (member.tier && MANAGER_TIERS.has(member.tier)) return true;
  if (member.role_label === "chefia" || member.role_label === "manda_chuva" || member.role_label === "admin")
    return true;
  return false;
}

export function canSeeInventory(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (member.tier && INVENTORY_TIERS.has(member.tier)) return true;
  if (member.role_label === "chefia" || member.role_label === "manda_chuva")
    return true;
  return false;
}

export type CurrentMember = {
  id: number;
  discord_id: string | null;
  display_name: string | null;
  tier: string | null;
  role_label: string | null;
  is_superadmin: boolean;
  is_admin: boolean;
  is_manager: boolean;
  can_see_inventory: boolean;
  is_morador: boolean;
};

export type CatalogItem = {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  side: "compra" | "venda";
  purchase_price: number | null;
  morador_purchase_price: number | null;
  min_sale_price: number | null;
  xp_points: number;
  tier_price?: number | null;
};

// ── Pontos por item (espelho do real-gangsta-bot) ───────────────────────────
const ITEM_POINTS = new Map<string, number>([
  // 4 pontos
  ["print", 4],
  ["prints", 4],
  ["peças", 4],
  ["pecas", 4],
  ["molde de arma", 4],
  ["moldes", 4],
  ["corpo", 4],
  ["corpos", 4],
  // 3 pontos
  ["cobre", 3],
  ["serradura", 3],
  ["pólvora", 3],
  ["polvora", 3],
  ["peças estragadas", 3],
  ["pecas estragadas", 3],
  // 2 pontos
  ["lixo eletrónico", 2],
  ["lixo eletronico", 2],
  ["sucata", 2],
  ["plástico reciclado", 2],
  ["plastico reciclado", 2],
  ["telemóvel estragado", 2],
  ["telemovel estragado", 2],
  ["rádio estragado", 2],
  ["radio estragado", 2],
  ["plástico velho", 2],
  ["plastico velho", 2],
]);

const ZERO_POINT_CATEGORIES = new Set(["quimicos_droga", "dinheiro"]);

export function itemPoints(name: string, category: string | null, xpPoints?: number | null): number {
  if (xpPoints != null) return xpPoints;
  if (category && ZERO_POINT_CATEGORIES.has(category.toLowerCase())) return 0;
  return ITEM_POINTS.get(name.toLowerCase().trim()) ?? 1;
}

