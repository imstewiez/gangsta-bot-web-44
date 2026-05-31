import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { logger } from "./logger.server";
import { pgQuery } from "./pg.server";
import {
  getAllRecipes,
  getItemById,
  getItemByName,
  getRecipeForItemName,
  getNumericId,
  getAllItems,
} from "./config.loader";
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
  purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  morador_purchase_price: number | null;
};

type MergedRecipe = {
  output: string;
  inputs: Record<string, number>;
};

async function getDbPriceMap(names: string[]): Promise<Map<string, DbPriceRow>> {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (uniqueNames.length === 0) return new Map();
  const rows = await pgQuery<DbPriceRow>(
    `select id, name, category, subcategory,
            purchase_price::float as purchase_price,
            min_sale_price::float as min_sale_price,
            estimated_value::float as estimated_value,
            morador_purchase_price::float as morador_purchase_price
     from items
     where name = any($1::text[])
       and coalesce(active, true) = true
       and deleted_at is null`,
    [uniqueNames],
  );
  return new Map(rows.map((r) => [r.name, r]));
}

function getConfigIdByNameMap(): Map<string, string> {
  const configItems = getAllItems();
  return new Map(Object.entries(configItems).map(([id, item]) => [item.name, id]));
}

/** Fetch DB recipes merged with config.json recipes. DB overrides config when it has valid inputs. */
export async function getMergedRecipes(): Promise<Record<string, MergedRecipe>> {
  const configRecipes = getAllRecipes();
  const configItems = getAllItems();
  const configIdByName = getConfigIdByNameMap();

  const dbRows = await pgQuery<{
    recipe_id: number;
    item_name: string;
    ingredient_name: string | null;
    quantity: number | null;
  }>(
    `select cr.id as recipe_id, i.name as item_name, ii.name as ingredient_name, ri.quantity::float as quantity
     from craft_recipes cr
     join items i on i.id = cr.item_id
     left join recipe_ingredients ri on ri.recipe_id = cr.id
     left join items ii on ii.id = ri.ingredient_item_id
     where coalesce(i.active, true) = true and i.deleted_at is null`,
  );

  const dbInputsByOutputName = new Map<string, Record<string, number>>();
  for (const row of dbRows) {
    if (!dbInputsByOutputName.has(row.item_name)) dbInputsByOutputName.set(row.item_name, {});
    if (!row.ingredient_name || row.quantity == null || row.quantity <= 0) continue;
    const ingConfigId = configIdByName.get(row.ingredient_name);
    if (!ingConfigId) continue;
    dbInputsByOutputName.get(row.item_name)![ingConfigId] = Number(row.quantity);
  }

  const merged: Record<string, MergedRecipe> = {};
  for (const [recipeId, recipe] of Object.entries(configRecipes)) {
    const outputItem = configItems[recipe.output];
    if (!outputItem) continue;
    const dbInputs = dbInputsByOutputName.get(outputItem.name);
    merged[recipeId] = {
      output: recipe.output,
      inputs: dbInputs && Object.keys(dbInputs).length > 0 ? dbInputs : { ...recipe.inputs },
    };
  }

  return merged;
}

export async function getMergedRecipeForItemName(itemName: string): Promise<MergedRecipe | null> {
  const recipes = await getMergedRecipes();
  for (const recipe of Object.values(recipes)) {
    const outItem = getItemById(recipe.output);
    if (outItem?.name === itemName) return recipe;
  }
  return null;
}

