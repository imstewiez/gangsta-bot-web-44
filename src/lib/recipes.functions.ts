import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { logger } from "./logger.server";
import {
  getAllRecipes,
  getRecipeById,
  getRecipeForItem,
  getItemById,
  getItemByName,
  getNumericId,
  getTierPrice,
  getRecipeMaterialCost,
} from "./config.loader";

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
};

export const listRecipes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecipeRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const isManager = me?.is_manager ?? false;

    const recipes = getAllRecipes();
    const result: RecipeRow[] = [];

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const outputItem = getItemById(recipe.output);
      if (!outputItem) continue;

      const ingredients: RecipeRow["ingredients"] = [];
      let total_cost = 0;

      for (const [ingId, qty] of Object.entries(recipe.inputs)) {
        const ingItem = getItemById(ingId);
        if (!ingItem) continue;
        const unit_cost = ingItem.buyPrice ?? ingItem.estimatedValue ?? 0;
        const line_cost = qty * unit_cost;
        ingredients.push({
          item_id: getNumericId(ingId),
          name: ingItem.name,
          quantity: qty,
          unit_cost,
          line_cost,
          category: ingItem.category,
          subcategory: ingItem.subcategory,
        });
        total_cost += line_cost;
      }

      const basePrice = outputItem.sellPrice ?? outputItem.estimatedValue ?? 0;
      const tierPrice = getTierPrice(recipe.output, me?.tier ?? null) ?? basePrice;
      const margin = tierPrice - total_cost;
      const margin_pct = total_cost > 0 ? (margin / total_cost) * 100 : null;

      result.push({
        recipe_id: getNumericId(recipeId),
        item_id: getNumericId(recipe.output),
        item_name: outputItem.name,
        category: outputItem.category,
        subcategory: outputItem.subcategory,
        tier: outputItem.tier,
        unit: "unidade",
        ingredients,
        total_cost,
        estimated_value: outputItem.estimatedValue ?? 0,
        min_sale_price: outputItem.sellPrice,
        tier_price: tierPrice,
        margin: isManager ? margin : 0,
        margin_pct: isManager ? margin_pct : null,
        recipe_category: outputItem.type === "weapon" ? "craft_weapons" : outputItem.type === "magazine" ? "craft_carregadores" : "outros",
      });
    }

    return result.sort((a, b) => b.estimated_value - a.estimated_value);
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
    if (!Number.isFinite(d.quantity) || d.quantity <= 0)
      throw new Error("quantidade inválida");
    return d;
  })
  .handler(async ({ data, context }): Promise<CraftFeasibility> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    // recipe_id aqui é o numericId — precisamos de mapear para string ID
    // Como os numericIds são sequenciais e as receitas têm IDs próprios,
    // vamos encontrar a receita pelo item_id numeric
    const allRecipes = getAllRecipes();
    let targetRecipe: ReturnType<typeof getRecipeById> = undefined;
    let targetRecipeId = "";
    for (const [rid, r] of Object.entries(allRecipes)) {
      if (getNumericId(rid) === data.recipe_id || getNumericId(r.output) === data.recipe_id) {
        targetRecipe = r;
        targetRecipeId = rid;
        break;
      }
    }
    if (!targetRecipe) {
      throw new Error("Receita não encontrada");
    }

    const head = getItemById(targetRecipe.output);
    if (!head) throw new Error("Item da receita não encontrado");

    const isOrange = head.tier === "orange" || head.category === "armas_orange";
    const ingredients: CraftFeasibility["ingredients"] = [];
    let total_cost = 0;

    for (const [ingId, qty] of Object.entries(targetRecipe.inputs)) {
      const ingItem = getItemById(ingId);
      if (!ingItem) continue;
      const needed = qty * data.quantity;
      const unitCost = ingItem.buyPrice ?? ingItem.estimatedValue ?? 0;
      const lineCost = needed * unitCost;
      total_cost += lineCost;

      if (isOrange && !ingItem.name.toLowerCase().includes("peça")) continue;

      ingredients.push({
        name: ingItem.name,
        needed,
        qty_per_recipe: qty,
        unit_cost: unitCost,
        line_cost: lineCost,
      });
    }

    const itemPrice = (head.estimatedValue ?? 0) * data.quantity;
    const dirty_money = itemPrice;
    const tier_price = getTierPrice(targetRecipe.output, me?.tier ?? null);

    return {
      recipe_id: data.recipe_id,
      item_name: head.name,
      requested_qty: data.quantity,
      dirty_money,
      min_sale_price: head.sellPrice,
      tier_price,
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
      const allIngredients = new Map<string, { name: string; needed: number; qty_per_recipe: number; unit_cost: number; line_cost: number }>();
      let dirty_money = 0;
      let full_material_cost = 0;
      const items: CraftFeasibilityBatch["items"] = [];

      for (const line of data.lines) {
        const item = getItemByNumericId(line.item_id);
        if (!item) continue;

        const recipe = getRecipeForItemName(item.name);
        if (!recipe) continue;

        items.push({ item_name: item.name, requested_qty: line.quantity });

        const isOrange = item.tier === "orange" || item.category === "armas_orange";
        const itemPrice = (item.estimatedValue ?? 0) * line.quantity;
        dirty_money += itemPrice;

        for (const [ingId, qty] of Object.entries(recipe.inputs)) {
          const ingItem = getItemById(ingId);
          if (!ingItem) continue;
          const needed = qty * line.quantity;
          const unitCost = ingItem.buyPrice ?? ingItem.estimatedValue ?? 0;
          const lineCost = needed * unitCost;
          full_material_cost += lineCost;

          if (isOrange && !ingItem.name.toLowerCase().includes("peça")) continue;

          const existing = allIngredients.get(ingItem.name);
          if (existing) {
            existing.needed += needed;
            existing.line_cost += lineCost;
          } else {
            allIngredients.set(ingItem.name, {
              name: ingItem.name,
              needed,
              qty_per_recipe: qty,
              unit_cost: unitCost,
              line_cost: lineCost,
            });
          }
        }
      }

      return {
        dirty_money,
        full_material_cost,
        ingredients: Array.from(allIngredients.values()),
        items,
      };
    } catch (e: any) {
      logger.error("computeCraftFeasibilityBatch_error", { error: e instanceof Error ? e.message : String(e) });
      throw new Error("Erro ao calcular materiais: " + (e?.message ?? "Erro desconhecido"));
    }
  });
