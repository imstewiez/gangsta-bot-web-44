// ── Preços de morador (venda) ───────────────────────────────────────────────
// Aplicados globalmente: encomendas, preçário, receitas.
// Morador = role === 'bairrista'
// Apenas chefia (is_manager) vê margens/custos.

export type MoradorTier = 1 | 2 | 3;

function normName(n: string): string {
  return n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

// ── Carregadores ─────────────────────────────────────────────────────────────
const CARREGADOR_PRICES: Record<string, Record<number, number>> = {
  orange: { 1: 600, 2: 500, 3: 400 },
  red:    { 1: 800, 2: 700, 3: 600 },
  special:{ 1: 1000, 2: 900, 3: 800 },
};

function carregadorType(name: string): "orange" | "red" | "special" | null {
  const n = normName(name);
  if (n.includes("especial") || n.includes("special") || n.includes("tactical")) return "special";
  if (n.includes("orange")) return "orange";
  if (n.includes("red")) return "red";
  // Fallback by name patterns (real DB names)
  if (/tec9|tecpistol|heavypistol|pistol50|pdw|tactical/.test(n)) return "orange";
  if (/assaultsmg|assaultrifle|battlerifle|militaryrifle/.test(n)) return "red";
  if (n.includes("carregador")) return "red";
  return null;
}

// ── Armas Orange ─────────────────────────────────────────────────────────────
// DB names + prices.  T1+30K / T2+20K / T3+10K markup over base material cost.
// The base numbers in parens are the material-cost baseline.
const ARMA_ORANGE: Record<string, { base: number }> = {
  "microsmg":      { base: 20000 },  // Mini SMG in user's terms
  "machinepistol": { base: 20000 },  // XM3 in user's terms
  "tec9":          { base: 22000 },  // not in DB as weapon, but kept for mapping
  "tecpistol":     { base: 27000 },  // TEC Pistol
  "appistol":      { base: 27000 },  // AP Pistol
};

const ARMA_ORANGE_MARKUP: Record<number, number> = { 1: 30000, 2: 20000, 3: 10000 };

function armaOrangePrice(name: string, tier: MoradorTier): number | null {
  const n = normName(name);
  for (const [key, { base }] of Object.entries(ARMA_ORANGE)) {
    if (n.includes(key)) return base + ARMA_ORANGE_MARKUP[tier];
  }
  // Additional DB-name fallbacks
  if (n.includes("microsmg") || (n.includes("mini") && n.includes("smg"))) return ARMA_ORANGE.microsmg.base + ARMA_ORANGE_MARKUP[tier];
  if (n.includes("machinepistol") || n.includes("xm3")) return ARMA_ORANGE.machinepistol.base + ARMA_ORANGE_MARKUP[tier];
  if (n.includes("tec9") || (n.includes("tec") && !n.includes("pistol"))) return ARMA_ORANGE.tec9.base + ARMA_ORANGE_MARKUP[tier];
  if (n.includes("tecpistol") || (n.includes("tec") && n.includes("pistol"))) return ARMA_ORANGE.tecpistol.base + ARMA_ORANGE_MARKUP[tier];
  if (n.includes("appistol") || (n.includes("ap") && n.includes("pistol"))) return ARMA_ORANGE.appistol.base + ARMA_ORANGE_MARKUP[tier];
  return null;
}

// ── Armas Red ────────────────────────────────────────────────────────────────
// DB names + fixed prices (MATERIAL + value)
const ARMA_RED: Record<string, number> = {
  "heavypistol": 30000,
  "pistol50":    50000,  // .50
  "p90":         60000,
  "pdw":         60000,
  "bullpupriflemk2": 85000,
  "carabinamk2": 100000, // Carabina Rifle MK2
};

function armaRedPrice(name: string): number | null {
  const n = normName(name);
  for (const [key, price] of Object.entries(ARMA_RED)) {
    if (n.includes(key)) return price;
  }
  if (n.includes("heavypistol") || (n.includes("heavy") && n.includes("pistol"))) return 30000;
  if (n.includes("pistol50") || n.includes("50") || n.includes("ponto50")) return 50000;
  if (n.includes("p90")) return 60000;
  if (n.includes("pdw") || n.includes("combatpdw")) return 60000;
  if (n.includes("bullpup") && n.includes("mk2")) return 85000;
  if (n.includes("carabina") && n.includes("mk2")) return 100000;
  return null;
}

// ── Prints ───────────────────────────────────────────────────────────────────
// DB names: Print Laranja, Print Azul, Print Vermelha, Print Dourada
const PRINT_PRICE: Record<string, number> = {
  laranja:  10000,   // Orange
  azul:     50000,   // Blue
  vermelha: 70000,   // Red
  dourada:  100000,  // Yellow/Gold
  amarela:  100000,  // fallback
};

function printPrice(name: string): number | null {
  const n = normName(name);
  if (!n.includes("print")) return null;
  for (const [color, price] of Object.entries(PRINT_PRICE)) {
    if (n.includes(color)) return price;
  }
  return null;
}

// ── Corpos ───────────────────────────────────────────────────────────────────
// DB names
const CORPO_PRICE: Record<string, { sucata: number; dinheiro: number }> = {
  "minismg":      { sucata: 10, dinheiro: 10000 },
  "xm3":          { sucata: 10, dinheiro: 10000 },
  "microsmg":     { sucata: 15, dinheiro: 15000 },
  "tec9":         { sucata: 15, dinheiro: 15000 },
  "tecpistol":    { sucata: 20, dinheiro: 20000 },
  "appistol":     { sucata: 20, dinheiro: 20000 },
};

function corpoPrice(name: string): { sucata: number; dinheiro: number } | null {
  const n = normName(name);
  if (!n.includes("corpo")) return null;
  for (const [key, price] of Object.entries(CORPO_PRICE)) {
    if (n.includes(key)) return price;
  }
  if (n.includes("minismg") || (n.includes("mini") && n.includes("smg"))) return CORPO_PRICE.minismg;
  if (n.includes("microsmg") || (n.includes("micro") && n.includes("smg"))) return CORPO_PRICE.microsmg;
  if (n.includes("xm3")) return CORPO_PRICE.xm3;
  if (n.includes("tec9") || (n.includes("tec") && !n.includes("pistol"))) return CORPO_PRICE.tec9;
  if (n.includes("tecpistol") || (n.includes("tec") && n.includes("pistol"))) return CORPO_PRICE.tecpistol;
  if (n.includes("appistol") || (n.includes("ap") && n.includes("pistol"))) return CORPO_PRICE.appistol;
  return null;
}

// ── Função pública ───────────────────────────────────────────────────────────
export function getMoradorPrice(
  itemName: string,
  tier: MoradorTier | null,
): { price: number; materialsNote?: string } | null {
  const t = tier ?? 3;
  const n = normName(itemName);

  // Carregadores
  const cat = carregadorType(itemName);
  if (cat && CARREGADOR_PRICES[cat]) {
    return { price: CARREGADOR_PRICES[cat][t], materialsNote: "2x MATERIAL" };
  }

  // Armas Orange
  const orangePrice = armaOrangePrice(itemName, t);
  if (orangePrice !== null) {
    return { price: orangePrice, materialsNote: "MATERIAL" };
  }

  // Armas Red
  const redPrice = armaRedPrice(itemName);
  if (redPrice !== null) {
    return { price: redPrice, materialsNote: "MATERIAL" };
  }

  // Prints
  const pPrice = printPrice(itemName);
  if (pPrice !== null) {
    return { price: pPrice };
  }

  // Corpos
  const cPrice = corpoPrice(itemName);
  if (cPrice !== null) {
    return { price: cPrice.dinheiro, materialsNote: `MOLDE + ${cPrice.sucata} SUCATA` };
  }

  return null;
}

export function hasMoradorPrice(itemName: string): boolean {
  return getMoradorPrice(itemName, 1) !== null;
}
