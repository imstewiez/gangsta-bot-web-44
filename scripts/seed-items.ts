#!/usr/bin/env tsx
/**
 * Canonical seed script for all game items.
 * This is the single source of truth for item definitions.
 * Run with: npx tsx scripts/seed-items.ts
 *
 * It upserts items into the database so it is safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";

// Load from env
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeedItem = {
  name: string;
  category: string;
  subcategory: string | null;
  side: "venda" | "compra" | null;
  purchase_price: number | null;
  morador_purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  xp_points: number;
  active: boolean;
};

// =============================================================
// CANONICAL ITEM DEFINITIONS
// Add new items here. Do NOT add items directly in the DB UI.
// =============================================================
const ITEMS: SeedItem[] = [
  // Armas Orange
  { name: "Mini SMG", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 2500, morador_purchase_price: 2000, min_sale_price: 3000, estimated_value: 2500, xp_points: 5, active: true },
  { name: "XM3", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 3000, morador_purchase_price: 2400, min_sale_price: 3600, estimated_value: 3000, xp_points: 5, active: true },
  { name: "Micro SMG", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 2800, morador_purchase_price: 2200, min_sale_price: 3300, estimated_value: 2800, xp_points: 5, active: true },
  { name: "Tec-9", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 2200, morador_purchase_price: 1800, min_sale_price: 2600, estimated_value: 2200, xp_points: 5, active: true },
  { name: "Tec Pistol", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 2000, morador_purchase_price: 1600, min_sale_price: 2400, estimated_value: 2000, xp_points: 5, active: true },
  { name: "AP Pistol", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 3500, morador_purchase_price: 2800, min_sale_price: 4200, estimated_value: 3500, xp_points: 5, active: true },
  { name: "Heavy Pistol", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 3200, morador_purchase_price: 2600, min_sale_price: 3800, estimated_value: 3200, xp_points: 5, active: true },
  { name: ".50 Pistol", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 4000, morador_purchase_price: 3200, min_sale_price: 4800, estimated_value: 4000, xp_points: 5, active: true },
  { name: "P90", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 4500, morador_purchase_price: 3600, min_sale_price: 5400, estimated_value: 4500, xp_points: 5, active: true },
  { name: "PDW", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 4200, morador_purchase_price: 3400, min_sale_price: 5000, estimated_value: 4200, xp_points: 5, active: true },
  { name: "Bullpup", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 5000, morador_purchase_price: 4000, min_sale_price: 6000, estimated_value: 5000, xp_points: 5, active: true },
  { name: "Carabina", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 4800, morador_purchase_price: 3800, min_sale_price: 5700, estimated_value: 4800, xp_points: 5, active: true },
  { name: "Compact Rifle", category: "armas_orange", subcategory: "armas_orange", side: "venda", purchase_price: 5500, morador_purchase_price: 4400, min_sale_price: 6600, estimated_value: 5500, xp_points: 5, active: true },

  // Armas Red
  { name: "Pistol", category: "armas_red", subcategory: "armas_red", side: "venda", purchase_price: 800, morador_purchase_price: 600, min_sale_price: 1000, estimated_value: 800, xp_points: 3, active: true },
  { name: "Combat Pistol", category: "armas_red", subcategory: "armas_red", side: "venda", purchase_price: 1000, morador_purchase_price: 800, min_sale_price: 1200, estimated_value: 1000, xp_points: 3, active: true },
  { name: "SNS Pistol", category: "armas_red", subcategory: "armas_red", side: "venda", purchase_price: 600, morador_purchase_price: 500, min_sale_price: 800, estimated_value: 600, xp_points: 3, active: true },

  // Carregadores
  { name: "Carregador Orange", category: "municoes", subcategory: "carregadores", side: "venda", purchase_price: 150, morador_purchase_price: 120, min_sale_price: 200, estimated_value: 150, xp_points: 1, active: true },
  { name: "Carregador Red", category: "municoes", subcategory: "carregadores", side: "venda", purchase_price: 100, morador_purchase_price: 80, min_sale_price: 150, estimated_value: 100, xp_points: 1, active: true },
  { name: "Carregador Special", category: "municoes", subcategory: "carregadores", side: "venda", purchase_price: 300, morador_purchase_price: 250, min_sale_price: 400, estimated_value: 300, xp_points: 1, active: true },

  // Corpos
  { name: "Corpo Orange", category: "outros", subcategory: "corpos", side: "venda", purchase_price: 500, morador_purchase_price: 400, min_sale_price: 600, estimated_value: 500, xp_points: 2, active: true },
  { name: "Corpo Red", category: "outros", subcategory: "corpos", side: "venda", purchase_price: 300, morador_purchase_price: 250, min_sale_price: 400, estimated_value: 300, xp_points: 2, active: true },

  // Prints
  { name: "Print Orange", category: "outros", subcategory: "prints", side: "venda", purchase_price: 200, morador_purchase_price: 150, min_sale_price: 250, estimated_value: 200, xp_points: 1, active: true },
  { name: "Print Red", category: "outros", subcategory: "prints", side: "venda", purchase_price: 100, morador_purchase_price: 80, min_sale_price: 150, estimated_value: 100, xp_points: 1, active: true },

  // Coletes
  { name: "Colete Leve", category: "acessorios", subcategory: "coletes", side: "venda", purchase_price: 400, morador_purchase_price: 300, min_sale_price: 500, estimated_value: 400, xp_points: 2, active: true },
  { name: "Colete Médio", category: "acessorios", subcategory: "coletes", side: "venda", purchase_price: 600, morador_purchase_price: 500, min_sale_price: 750, estimated_value: 600, xp_points: 2, active: true },
  { name: "Colete Pesado", category: "acessorios", subcategory: "coletes", side: "venda", purchase_price: 800, morador_purchase_price: 650, min_sale_price: 1000, estimated_value: 800, xp_points: 2, active: true },

  // Acessórios
  { name: "Silenciador", category: "acessorios", subcategory: "acessorios", side: "venda", purchase_price: 350, morador_purchase_price: 280, min_sale_price: 450, estimated_value: 350, xp_points: 1, active: true },
  { name: "Lanterna Tática", category: "acessorios", subcategory: "acessorios", side: "venda", purchase_price: 200, morador_purchase_price: 160, min_sale_price: 250, estimated_value: 200, xp_points: 1, active: true },
  { name: "Mira", category: "acessorios", subcategory: "acessorios", side: "venda", purchase_price: 300, morador_purchase_price: 240, min_sale_price: 380, estimated_value: 300, xp_points: 1, active: true },

  // Materiais / Compra
  { name: "Peças de Arma", category: "materiais", subcategory: null, side: "compra", purchase_price: 50, morador_purchase_price: 40, min_sale_price: null, estimated_value: 50, xp_points: 1, active: true },
  { name: "Aço", category: "materiais", subcategory: null, side: "compra", purchase_price: 30, morador_purchase_price: 25, min_sale_price: null, estimated_value: 30, xp_points: 1, active: true },
  { name: "Plástico", category: "materiais", subcategory: null, side: "compra", purchase_price: 15, morador_purchase_price: 12, min_sale_price: null, estimated_value: 15, xp_points: 1, active: true },
  { name: "Polvora", category: "materiais", subcategory: null, side: "compra", purchase_price: 20, morador_purchase_price: 16, min_sale_price: null, estimated_value: 20, xp_points: 1, active: true },
];

async function seed() {
  console.log(`Seeding ${ITEMS.length} items...`);
  let inserted = 0;
  let updated = 0;

  for (const item of ITEMS) {
    const { data: existing } = await supabase
      .from("items")
      .select("id")
      .eq("name", item.name)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("items")
        .update({
          category: item.category,
          subcategory: item.subcategory,
          side: item.side,
          purchase_price: item.purchase_price,
          morador_purchase_price: item.morador_purchase_price,
          min_sale_price: item.min_sale_price,
          estimated_value: item.estimated_value,
          xp_points: item.xp_points,
          active: item.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        console.error(`Failed to update ${item.name}:`, error.message);
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("items").insert({
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        side: item.side,
        purchase_price: item.purchase_price,
        morador_purchase_price: item.morador_purchase_price,
        min_sale_price: item.min_sale_price,
        estimated_value: item.estimated_value,
        xp_points: item.xp_points,
        active: item.active,
      });

      if (error) {
        console.error(`Failed to insert ${item.name}:`, error.message);
      } else {
        inserted++;
      }
    }
  }

  console.log(`Done: ${inserted} inserted, ${updated} updated.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
