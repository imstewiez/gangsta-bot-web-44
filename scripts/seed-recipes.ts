#!/usr/bin/env tsx
/**
 * Seed script for craft recipes.
 * Reads from config.json and upserts into craft_recipes + recipe_ingredients.
 * Run with: npx tsx scripts/seed-recipes.ts
 */

import { createClient } from "@supabase/supabase-js";
import config from "../config.json";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log(`Seeding ${Object.keys(config.recipes).length} recipes from config.json...`);

  // Build name -> item_id map from DB
  const { data: dbItems, error: itemsErr } = await supabase
    .from("items")
    .select("id, name");
  if (itemsErr || !dbItems) {
    console.error("Failed to load items:", itemsErr?.message);
    process.exit(1);
  }
  const itemNameToId = new Map(dbItems.map((i) => [i.name, i.id]));

  let created = 0;
  let updated = 0;

  for (const [, recipe] of Object.entries(config.recipes)) {
    const outputName = config.items[recipe.output]?.name;
    if (!outputName) {
      console.warn(`Output item ${recipe.output} not found in config.items, skipping.`);
      continue;
    }
    const outputItemId = itemNameToId.get(outputName);
    if (!outputItemId) {
      console.warn(`DB item not found for "${outputName}". Run seed-items.ts first.`);
      continue;
    }

    // Upsert craft_recipe
    const { data: existingRecipe } = await supabase
      .from("craft_recipes")
      .select("id")
      .eq("item_id", outputItemId)
      .maybeSingle();

    let recipeId: number;
    if (existingRecipe) {
      const { error } = await supabase
        .from("craft_recipes")
        .update({
          category: config.items[recipe.output]?.type === "weapon" ? "craft_weapons" : "craft_carregadores",
          tier: config.items[recipe.output]?.tier,
        })
        .eq("id", existingRecipe.id);
      if (error) {
        console.error(`Failed to update recipe for ${outputName}:`, error.message);
        continue;
      }
      recipeId = existingRecipe.id;
      updated++;
    } else {
      const { data: newRecipe, error } = await supabase
        .from("craft_recipes")
        .insert({
          item_id: outputItemId,
          category: config.items[recipe.output]?.type === "weapon" ? "craft_weapons" : "craft_carregadores",
          tier: config.items[recipe.output]?.tier,
        })
        .select("id")
        .single();
      if (error || !newRecipe) {
        console.error(`Failed to insert recipe for ${outputName}:`, error?.message);
        continue;
      }
      recipeId = newRecipe.id;
      created++;
    }

    // Clear old ingredients and re-insert
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);

    const ingredientRows = [];
    for (const [ingId, qty] of Object.entries(recipe.inputs)) {
      const ingName = config.items[ingId]?.name;
      if (!ingName) continue;
      const ingItemId = itemNameToId.get(ingName);
      if (!ingItemId) {
        console.warn(`DB item not found for ingredient "${ingName}"`);
        continue;
      }
      ingredientRows.push({
        recipe_id: recipeId,
        ingredient_item_id: ingItemId,
        quantity: qty,
      });
    }

    if (ingredientRows.length > 0) {
      const { error } = await supabase.from("recipe_ingredients").insert(ingredientRows);
      if (error) {
        console.error(`Failed to insert ingredients for ${outputName}:`, error.message);
      }
    }
  }

  console.log(`Done: ${created} recipes created, ${updated} recipes updated.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
