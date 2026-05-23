import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";

// Map item names to their new morador prices
const PRICE_UPDATES: Record<string, number> = {
  // ARMAS ORANGE
  "Micro SMG": 50000,         // Mini SMG: 20K + 30K
  "Machine Pistol": 55000,    // XM3: 20K + 35K
  "TEC Pistol": 77000,        // TEC Pistol: 27K + 50K (TEC 9 doesn't exist as weapon)
  "AP Pistol": 82000,         // AP Pistol: 27K + 55K
  // ARMAS RED
  "Heavy Pistol": 30000,      // Heavy Pistol: MATERIAL + 30K
  ".50": 50000,               // .50: MATERIAL + 50K
  "P90": 60000,               // P90: MATERIAL + 60K
  "PDW": 60000,               // PDW: MATERIAL + 60K
  "Bullpup Rifle MK2": 85000, // Bullpup: MATERIAL + 85K
  "Carabina Rifle MK2": 100000, // Carabina: MATERIAL + 100K

  // PRINTS
  "Print Laranja": 10000,
  "Print Azul": 50000,
  "Print Vermelha": 70000,
  "Print Dourada": 100000,

  // CORPOS
  "Corpo Mini SMG": 10000,
};

// Carregador prices by pattern
const CARREGADOR_UPDATES: { pattern: string; price: number }[] = [
  { pattern: "TecPistol", price: 600 },
  { pattern: "TEC-9", price: 600 },
  { pattern: "HeavyPistol", price: 600 },
  { pattern: "PDW", price: 600 },
  { pattern: "Tactical", price: 1000 },
  { pattern: "AssaultSMG", price: 800 },
  { pattern: "AssaultRifle", price: 800 },
  { pattern: "Pistol50", price: 800 },
  { pattern: "BattleRifle", price: 800 },
  { pattern: "MilitaryRifle", price: 800 },
];

import { resolveCurrentMember } from "./pricing.server";

export const updateMoradorPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    const results: { name: string; oldPrice: number | null; newPrice: number }[] = [];

    // Update weapons/prints/corpos by exact name
    for (const [name, newPrice] of Object.entries(PRICE_UPDATES)) {
      const rows = await pgQuery<{ id: number; name: string; min_sale_price: number | null }>(
        `UPDATE items SET min_sale_price = $1 WHERE name = $2 RETURNING id, name, min_sale_price`,
        [newPrice, name],
      );
      if (rows.length > 0) {
        results.push({ name, oldPrice: rows[0].min_sale_price, newPrice });
      }
    }

    // Update carregadores by pattern
    for (const { pattern, price } of CARREGADOR_UPDATES) {
      const rows = await pgQuery<{ id: number; name: string; min_sale_price: number | null }>(
        `UPDATE items SET min_sale_price = $1 WHERE name ILIKE $2 RETURNING id, name, min_sale_price`,
        [price, `%${pattern}%`],
      );
      for (const r of rows) {
        results.push({ name: r.name, oldPrice: r.min_sale_price, newPrice: price });
      }
    }

    return { updated: results.length, items: results };
  });
