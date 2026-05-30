import { getAllItems } from "./config.loader";

export type ResolvedPrices = {
  purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  morador_purchase_price: number | null;
  tier_price: number | null;
};

function priceOr(dbVal: number | null, configVal: number | null): number | null {
  if (dbVal != null && Number.isFinite(dbVal) && dbVal > 0) return dbVal;
  if (configVal != null && Number.isFinite(configVal) && configVal > 0) return configVal;
  return null;
}

export function resolveItemPrices(
  db: {
    purchase_price?: number | null;
    min_sale_price?: number | null;
    estimated_value?: number | null;
    morador_purchase_price?: number | null;
  } | null | undefined,
  configItem: { buyPrice?: number | null; sellPrice?: number | null; estimatedValue?: number | null } | null | undefined,
  memberTier: string | null = null,
  itemSurcharges?: Map<string, number> | null,
): ResolvedPrices {
  const purchase_price = priceOr(db?.purchase_price ?? null, configItem?.buyPrice ?? null);
  const min_sale_price = priceOr(db?.min_sale_price ?? null, configItem?.sellPrice ?? null);
  const estimated_value = priceOr(db?.estimated_value ?? null, configItem?.estimatedValue ?? null);
  const morador_purchase_price = priceOr(db?.morador_purchase_price ?? null, null);

  // Novo: tier_price = min_sale_price + surcharge do item+tier na DB
  let tier_price = min_sale_price;
  if (memberTier && itemSurcharges && itemSurcharges.has(memberTier)) {
    const surcharge = itemSurcharges.get(memberTier) ?? 0;
    tier_price = (min_sale_price ?? 0) + surcharge;
    if (tier_price === 0) tier_price = null;
  }

  return {
    purchase_price,
    min_sale_price,
    estimated_value,
    morador_purchase_price,
    tier_price,
  };
}

export function getAllConfigNames(): string[] {
  return Object.values(getAllItems()).map((i) => i.name);
}

export function getConfigItemByName(name: string) {
  const items = getAllItems();
  return Object.entries(items).find(([, v]) => v.name === name)?.[1] ?? null;
}

export function getConfigIdByName(name: string): string | null {
  const items = getAllItems();
  return Object.entries(items).find(([, v]) => v.name === name)?.[0] ?? null;
}
