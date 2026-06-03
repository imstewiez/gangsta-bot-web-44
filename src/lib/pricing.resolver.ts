import type { ItemTierSurcharge } from "./tier-pricing.functions";

export type ResolvedPrices = {
  purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  morador_purchase_price: number | null;
  tier_price: number | null;
  tier_price_with_material: number | null;
  tier_price_without_material: number | null;
};

const PRICE_TIER_ALIASES: Record<string, string> = {
  young_blood: "young_blood",
  youngblood: "young_blood",
  bairrista: "young_blood",
  morador: "young_blood",
  standard: "young_blood",
  oficial: "young_blood",
  nivel_1: "young_blood",
  nível_1: "young_blood",
  level_1: "young_blood",
  tier_1: "young_blood",
  bairrista_1: "young_blood",
  bairrista1: "young_blood",
  b1: "young_blood",
  o_gunao: "o_gunao",
  o_gunão: "o_gunao",
  gunao: "o_gunao",
  gunão: "o_gunao",
  nivel_2: "o_gunao",
  nível_2: "o_gunao",
  level_2: "o_gunao",
  tier_2: "o_gunao",
  bairrista_2: "o_gunao",
  bairrista2: "o_gunao",
  b2: "o_gunao",
  gangster_fodido: "gangster_fodido",
  gangster: "gangster_fodido",
  nivel_3: "gangster_fodido",
  nível_3: "gangster_fodido",
  level_3: "gangster_fodido",
  tier_3: "gangster_fodido",
  bairrista_3: "gangster_fodido",
  bairrista3: "gangster_fodido",
  b3: "gangster_fodido",
  patrao_di_zona: "patrao_di_zona",
  patrão_di_zona: "patrao_di_zona",
  real_gangster: "real_gangster",
  og: "og",
  kingpin: "kingpin",
  manda_chuva: "manda_chuva",
};

function cleanKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizePriceTier(value: string | null | undefined): string | null {
  const key = cleanKey(value);
  if (!key) return null;
  return PRICE_TIER_ALIASES[key] ?? key;
}

export function resolveMemberPriceTier(tier: string | null | undefined, role: string | null | undefined): string | null {
  const normalizedTier = normalizePriceTier(tier);
  const normalizedRole = normalizePriceTier(role);
  if (!normalizedTier || normalizedTier === "young_blood") return normalizedRole ?? normalizedTier;
  return normalizedTier;
}

function money(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function overrideKeys(memberTier: string | null | undefined): string[] {
  const raw = cleanKey(memberTier);
  const normalized = normalizePriceTier(memberTier);
  const aliases = Object.entries(PRICE_TIER_ALIASES)
    .filter(([, canonical]) => canonical === normalized)
    .map(([alias]) => alias);
  return Array.from(new Set([normalized, raw, ...(aliases ?? [])].filter(Boolean) as string[]));
}

function findOverride(memberTier: string | null | undefined, itemSurcharges?: Map<string, ItemTierSurcharge | number> | null): ItemTierSurcharge | number | null {
  if (!memberTier || !itemSurcharges) return null;
  const allowed = new Set(overrideKeys(memberTier).map((key) => normalizePriceTier(key) ?? cleanKey(key)));

  for (const key of overrideKeys(memberTier)) {
    if (itemSurcharges.has(key)) return itemSurcharges.get(key) ?? null;
  }

  for (const [storedKey, override] of itemSurcharges.entries()) {
    const normalizedStoredKey = normalizePriceTier(storedKey) ?? cleanKey(storedKey);
    if (allowed.has(normalizedStoredKey)) return override;
  }

  return null;
}

function resolveTierOverride(base: number | null, override?: ItemTierSurcharge | number | null, mode: "with" | "without" = "with"): number | null {
  if (override == null) return base;
  if (typeof override !== "number") {
    const explicit = mode === "with" ? money(override.price_with_material) : money(override.price_without_material);
    if (explicit != null) return explicit;
  }
  if (base == null) return null;
  if (typeof override === "number") {
    const final = base + override;
    return Number.isFinite(final) && final > 0 ? final : null;
  }
  if (mode === "with" && Number.isFinite(Number(override.surcharge)) && Number(override.surcharge) !== 0) {
    const final = base + Number(override.surcharge);
    return Number.isFinite(final) && final > 0 ? final : null;
  }
  return base;
}

export function resolveItemPrices(
  db: {
    purchase_price?: number | null;
    min_sale_price?: number | null;
    estimated_value?: number | null;
    morador_purchase_price?: number | null;
  } | null | undefined,
  _configItem?: unknown,
  memberTier: string | null = null,
  itemSurcharges?: Map<string, ItemTierSurcharge | number> | null,
): ResolvedPrices {
  const purchase_price = money(db?.purchase_price);
  const min_sale_price = money(db?.min_sale_price);
  const estimated_value = money(db?.estimated_value);
  const morador_purchase_price = money(db?.morador_purchase_price);
  const override = findOverride(memberTier, itemSurcharges);
  const tier_price_without_material = resolveTierOverride(purchase_price, override, "without");
  const resolvedWithMaterial = resolveTierOverride(min_sale_price, override, "with");
  const tier_price_with_material = resolvedWithMaterial ?? tier_price_without_material;
  const tier_price = tier_price_with_material;
  return { purchase_price, min_sale_price, estimated_value, morador_purchase_price, tier_price, tier_price_with_material, tier_price_without_material };
}
