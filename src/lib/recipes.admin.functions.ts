import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type AdminRecipeRow = {
  recipe_id: number;
  item_id: number;
  item_name: string;
  category: string | null;
  subcategory: string | null;
  recipe_category: string | null;
  tier: string | null;
  min_sale_price: number | null;
  ingredients: Array<{
    item_id: number;
    name: string;
    quantity: number;
    unit_cost: number;
  }>;
};

export type AdminItemRow = {
  id: number;
  name: string;
  category: string | null;
  subcategory: string | null;
  estimated_value: number | null;
  purchase_price: number | null;
  min_sale_price: number | null;
  unit: string | null;
};

export const listRecipesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRecipeRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const rows = await pgQuery<{
      recipe_id: number;
      item_id: number;
      item_name: string;
      category: string | null;
      subcategory: string | null;
      recipe_category: string | null;
      tier: string | null;
      ing_item_id: number | null;
      ing_name: string | null;
      quantity: number | null;
      unit_cost: string | null;
    }>(
      `select r.id as recipe_id, r.item_id, i.name as item_name, i.category, i.subcategory, r.category as recipe_category, r.tier,
              ri.ingredient_item_id as ing_item_id,
              ii.name as ing_name,
              ri.quantity,
              coalesce(ii.purchase_price, ii.estimated_value, 0) as unit_cost
         from craft_recipes r
         join items i on i.id = r.item_id
         left join recipe_ingredients ri on ri.recipe_id = r.id
         left join items ii on ii.id = ri.ingredient_item_id
        where i.deleted_at is null
        order by i.name, ri.id`,
    );

    const map = new Map<number, AdminRecipeRow>();
    for (const r of rows) {
      let recipe = map.get(r.recipe_id);
      if (!recipe) {
        recipe = {
          recipe_id: r.recipe_id,
          item_id: r.item_id,
          item_name: r.item_name,
          category: r.category,
          subcategory: r.subcategory,
          recipe_category: r.recipe_category,
          tier: r.tier,
          ingredients: [],
        };
        map.set(r.recipe_id, recipe);
      }
      if (r.ing_item_id) {
        recipe.ingredients.push({
          item_id: r.ing_item_id,
          name: r.ing_name ?? "?",
          quantity: Number(r.quantity ?? 0),
          unit_cost: Number(r.unit_cost ?? 0),
        });
      }
    }
    return [...map.values()].sort((a, b) => a.item_name.localeCompare(b.item_name));
  });

export const updateRecipeIngredientQty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recipe_id: number; ingredient_item_id: number; quantity: number }) => {
    if (!Number.isFinite(d.recipe_id)) throw new Error("recipe_id inválido");
    if (!Number.isFinite(d.ingredient_item_id)) throw new Error("ingredient_item_id inválido");
    if (!Number.isFinite(d.quantity) || d.quantity < 0) throw new Error("quantidade inválida");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    // Upsert: delete then insert to handle unique constraint
    await pgQuery(
      `delete from recipe_ingredients where recipe_id = $1 and ingredient_item_id = $2`,
      [data.recipe_id, data.ingredient_item_id],
    );
    if (data.quantity > 0) {
      await pgQuery(
        `insert into recipe_ingredients (recipe_id, ingredient_item_id, quantity) values ($1, $2, $3)`,
        [data.recipe_id, data.ingredient_item_id, data.quantity],
      );
    }
  });

export const listItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminItemRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    return pgQuery<AdminItemRow>(
      `select id, name, category, subcategory,
              estimated_value::float as estimated_value,
              purchase_price::float as purchase_price,
              unit
         from items
        where deleted_at is null
        order by category, name`,
    );
  });

export const updateItemPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; estimated_value?: number; purchase_price?: number; min_sale_price?: number; xp_points?: number }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    if (d.estimated_value !== undefined && (!Number.isFinite(d.estimated_value) || d.estimated_value < 0))
      throw new Error("estimated_value inválida");
    if (d.purchase_price !== undefined && (!Number.isFinite(d.purchase_price) || d.purchase_price < 0))
      throw new Error("purchase_price inválida");
    if (d.min_sale_price !== undefined && (!Number.isFinite(d.min_sale_price) || d.min_sale_price < 0))
      throw new Error("min_sale_price inválida");
    if (d.xp_points !== undefined && (!Number.isFinite(d.xp_points) || d.xp_points < 0))
      throw new Error("xp_points inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const sets: string[] = [];
    const vals: (number | string)[] = [];

    if (data.estimated_value !== undefined) {
      sets.push(`estimated_value = $${sets.length + 1}`);
      vals.push(data.estimated_value);
    }
    if (data.purchase_price !== undefined) {
      sets.push(`purchase_price = $${sets.length + 1}`);
      vals.push(data.purchase_price);
    }
    if (data.min_sale_price !== undefined) {
      sets.push(`min_sale_price = $${sets.length + 1}`);
      vals.push(data.min_sale_price);
    }
    if (data.xp_points !== undefined) {
      sets.push(`xp_points = $${sets.length + 1}`);
      vals.push(data.xp_points);
    }
    if (sets.length === 0) return;

    vals.push(data.item_id);
    await pgQuery(
      `update items set ${sets.join(", ")}, updated_at = now() where id = $${vals.length}`,
      vals,
    );
  });
