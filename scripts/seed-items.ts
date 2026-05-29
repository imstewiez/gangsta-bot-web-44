#!/usr/bin/env tsx
/**
 * Canonical seed script for all game items.
 * Reads from config.json (single source of truth) and upserts into the DB.
 * Run with: npx tsx scripts/seed-items.ts
 *
 * It upserts items into the database so it is safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";
import config from "../config.json";

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
// CANONICAL ITEM DEFINITIONS — sourced from config.json
// =============================================================
function mapConfigToSeed(): SeedItem[] {
  const items: SeedItem[] = [];
  for (const [, item] of Object.entries(config.items)) {
    items.push({
      name: item.name,
      category: item.category ?? "outros",
      subcategory: item.subcategory ?? null,
      side: item.side as "venda" | "compra" | null,
      purchase_price: item.buyPrice ?? null,
      morador_purchase_price: null,
      min_sale_price: item.sellPrice ?? null,
      estimated_value: item.estimatedValue ?? item.buyPrice ?? null,
      xp_points: item.xpPoints ?? 1,
      active: true,
    });
  }
  return items;
}

const ITEMS = mapConfigToSeed();

async function seed() {
  console.log(`Seeding ${ITEMS.length} items from config.json...`);
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
