import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "@/lib/pg.server";

export const diagIngredientPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const items = await pgQuery<{
      name: string;
      purchase_price: number | null;
      estimated_value: number | null;
      min_sale_price: number | null;
      subcategory: string | null;
    }>(
      `SELECT name, purchase_price::float, estimated_value::float, min_sale_price::float, subcategory
       FROM items WHERE active = true ORDER BY name`
    ).catch(() => []);

    const recipes = await pgQuery<{
      item_name: string;
      ingredient_name: string;
      qty: number;
      purchase_price: number | null;
      estimated_value: number | null;
      unit_cost: number;
      line_cost: number;
    }>(
      `SELECT 
        parent.name as item_name,
        i.name as ingredient_name,
        ri.quantity as qty,
        i.purchase_price::float,
        i.estimated_value::float,
        COALESCE(i.purchase_price, i.estimated_value, 0)::float as unit_cost,
        (ri.quantity * COALESCE(i.purchase_price, i.estimated_value, 0))::float as line_cost
      FROM craft_recipes r
      JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      JOIN items i ON i.id = ri.ingredient_item_id
      JOIN items parent ON parent.id = r.item_id
      ORDER BY parent.name, line_cost DESC`
    ).catch(() => []);

    return { items, recipes };
  });
