import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import {
  getAllRecipes,
  getItemById,
  getNumericId,
  getAllItems,
} from "./config.loader";

export type AdminRecipeRow = {
  recipe_id: number;
  item_id: number;
  item_name: string;
  category: string | null;
  subcategory: string | null;
  recipe_category: string | null;
  tier: string | null;
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
  unit: string | null;
};

export const listRecipesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRecipeRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const recipes = getAllRecipes();
    const result: AdminRecipeRow[] = [];

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const outputItem = getItemById(recipe.output);
      if (!outputItem) continue;

      const ingredients: AdminRecipeRow["ingredients"] = [];
      for (const [ingId, qty] of Object.entries(recipe.inputs)) {
        const ingItem = getItemById(ingId);
        if (!ingItem) continue;
        ingredients.push({
          item_id: getNumericId(ingId),
          name: ingItem.name,
          quantity: qty,
          unit_cost: ingItem.buyPrice ?? ingItem.estimatedValue ?? 0,
        });
      }

      result.push({
        recipe_id: getNumericId(recipeId),
        item_id: getNumericId(recipe.output),
        item_name: outputItem.name,
        category: outputItem.category,
        subcategory: outputItem.subcategory,
        recipe_category: outputItem.type === "weapon" ? "craft_weapons" : outputItem.type === "magazine" ? "craft_carregadores" : "outros",
        tier: outputItem.tier,
        ingredients,
      });
    }

    return result.sort((a, b) => (a.recipe_category ?? "").localeCompare(b.recipe_category ?? "") || a.item_name.localeCompare(b.item_name));
  });

export const listItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminItemRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const items = getAllItems();
    return Object.entries(items)
      .map(([id, item]) => ({
        id: getNumericId(id),
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        estimated_value: item.estimatedValue,
        purchase_price: item.buyPrice,
        unit: "unidade",
      }))
      .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name));
  });

export const listDbItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    return pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      side: string | null;
      tier: string | null;
      purchase_price: number | null;
      min_sale_price: number | null;
      estimated_value: number | null;
      xp_points: number | null;
      active: boolean;
    }>(
      `select id, name, category, subcategory, side, tier,
              purchase_price::float as purchase_price,
              min_sale_price::float as min_sale_price,
              estimated_value::float as estimated_value,
              xp_points, active
       from items
       where coalesce(deleted_at, 'epoch'::timestamptz) = 'epoch'::timestamptz
       order by active desc, category, name`,
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

export const updateItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    item_id: number;
    name?: string;
    category?: string;
    subcategory?: string;
    side?: string;
    tier?: string;
    purchase_price?: number;
    min_sale_price?: number;
    estimated_value?: number;
    xp_points?: number;
    active?: boolean;
  }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const sets: string[] = [];
    const vals: (number | string | boolean)[] = [];

    if (data.name !== undefined) { sets.push(`name = $${sets.length + 1}`); vals.push(data.name); }
    if (data.category !== undefined) { sets.push(`category = $${sets.length + 1}`); vals.push(data.category); }
    if (data.subcategory !== undefined) { sets.push(`subcategory = $${sets.length + 1}`); vals.push(data.subcategory); }
    if (data.side !== undefined) { sets.push(`side = $${sets.length + 1}`); vals.push(data.side); }
    if (data.tier !== undefined) { sets.push(`tier = $${sets.length + 1}`); vals.push(data.tier); }
    if (data.purchase_price !== undefined) { sets.push(`purchase_price = $${sets.length + 1}`); vals.push(data.purchase_price); }
    if (data.min_sale_price !== undefined) { sets.push(`min_sale_price = $${sets.length + 1}`); vals.push(data.min_sale_price); }
    if (data.estimated_value !== undefined) { sets.push(`estimated_value = $${sets.length + 1}`); vals.push(data.estimated_value); }
    if (data.xp_points !== undefined) { sets.push(`xp_points = $${sets.length + 1}`); vals.push(data.xp_points); }
    if (data.active !== undefined) { sets.push(`active = $${sets.length + 1}`); vals.push(data.active); }

    if (sets.length === 0) return;
    vals.push(data.item_id);
    await pgQuery(
      `update items set ${sets.join(", ")}, updated_at = now() where id = $${vals.length}`,
      vals,
    );
  });

export const createItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    category: string;
    subcategory?: string;
    side?: string;
    tier?: string;
    purchase_price?: number;
    min_sale_price?: number;
    estimated_value?: number;
    xp_points?: number;
  }) => {
    if (!d.name || d.name.length < 1) throw new Error("Nome obrigatório");
    if (!d.category) throw new Error("Categoria obrigatória");
    return d;
  })
  .handler(async ({ context, data }): Promise<{ id: number }> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const result = await pgOne<{ id: number }>(
      `insert into items (name, category, subcategory, side, tier, purchase_price, min_sale_price, estimated_value, xp_points, unit, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unidade', true)
       returning id`,
      [
        data.name,
        data.category,
        data.subcategory ?? data.category,
        data.side ?? "venda",
        data.tier ?? null,
        data.purchase_price ?? 0,
        data.min_sale_price ?? 0,
        data.estimated_value ?? 0,
        data.xp_points ?? 0,
      ],
    );
    if (!result) throw new Error("Erro ao criar item");
    return { id: result.id };
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

export const deleteItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    await pgQuery(
      `update items set deleted_at = now(), active = false where id = $1`,
      [data.item_id],
    );
  });
