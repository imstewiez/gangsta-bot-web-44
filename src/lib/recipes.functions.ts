import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { logger } from "./logger.server";
import { pgQuery } from "./pg.server";
import { getAllItems } from "./config.loader";
import { resolveItemPrices } from "./pricing.resolver";
import { getSurchargesForItems } from "./tier-pricing.functions";

export type RecipeRow = {
  recipe_id: number;
  item_id: number;
  item_name: string;
  category: string | null;
  subcategory: string | null;
  tier: string | null;
  unit: string | null;
  ingredients: Array<{
    item_id: number;
    name: string;
    quantity: number;
    unit_cost: number;
    line_cost: number;
    category: string | null;
    subcategory: string | null;
  }>;
  total_cost: number;
  estimated_value: number;
  min_sale_price: number | null;
  tier_price: number | null;
  margin: number;
  margin_pct: number | null;
  recipe_category: string | null;
  db_recipe_id: number | null;
};

type DbPriceRow = {
  id: number;
  name: string;
  category: string | null;
  subcategory: string | null;
  side: string | null;
  purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  morador_purchase_price: number | null;
};

type MergedRecipe = {
  output_item_id: number;
  output_name: string;
  inputs: Array<{ item_id: number; name: string; quantity: number; category: string | null; subcategory: string | null }>;
};

