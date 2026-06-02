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

function money(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveTierOverride(base: number | null, override?: ItemTierSurcharge | number | null, mode: "with" | "without" = "with"): number | null {
  if (base == null) return null;
  if (override == null) return base;
  if (typeof override === "number") {
    const final = base + override;
    return Number.isFinite(final) && final > 0 ? final : null;
  }
  const explicit = mode === "with" ? money(override.price_with_material) : money(override.price_without_material);
  if (explicit != null) return explicit;
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
  // Gestão de Materiais / tabela items é a fonte de verdade.
  // Config legacy nunca deve inventar preço, custo ou receita visível ao utilizador.
  const purchase_price = money(db?.purchase_price);
  const min_sale_price = money(db?.min_sale_price);
  const estimated_value = money(db?.estimated_value);
  const morador_purchase_price = money(db?.morador_purchase_price);

  const override = memberTier && itemSurcharges?.has(memberTier) ? itemSurcharges.get(memberTier) : null;
  const tier_price_with_material = resolveTierOverride(min_sale_price, override, "with");
  const tier_price_without_material = resolveTierOverride(purchase_price, override, "without");
  const tier_price = tier_price_with_material;

  return {
    purchase_price,
    min_sale_price,
    estimated_value,
    morador_purchase_price,
    tier_price,
    tier_price_with_material,
    tier_price_without_material,
  };
}