export const listRecipes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecipeRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const isManager = me?.is_manager ?? false;
    const recipes = await getMergedRecipes();
    const result: RecipeRow[] = [];

    const allNames = new Set<string>();
    for (const recipe of Object.values(recipes)) {
      const out = getItemById(recipe.output);
      if (out) allNames.add(out.name);
      for (const ingId of Object.keys(recipe.inputs)) {
        const ing = getItemById(ingId);
        if (ing) allNames.add(ing.name);
      }
    }

    const dbPriceMap = await getDbPriceMap(Array.from(allNames));
    const outputIds = Array.from(new Set(
      Object.values(recipes)
        .map((r) => dbPriceMap.get(getItemById(r.output)?.name ?? "")?.id)
        .filter(Boolean) as number[],
    ));
    const surchargeMap = await getSurchargesForItems(outputIds);
    const dbRecipeRows = await pgQuery<{ item_id: number; id: number }>(`select item_id, id from craft_recipes`);
    const dbRecipeIdByItemId = new Map(dbRecipeRows.map((r) => [r.item_id, r.id]));

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const outputItem = getItemById(recipe.output);
      if (!outputItem) continue;
      const outDb = dbPriceMap.get(outputItem.name);
      const outPrices = resolveItemPrices(outDb, outputItem, me?.tier ?? null, surchargeMap.get(outDb?.id ?? 0) ?? null);
      const ingredients: RecipeRow["ingredients"] = [];
      let total_cost = 0;

      for (const [ingId, qty] of Object.entries(recipe.inputs)) {
        const ingItem = getItemById(ingId);
        if (!ingItem) continue;
        const ingDb = dbPriceMap.get(ingItem.name);
        const ingPrices = resolveItemPrices(ingDb, ingItem);
        const unit_cost = ingPrices.purchase_price ?? ingPrices.estimated_value ?? 0;
        const line_cost = qty * unit_cost;
        ingredients.push({
          item_id: ingDb?.id ?? getNumericId(ingId),
          name: ingItem.name,
          quantity: qty,
          unit_cost,
          line_cost,
          category: ingDb?.category ?? ingItem.category,
          subcategory: ingDb?.subcategory ?? ingItem.subcategory,
        });
        total_cost += line_cost;
      }

      const salePrice = outPrices.tier_price ?? outPrices.min_sale_price ?? outPrices.estimated_value ?? 0;
      const margin = salePrice - total_cost;
      result.push({
        recipe_id: outDb?.id ?? getNumericId(recipeId),
        item_id: outDb?.id ?? getNumericId(recipe.output),
        item_name: outputItem.name,
        category: outDb?.category ?? outputItem.category,
        subcategory: outDb?.subcategory ?? outputItem.subcategory,
        tier: outputItem.tier,
        unit: "unidade",
        ingredients,
        total_cost,
        estimated_value: outPrices.estimated_value ?? 0,
        min_sale_price: outPrices.min_sale_price,
        tier_price: outPrices.tier_price,
        margin: isManager ? margin : 0,
        margin_pct: isManager && total_cost > 0 ? (margin / total_cost) * 100 : null,
        recipe_category: outputItem.type === "weapon" ? "craft_weapons" : outputItem.type === "magazine" ? "craft_carregadores" : "outros",
        db_recipe_id: outDb ? (dbRecipeIdByItemId.get(outDb.id) ?? null) : null,
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

async function resolveRecipeForItemId(itemId: number): Promise<{ itemName: string; recipe: MergedRecipe | null }> {
  const dbItem = await pgQuery<{ id: number; name: string }>(
    `select id, name from items where id = $1 and coalesce(active, true) = true and deleted_at is null`,
    [itemId],
  );
  const itemName = dbItem[0]?.name ?? "";
  if (!itemName) return { itemName: "", recipe: null };
  const recipe = await getMergedRecipeForItemName(itemName);
  return { itemName, recipe };
}

export const computeCraftFeasibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recipe_id: number; quantity: number }) => {
    if (!Number.isFinite(d.recipe_id)) throw new Error("recipe_id inválido");
    if (!Number.isFinite(d.quantity) || d.quantity <= 0) throw new Error("quantidade inválida");
    return d;
  })
  .handler(async ({ data, context }): Promise<CraftFeasibility> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const { itemName, recipe } = await resolveRecipeForItemId(data.recipe_id);
    if (!recipe) throw new Error("Receita não encontrada");
    const head = getItemById(recipe.output);
    if (!head) throw new Error("Item da receita não encontrado");

    const ingNames = Object.keys(recipe.inputs).map((id) => getItemById(id)?.name).filter(Boolean) as string[];
    ingNames.push(head.name);
    const dbPriceMap = await getDbPriceMap(ingNames);
    const headDb = dbPriceMap.get(head.name);
    const surchargeMap = await getSurchargesForItems(headDb?.id ? [headDb.id] : []);
    const headPrices = resolveItemPrices(headDb, head, me?.tier ?? null, surchargeMap.get(headDb?.id ?? 0) ?? null);
    const ingredients: CraftFeasibility["ingredients"] = [];

    for (const [ingId, qty] of Object.entries(recipe.inputs)) {
      const ingItem = getItemById(ingId);
      if (!ingItem) continue;
      const ingDb = dbPriceMap.get(ingItem.name);
      const ingPrices = resolveItemPrices(ingDb, ingItem);
      const needed = qty * data.quantity;
      const unitCost = ingPrices.purchase_price ?? ingPrices.estimated_value ?? 0;
      ingredients.push({
        name: ingItem.name,
        needed,
        qty_per_recipe: qty,
        unit_cost: unitCost,
        line_cost: needed * unitCost,
      });
    }

    return {
      recipe_id: data.recipe_id,
      item_name: itemName || head.name,
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
      if (!Number.isFinite(l.item_id)) throw new Error("item_id inválido");
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) throw new Error("quantidade inválida");
    }
    return d;
  })
  .handler(async ({ data }): Promise<CraftFeasibilityBatch> => {
    try {
      const itemIds = data.lines.map((l) => l.item_id);
      const dbItems = await pgQuery<{ id: number; name: string }>(
        `select id, name from items where id = any($1::int[]) and coalesce(active, true) = true and deleted_at is null`,
        [itemIds],
      );
      const nameById = new Map(dbItems.map((i) => [i.id, i.name]));
      const mergedRecipes = await getMergedRecipes();

      const recipeByName = new Map<string, MergedRecipe>();
      const allNames = new Set<string>();
      for (const recipe of Object.values(mergedRecipes)) {
        const output = getItemById(recipe.output);
        if (!output) continue;
        recipeByName.set(output.name, recipe);
      }

      for (const line of data.lines) {
        const itemName = nameById.get(line.item_id);
        if (!itemName) continue;
        const recipe = recipeByName.get(itemName) ?? getRecipeForItemName(itemName) ?? null;
        const item = getItemByName(itemName);
        if (item) allNames.add(item.name);
        if (!recipe) continue;
        for (const ingId of Object.keys(recipe.inputs)) {
          const ingItem = getItemById(ingId);
          if (ingItem) allNames.add(ingItem.name);
        }
      }
      const dbPriceMap = await getDbPriceMap(Array.from(allNames));
      const allIngredients = new Map<string, { name: string; needed: number; qty_per_recipe: number; unit_cost: number; line_cost: number }>();
      let dirty_money = 0;
      let full_material_cost = 0;
      const items: CraftFeasibilityBatch["items"] = [];

      for (const line of data.lines) {
        const itemName = nameById.get(line.item_id);
        if (!itemName) continue;
        const item = getItemByName(itemName);
        const recipe = recipeByName.get(itemName) ?? getRecipeForItemName(itemName) ?? null;
        if (!item || !recipe) continue;
        items.push({ item_name: item.name, requested_qty: line.quantity });
        const itemPrices = resolveItemPrices(dbPriceMap.get(item.name), item);
        dirty_money += (itemPrices.estimated_value ?? 0) * line.quantity;
        const isOrange = item.tier === "orange" || item.category === "armas_orange";

        for (const [ingId, qty] of Object.entries(recipe.inputs)) {
          const ingItem = getItemById(ingId);
          if (!ingItem) continue;
          const ingPrices = resolveItemPrices(dbPriceMap.get(ingItem.name), ingItem);
          const needed = qty * line.quantity;
          const unitCost = ingPrices.purchase_price ?? ingPrices.estimated_value ?? 0;
          const lineCost = needed * unitCost;
          full_material_cost += lineCost;
          if (isOrange && !ingItem.name.toLowerCase().includes("peça")) continue;
          const existing = allIngredients.get(ingItem.name);
          if (existing) {
            existing.needed += needed;
            existing.line_cost += lineCost;
          } else {
            allIngredients.set(ingItem.name, { name: ingItem.name, needed, qty_per_recipe: qty, unit_cost: unitCost, line_cost: lineCost });
          }
        }
      }

      return { dirty_money, full_material_cost, ingredients: Array.from(allIngredients.values()), items };
    } catch (e) {
      logger.error("computeCraftFeasibilityBatch_error", { error: e instanceof Error ? e.message : String(e) });
      throw new Error("Erro ao calcular materiais: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    }
  });