async function getDbItemsByIds(ids: number[]): Promise<Map<number, DbPriceRow>> {
  const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0)));
  if (unique.length === 0) return new Map();
  const rows = await pgQuery<DbPriceRow>(
    `select id, name, category, subcategory, side,
            purchase_price::float as purchase_price,
            min_sale_price::float as min_sale_price,
            estimated_value::float as estimated_value,
            morador_purchase_price::float as morador_purchase_price
     from items
     where id = any($1::int[])
       and coalesce(active, true) = true
       and deleted_at is null`,
    [unique],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function getDbRecipesForItemIds(itemIds: number[]): Promise<Map<number, MergedRecipe>> {
  const unique = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (unique.length === 0) return new Map();
  const rows = await pgQuery<{
    output_item_id: number;
    output_name: string;
    ingredient_item_id: number | null;
    ingredient_name: string | null;
    quantity: number | null;
    ingredient_category: string | null;
    ingredient_subcategory: string | null;
  }>(
    `select cr.item_id as output_item_id,
            out_i.name as output_name,
            ri.ingredient_item_id,
            ing_i.name as ingredient_name,
            ri.quantity::float as quantity,
            ing_i.category as ingredient_category,
            ing_i.subcategory as ingredient_subcategory
     from craft_recipes cr
     join items out_i on out_i.id = cr.item_id
     left join recipe_ingredients ri on ri.recipe_id = cr.id
     left join items ing_i on ing_i.id = ri.ingredient_item_id
     where cr.item_id = any($1::int[])
       and coalesce(out_i.active, true) = true
       and out_i.deleted_at is null
     order by out_i.name, ing_i.name`,
    [unique],
  );

  const map = new Map<number, MergedRecipe>();
  for (const row of rows) {
    if (!map.has(row.output_item_id)) {
      map.set(row.output_item_id, { output_item_id: row.output_item_id, output_name: row.output_name, inputs: [] });
    }
    if (!row.ingredient_item_id || !row.ingredient_name || !row.quantity || row.quantity <= 0) continue;
    map.get(row.output_item_id)!.inputs.push({
      item_id: row.ingredient_item_id,
      name: row.ingredient_name,
      quantity: Number(row.quantity),
      category: row.ingredient_category,
      subcategory: row.ingredient_subcategory,
    });
  }

  for (const [itemId, recipe] of Array.from(map.entries())) {
    if (recipe.inputs.length === 0) map.delete(itemId);
  }
  return map;
}

export async function getMergedRecipes(): Promise<Record<string, MergedRecipe>> {
  const rows = await pgQuery<{ item_id: number }>(
    `select distinct cr.item_id
     from craft_recipes cr
     join recipe_ingredients ri on ri.recipe_id = cr.id
     join items out_i on out_i.id = cr.item_id
     join items ing_i on ing_i.id = ri.ingredient_item_id
     where coalesce(out_i.active, true) = true
       and out_i.deleted_at is null
       and coalesce(ing_i.active, true) = true
       and ing_i.deleted_at is null
       and coalesce(ri.quantity, 0) > 0`,
  );
  const map = await getDbRecipesForItemIds(rows.map((r) => r.item_id));
  return Object.fromEntries(Array.from(map.entries()).map(([itemId, recipe]) => [String(itemId), recipe]));
}

export async function getMergedRecipeForItemName(itemName: string): Promise<MergedRecipe | null> {
  const row = await pgQuery<{ id: number }>(
    `select id from items where name = $1 and coalesce(active, true) = true and deleted_at is null limit 1`,
    [itemName],
  );
  const id = row[0]?.id;
  if (!id) return null;
  return (await getDbRecipesForItemIds([id])).get(id) ?? null;
}

export const listRecipes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecipeRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const isManager = me?.is_manager ?? false;
    const recipes = Object.values(await getMergedRecipes());
    const result: RecipeRow[] = [];
    const outputIds = recipes.map((r) => r.output_item_id);
    const ingredientIds = recipes.flatMap((r) => r.inputs.map((i) => i.item_id));
    const dbItems = await getDbItemsByIds([...outputIds, ...ingredientIds]);
    const surchargeMap = await getSurchargesForItems(outputIds);

    for (const recipe of recipes) {
      const output = dbItems.get(recipe.output_item_id);
      if (!output) continue;
      const outPrices = resolveItemPrices(output, null, me?.tier ?? null, surchargeMap.get(output.id) ?? null);
      const ingredients: RecipeRow["ingredients"] = [];
      let total_cost = 0;

      for (const input of recipe.inputs) {
        const ingDb = dbItems.get(input.item_id);
        if (!ingDb) continue;
        const ingPrices = resolveItemPrices(ingDb, null);
        const unit_cost = ingPrices.morador_purchase_price ?? ingPrices.purchase_price ?? ingPrices.estimated_value ?? 0;
        const line_cost = input.quantity * unit_cost;
        ingredients.push({
          item_id: input.item_id,
          name: input.name,
          quantity: input.quantity,
          unit_cost,
          line_cost,
          category: input.category,
          subcategory: input.subcategory,
        });
        total_cost += line_cost;
      }

      const salePrice = outPrices.tier_price ?? outPrices.min_sale_price ?? outPrices.purchase_price ?? 0;
      const margin = salePrice - total_cost;
      result.push({
        recipe_id: recipe.output_item_id,
        item_id: recipe.output_item_id,
        item_name: recipe.output_name,
        category: output.category,
        subcategory: output.subcategory,
        tier: null,
        unit: "unidade",
        ingredients,
        total_cost,
        estimated_value: outPrices.estimated_value ?? 0,
        min_sale_price: outPrices.min_sale_price,
        tier_price: outPrices.tier_price,
        margin: isManager ? margin : 0,
        margin_pct: isManager && total_cost > 0 ? (margin / total_cost) * 100 : null,
        recipe_category: output.category,
        db_recipe_id: recipe.output_item_id,
      });
    }

    return result.sort((a, b) => (b.tier_price ?? b.min_sale_price ?? b.estimated_value ?? 0) - (a.tier_price ?? a.min_sale_price ?? a.estimated_value ?? 0));
  });

export type CraftFeasibility = {
  recipe_id: number;
  item_name: string;
  requested_qty: number;
  dirty_money: number;
  min_sale_price: number | null;
  tier_price: number | null;
  ingredients: Array<{
    name: string;
    needed: number;
    qty_per_recipe: number;
    unit_cost: number;
    line_cost: number;
  }>;
};

