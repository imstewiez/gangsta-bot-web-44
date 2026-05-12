// Pure helpers + types — safe for client AND server. NO server-only imports.

export const TIER_LABELS: Record<string, string> = {
  young_blood: "YB (Bairrista N1)",
  o_gunao: "GN (Bairrista N2)",
  gangster_fodido: "GF (Bairrista N3)",
  patrao_di_zona: "Patrão di Zona",
  real_gangster: "Real Gangster",
  og: "OG",
  kingpin: "Kingpin",
  manda_chuva: "Manda-Chuva",
};

const TIER_MARGIN: Record<string, number> = {
  young_blood: 0.015,
  o_gunao: 0.01,
  gangster_fodido: 0.005,
  patrao_di_zona: 0,
  real_gangster: 0,
  og: 0,
  kingpin: 0,
  manda_chuva: 0,
};

export function tierMargin(tier: string | null | undefined): number {
  if (!tier) return 0;
  return TIER_MARGIN[tier] ?? 0;
}

const MANAGER_TIERS = new Set(["patrao_di_zona", "kingpin", "manda_chuva"]);
const INVENTORY_TIERS = new Set([
  "patrao_di_zona",
  "og",
  "kingpin",
  "manda_chuva",
]);

export function isManager(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (member.tier && MANAGER_TIERS.has(member.tier)) return true;
  if (member.role_label === "chefia" || member.role_label === "manda_chuva")
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
  is_manager: boolean;
  can_see_inventory: boolean;
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
};
