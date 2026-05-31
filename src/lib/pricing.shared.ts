// Pure helpers + types — safe for client AND server. NO server-only imports.

import { getXpPoints, isSuperAdminTier, isAdminTier, isManagerTier, isInventoryTier } from "./config.loader";

function normalizeRole(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isSuperAdmin(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (isSuperAdminTier(member.tier)) return true;
  if (normalizeRole(member.role_label) === "manda_chuva") return true;
  return false;
}

export function isAdmin(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (isSuperAdmin(member)) return true;
  if (isAdminTier(member.tier)) return true;
  const role = normalizeRole(member.role_label);
  if (role === "kingpin" || role === "admin" || role === "chefia") return true;
  return false;
}

export function isManager(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (isAdmin(member)) return true;
  if (isManagerTier(member.tier)) return true;
  const role = normalizeRole(member.role_label);
  if (role === "chefia" || role === "manda_chuva" || role === "admin") return true;
  return false;
}

export function canSeeInventory(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (isInventoryTier(member.tier)) return true;
  const role = normalizeRole(member.role_label);
  if (role === "chefia" || role === "manda_chuva") return true;
  return false;
}

const PRIZE_MANAGER_ROLES = new Set([
  "patrao_di_zona",
  "patrão_di_zona",
  "og",
  "kingpin",
  "manda_chuva",
]);

export function canManagePrizes(
  member: { tier: string | null; role_label?: string | null } | null,
): boolean {
  if (!member) return false;
  if (isSuperAdmin(member)) return true;
  return PRIZE_MANAGER_ROLES.has(normalizeRole(member.role_label)) || PRIZE_MANAGER_ROLES.has(normalizeRole(member.tier));
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
  can_manage_prizes: boolean;
  is_morador: boolean;
  is_viewing_as?: boolean;
  actual_member_id?: number | null;
  actual_display_name?: string | null;
};

export type CatalogItem = {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  side: "compra" | "venda" | "ambos";
  purchase_price: number | null;
  morador_purchase_price: number | null;
  min_sale_price: number | null;
  xp_points: number;
  tier_price?: number | null;
};

const ZERO_POINT_CATEGORIES = new Set(["quimicos_droga", "dinheiro"]);

export function itemPoints(name: string, category: string | null, xpPoints?: number | null): number {
  if (xpPoints != null) return xpPoints;
  if (category && ZERO_POINT_CATEGORIES.has(category.toLowerCase())) return 0;
  const points = getXpPoints();
  return points[name.toLowerCase().trim()] ?? 1;
}