export const computeCraftFeasibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recipe_id: number; quantity: number }) => {
    if (!Number.isFinite(d.recipe_id)) throw new Error("recipe_id inválido");
    if (!Number.isFinite(d.quantity) || d.quantity <= 0) throw new Error("quantidade inválida");
    return d;
  })
  .handler(async ({ data, context }): Promise<CraftFeasibility> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const recipe = (await getDbRecipesForItemIds([data.recipe_id])).get(data.recipe_id);
    if (!recipe) throw new Error("Receita não encontrada na Gestão de Materiais");
    const dbItems = await getDbItemsByIds([data.recipe_id, ...recipe.inputs.map((i) => i.item_id)]);
    const output = dbItems.get(data.recipe_id);
    if (!output) throw new Error("Item da receita não encontrado");
    const surchargeMap = await getSurchargesForItems([output.id]);
    const headPrices = resolveItemPrices(output, null, me?.tier ?? null, surchargeMap.get(output.id) ?? null);
    const ingredients: CraftFeasibility["ingredients"] = [];

    for (const input of recipe.inputs) {
      const ingDb = dbItems.get(input.item_id);
      if (!ingDb) continue;
      const ingPrices = resolveItemPrices(ingDb, null);
      const needed = input.quantity * data.quantity;
      const unitCost = ingPrices.morador_purchase_price ?? ingPrices.purchase_price ?? ingPrices.estimated_value ?? 0;
      ingredients.push({
        name: input.name,
        needed,
        qty_per_recipe: input.quantity,
        unit_cost: unitCost,
        line_cost: needed * unitCost,
      });
    }

    return {
      recipe_id: data.recipe_id,
      item_name: recipe.output_name,
      requested_qty: data.quantity,
      dirty_money: (headPrices.estimated_value ?? 0) * data.quantity,
      min_sale_price: headPrices.min_sale_price,
      tier_price: headPrices.tier_price,
      ingredients,
    };
  });

export type CraftFeasibilityBatch = {
  dirty_money: number;
  full_material_cost: number;
  ingredients: Array<{
    name: string;
    needed: number;
    qty_per_recipe: number;
    unit_cost: number;
    line_cost: number;
  }>;
  items: Array<{ item_name: string; requested_qty: number }>;
};

export const computeCraftFeasibilityBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lines: Array<{ item_id: number; quantity: number }> }) => {
    if (!Array.isArray(d.lines) || d.lines.length === 0) throw new Error("Carrinho vazio");
    for (const l of d.lines) {
      if (!Number.isFinite(l.item_id) || l.item_id <= 0) throw new Error("item_id inválido");
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) throw new Error("quantidade inválida");
    }
    return d;
  })
  .handler(async ({ data }): Promise<CraftFeasibilityBatch> => {
    try {
      const dbItems = await getDbItemsByIds(data.lines.map((l) => l.item_id));
      const recipeMap = await getDbRecipesForItemIds(data.lines.map((l) => l.item_id));
      const ingredientIds = Array.from(new Set(Array.from(recipeMap.values()).flatMap((r) => r.inputs.map((i) => i.item_id))));
      const ingredientItems = await getDbItemsByIds(ingredientIds);
      const allIngredients = new Map<string, { name: string; needed: number; qty_per_recipe: number; unit_cost: number; line_cost: number }>();
      let dirty_money = 0;
      let full_material_cost = 0;
      const items: CraftFeasibilityBatch["items"] = [];

      for (const line of data.lines) {
        const item = dbItems.get(line.item_id);
        if (!item) continue;
        const recipe = recipeMap.get(line.item_id);
        if (!recipe) continue;
        items.push({ item_name: item.name, requested_qty: line.quantity });
        const itemPrices = resolveItemPrices(item, null);
        dirty_money += (itemPrices.estimated_value ?? 0) * line.quantity;

        for (const input of recipe.inputs) {
          const ingDb = ingredientItems.get(input.item_id);
          if (!ingDb) continue;
          const ingPrices = resolveItemPrices(ingDb, null);
          const needed = input.quantity * line.quantity;
          const unitCost = ingPrices.morador_purchase_price ?? ingPrices.purchase_price ?? ingPrices.estimated_value ?? 0;
          const lineCost = needed * unitCost;
          full_material_cost += lineCost;
          const existing = allIngredients.get(input.name);
          if (existing) {
            existing.needed += needed;
            existing.line_cost += lineCost;
          } else {
            allIngredients.set(input.name, { name: input.name, needed, qty_per_recipe: input.quantity, unit_cost: unitCost, line_cost: lineCost });
          }
        }
      }

      return { dirty_money, full_material_cost, ingredients: Array.from(allIngredients.values()), items };
    } catch (e) {
      logger.error("computeCraftFeasibilityBatch_error", { error: e instanceof Error ? e.message : String(e) });
      throw new Error("Erro ao calcular materiais: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    }
  });
