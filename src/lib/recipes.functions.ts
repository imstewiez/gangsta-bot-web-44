import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type RecipeRow = {
  recipe_id: number;
  item_id: number;
  item_name: string;
  category: string | null;
  tier: string | null;
  unit: string | null;
  ingredients: Array<{
    item_id: number;
    name: string;
    quantity: number;
    unit_cost: number;
    line_cost: number;
  }>;
  total_cost: number;
  estimated_value: number;
  margin: number;
  margin_pct: number | null;
};

export const listRecipes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecipeRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const isManager = me?.is_manager ?? false;
    const rows = await pgQuery<{
      recipe_id: number;
      item_id: number;
      item_name: string;
      category: string | null;
      tier: string | null;
      unit: string | null;
      estimated_value: string | null;
      ing_item_id: number | null;
      ing_name: string | null;
      quantity: number | null;
      unit_cost: string | null;
    }>(
      `select r.id as recipe_id, r.item_id, i.name as item_name, r.category, r.tier, i.unit,
              i.estimated_value,
              ri.ingredient_item_id as ing_item_id,
              ii.name as ing_name,
              ri.quantity,
              coalesce(ii.purchase_price, ii.estimated_value, 0) as unit_cost
         from craft_recipes r
         join items i on i.id = r.item_id
         left join recipe_ingredients ri on ri.recipe_id = r.id
         left join items ii on ii.id = ri.ingredient_item_id
        where i.deleted_at is null
        order by i.name, ri.id`
    );

    const map = new Map<number, RecipeRow>();
    for (const r of rows) {
      let recipe = map.get(r.recipe_id);
      if (!recipe) {
        recipe = {
          recipe_id: r.recipe_id,
          item_id: r.item_id,
          item_name: r.item_name,
          category: r.category,
          tier: r.tier,
          unit: r.unit,
          ingredients: [],
          total_cost: 0,
          estimated_value: Number(r.estimated_value ?? 0),
          margin: 0,
          margin_pct: null,
        };
        map.set(r.recipe_id, recipe);
      }
      if (r.ing_item_id) {
        const qty = Number(r.quantity ?? 0);
        const uc = Number(r.unit_cost ?? 0);
        const line = qty * uc;
        recipe.ingredients.push({
          item_id: r.ing_item_id,
          name: r.ing_name ?? "?",
          quantity: qty,
          unit_cost: uc,
          line_cost: line,
        });
        recipe.total_cost += line;
      }
    }
    for (const r of map.values()) {
      const margin = r.estimated_value - r.total_cost;
      const pct = r.total_cost > 0 ? (margin / r.total_cost) * 100 : null;
      // margem só vai no payload se for chefia
      r.margin = isManager ? margin : 0;
      r.margin_pct = isManager ? pct : null;
    }
    // Default: maior valor estimado primeiro (ranking financeiro), tie-break alfabético.
    return [...map.values()].sort(
      (a, b) => (b.estimated_value ?? 0) - (a.estimated_value ?? 0) ||
                a.item_name.localeCompare(b.item_name, "pt")
    );
  });

export type CraftFeasibility = {
  recipe_id: number;
  item_name: string;
  requested_qty: number;
  total_cost: number;
  feasible: boolean;
  missing: Array<{ name: string; needed: number; in_stock: number; missing: number }>;
};

export const computeCraftFeasibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recipe_id: number; quantity: number }) => {
    if (!Number.isFinite(d.recipe_id)) throw new Error("recipe_id inválido");
    if (!Number.isFinite(d.quantity) || d.quantity <= 0) throw new Error("quantidade inválida");
    return d;
  })
  .handler(async ({ data }): Promise<CraftFeasibility> => {
    const head = await pgOne<{ item_name: string }>(
      `select i.name as item_name from craft_recipes r join items i on i.id = r.item_id where r.id = $1`,
      [data.recipe_id]
    );
    const ings = await pgQuery<{
      ingredient_item_id: number;
      name: string;
      quantity: number;
      unit_cost: string | null;
      in_stock: number | null;
    }>(
      `select ri.ingredient_item_id, ii.name,
              ri.quantity,
              coalesce(ii.purchase_price, ii.estimated_value, 0) as unit_cost,
              coalesce((select sum(balance) from inventory_balance b where b.item_id = ri.ingredient_item_id), 0) as in_stock
         from recipe_ingredients ri
         join items ii on ii.id = ri.ingredient_item_id
        where ri.recipe_id = $1`,
      [data.recipe_id]
    );
    let total_cost = 0;
    const missing: CraftFeasibility["missing"] = [];
    for (const ing of ings) {
      const needed = Number(ing.quantity) * data.quantity;
      const stock = Number(ing.in_stock ?? 0);
      total_cost += needed * Number(ing.unit_cost ?? 0);
      if (stock < needed) {
        missing.push({ name: ing.name, needed, in_stock: stock, missing: needed - stock });
      }
    }
    return {
      recipe_id: data.recipe_id,
      item_name: head?.item_name ?? "?",
      requested_qty: data.quantity,
      total_cost,
      feasible: missing.length === 0,
      missing,
    };
  });
