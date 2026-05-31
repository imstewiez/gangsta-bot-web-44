export type ResolvedPrices = {
  purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  morador_purchase_price: number | null;
  tier_price: number | null;
};

function money(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
  itemSurcharges?: Map<string, number> | null,
): ResolvedPrices {
  // Gestão de Materiais / tabela items é a fonte de verdade.
  // Config legacy nunca deve inventar preço, custo ou receita visível ao utilizador.
  const purchase_price = money(db?.purchase_price);
  const min_sale_price = money(db?.min_sale_price);
  const estimated_value = money(db?.estimated_value);
  const morador_purchase_price = money(db?.morador_purchase_price);

  let tier_price = min_sale_price;
  if (memberTier && itemSurcharges?.has(memberTier) && min_sale_price != null) {
    tier_price = min_sale_price + (itemSurcharges.get(memberTier) ?? 0);
    if (!Number.isFinite(tier_price) || tier_price <= 0) tier_price = null;
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
  return [];
}

export function getConfigItemByName(_name: string) {
  return null;
}

export function getConfigIdByName(_name: string): string | null {
  return null;
}
