/**
 * Pricing Catalog — Fonte de verdade única para custos e preços.
 * Usado por dashboard, receitas, encomendas, preçário e bot.
 *
 * Regras de negócio:
 *  - Coletes / Acessórios / Prints → custo = venda (lucro 0)
 *  - Armas orange → custo de fabrico definido abaixo
 *  - Armas red → custo de compra (importadas)
 *  - Carregadores → custo fixo por tier (chefia/oficiais)
 *  - Corpos → preços internos da chefia
 *  - Compact Rifle → custo 60k + 20 peças
 *  - Ingredientes (peças, pólvora, cobre, aço) → custo 0 (obtidos em saídas)
 *
 * Preços de venda por tier bairrista:
 *  - Young Blood: base + 30.000€
 *  - O Gunao: base + 20.000€
 *  - Gangster Fodido: base + 10.000€
 *  - Oficiais / Chefia: preço base (sem acrescimo)
 */

export const INGREDIENT_CHEFIA_PRICES: Record<string, number> = {
  "Corpo Mini SMG": 8000,
  "Corpo Pistol XM3": 8000,
  "Corpo UZI": 10000,
  "Corpo TEC-9": 10000,
  "Corpo TEC Pistol": 15000,
  "Corpo AP Pistol": 15000,
};

// Custo de fabrico / compra por item (usado no dashboard e receitas)
export const REAL_UNIT_COST: Record<string, number> = {
  // ── Coletes (lucro 0) ──
  "Colete Padrão": 1500,

  // ── Armas orange (custo fabrico) ──
  "Mini SMG": 20000,
  "Pistol XM3": 20000,
  "Micro SMG": 22000,
  "TEC-9": 22000,
  "TEC Pistol": 27000,
  "AP Pistol": 27000,

  // ── Armas red (custo compra fora) ──
  "Heavy Pistol": 30000,
  ".50 Pistol": 50000,
  "P90": 60000,
  "Combat PDW": 60000,
  "Bullpup Rifle": 85000,
  "Carabina Especial": 100000,

  // ── Compact Rifle (custo compra + peças) ──
  "Compact Rifle": 60000, // 60k + 20 peças (peças = 0)

  // ── Carregadores (custo fixo por tier — chefia/oficiais) ──
  "Carregador Orange": 330,
  "Carregador Red": 660,
  "Carregador Special": 990,

  // ── Corpos (preços internos chefia) ──
  "Corpo Mini SMG": 8000,
  "Corpo Pistol XM3": 8000,
  "Corpo UZI": 10000,
  "Corpo TEC-9": 10000,
  "Corpo TEC Pistol": 15000,
  "Corpo AP Pistol": 15000,

  // ── Prints (sem lucro, custo = venda) ──
  "Print Laranja": 10000,
  "Print Azul": 50000,
  "Print Vermelha": 70000,
  "Print Amarela": 100000,
};

// Acréscimo de preço por tier bairrista (apenas armas de fogo)
export const TIER_WEAPON_SURCHARGE: Record<string, number> = {
  young_blood: 30000,
  o_gunao: 20000,
  gangster_fodido: 10000,
};

// Preços de carregadores por tier bairrista
// Orange: N1=600, N2=500, N3=400 | Red: N1=800, N2=700, N3=600 | Special: N1=1000, N2=900, N3=800
export const TIER_MAGAZINE_PRICES: Record<string, Record<string, number>> = {
  orange: {
    young_blood: 600,
    o_gunao: 500,
    gangster_fodido: 400,
  },
  red: {
    young_blood: 800,
    o_gunao: 700,
    gangster_fodido: 600,
  },
  special: {
    young_blood: 1000,
    o_gunao: 900,
    gangster_fodido: 800,
  },
};

/**
 * Devolve o custo real de 1 unidade do item.
 * Se não estiver no catálogo, usa purchase_price da DB (ou 0).
 */
export function getRealUnitCost(itemName: string, dbPurchasePrice?: number | null): number {
  const fixed = REAL_UNIT_COST[itemName];
  if (fixed != null) return fixed;
  return dbPurchasePrice ?? 0;
}

/**
 * Verifica se o item tem lucro 0 (custo = venda).
 */
export function isZeroMargin(itemName: string): boolean {
  return (
    itemName === "Colete Padrão" ||
    itemName.startsWith("Print ") ||
    itemName.startsWith("Corpo ")
  );
}

/**
 * Devolve o preço de venda de uma arma consoante o tier do membro.
 * Apenas aplica acréscimo a armas de fogo (orange + red + compact).
 */
export function getWeaponSalePrice(basePrice: number, memberTier: string | null): number {
  if (!memberTier) return basePrice;
  const surcharge = TIER_WEAPON_SURCHARGE[memberTier] ?? 0;
  return basePrice + surcharge;
}

/**
 * Devolve o preço de venda de um carregador consoante o tier do membro.
 */
export function getMagazineSalePrice(magTier: "orange" | "red" | "special", memberTier: string | null): number {
  if (!memberTier) {
    // Oficial / chefia → preço base (custo real)
    const base = { orange: 330, red: 660, special: 990 };
    return base[magTier];
  }
  return TIER_MAGAZINE_PRICES[magTier]?.[memberTier] ?? TIER_MAGAZINE_PRICES[magTier]?.gangster_fodido ?? 0;
}

/**
 * Devolve o preço de venda de um item consoante o tier do membro.
 * Funciona para armas e carregadores.
 */
export function getTierPrice(itemName: string, basePrice: number, tier: string | null): number {
  const n = itemName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Corpos e prints mantêm sempre o preço base (sem acréscimo por tier)
  if (/\bcorpo\b|\bprint\b/.test(n)) {
    return basePrice;
  }
  if (n.includes("carregador")) {
    const magTier = n.includes("special") ? "special" : n.includes("red") ? "red" : "orange";
    return getMagazineSalePrice(magTier, tier);
  }
  if (/mini smg|xm3|micro smg|tec-9|tec pistol|ap pistol|heavy|\.50|p90|pdw|bullpup|carabina|compact rifle/i.test(itemName)) {
    return getWeaponSalePrice(basePrice, tier);
  }
  return basePrice;
}
