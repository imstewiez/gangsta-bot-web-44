import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { logAdminAction } from "./logging.functions";
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

    const configItems = getAllItems();
    const configNames = Object.values(configItems).map((i) => i.name);

    const dbItems = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      estimated_value: number | null;
      purchase_price: number | null;
    }>(
      `select id, name, category, subcategory,
              estimated_value::float as estimated_value,
              purchase_price::float as purchase_price
       from items where name = any($1::text[]) and active = true
       order by category, name`,
      [configNames],
    );

    return dbItems.map((db) => {
      const cfg = configItems[Object.keys(configItems).find(k => configItems[k].name === db.name) ?? ""];
      return {
        id: db.id,
        name: db.name,
        category: db.category ?? cfg?.category ?? null,
        subcategory: db.subcategory ?? cfg?.subcategory ?? null,
        estimated_value: db.estimated_value ?? cfg?.estimatedValue ?? null,
        purchase_price: db.purchase_price ?? cfg?.buyPrice ?? null,
        unit: "unidade",
      };
    });
  });

export const listDbItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const configNames = new Set(Object.values(getAllItems()).map((i) => i.name));

    const rows = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      side: string | null;
      purchase_price: number | null;
      morador_purchase_price: number | null;
      min_sale_price: number | null;
      estimated_value: number | null;
      xp_points: number | null;
      active: boolean;
    }>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price,
              min_sale_price::float as min_sale_price,
              estimated_value::float as estimated_value,
              xp_points, active
       from items
       order by active desc, category, name`,
    );

    // Fetch all DB recipes with ingredients
    const recipeRows = await pgQuery<{
      recipe_id: number;
      item_id: number;
    }>(`select id as recipe_id, item_id from craft_recipes`);

    const ingredientRows = await pgQuery<{
      recipe_id: number;
      ingredient_item_id: number;
      quantity: number;
      ingredient_name: string;
    }>(
      `select ri.recipe_id, ri.ingredient_item_id, ri.quantity, i.name as ingredient_name
       from recipe_ingredients ri
       join items i on i.id = ri.ingredient_item_id`
    );

    const recipeMap = new Map<number, { recipe_id: number; ingredients: typeof ingredientRows }>();
    for (const r of recipeRows) {
      recipeMap.set(r.item_id, { recipe_id: r.recipe_id, ingredients: [] });
    }
    for (const ing of ingredientRows) {
      const rec = recipeMap.get(
        recipeRows.find((r) => r.recipe_id === ing.recipe_id)?.item_id ?? 0
      );
      if (rec) rec.ingredients.push(ing);
    }

    return rows.map((r) => {
      const recipe = recipeMap.get(r.id);
      return {
        ...r,
        in_config: configNames.has(r.name),
        recipe_id: recipe?.recipe_id ?? null,
        ingredients: recipe?.ingredients ?? [],
      };
    });
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
    purchase_price?: number;
    morador_purchase_price?: number;
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
    if (data.purchase_price !== undefined) { sets.push(`purchase_price = $${sets.length + 1}`); vals.push(data.purchase_price); }
    if (data.morador_purchase_price !== undefined) { sets.push(`morador_purchase_price = $${sets.length + 1}`); vals.push(data.morador_purchase_price); }
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
    await logAdminAction(context.supabase, {
      action: "item_updated",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: data.item_id,
      details: `Item atualizado (${sets.length} campos)`,
      afterState: { fields_changed: sets.map((s) => s.split(" ")[0]) },
    });
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
    await logAdminAction(context.supabase, {
      action: "item_created",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: result.id,
      details: `Material criado: ${data.name}`,
      afterState: { name: data.name, category: data.category, side: data.side },
    });
    return { id: result.id };
  });

export const getMaterialItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const rows = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      purchase_price: number | null;
    }>(
      `select id, name, category, purchase_price::float as purchase_price
       from items
       where active = true
         and category in ('materiais','reciclagem','prints','metais','corpos')
       order by category, name`
    );

    return rows;
  });

export const updateItemRecipeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    item_id: number;
    ingredients: Array<{ ingredient_item_id: number; quantity: number }>;
  }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    if (!Array.isArray(d.ingredients)) throw new Error("ingredients inválido");
    for (const ing of d.ingredients) {
      if (!Number.isFinite(ing.ingredient_item_id)) throw new Error("ingredient_item_id inválido");
      if (!Number.isFinite(ing.quantity) || ing.quantity < 0) throw new Error("quantidade inválida");
    }
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    // Ensure craft_recipes row exists
    const existing = await pgOne<{ id: number }>(
      `select id from craft_recipes where item_id = $1 limit 1`,
      [data.item_id],
    );

    let recipeId: number;
    if (existing) {
      recipeId = existing.id;
    } else {
      const inserted = await pgOne<{ id: number }>(
        `insert into craft_recipes (item_id, quantity) values ($1, 1) returning id`,
        [data.item_id],
      );
      if (!inserted) throw new Error("Erro ao criar receita");
      recipeId = inserted.id;
    }

    // Delete existing ingredients
    await pgQuery(
      `delete from recipe_ingredients where recipe_id = $1`,
      [recipeId],
    );

    // Insert new ingredients
    for (const ing of data.ingredients) {
      if (ing.quantity > 0) {
        await pgQuery(
          `insert into recipe_ingredients (recipe_id, ingredient_item_id, quantity) values ($1, $2, $3)`,
          [recipeId, ing.ingredient_item_id, ing.quantity],
        );
      }
    }
  });

export const updateRecipeIngredientQty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; ingredient_item_id: number; quantity: number }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    if (!Number.isFinite(d.ingredient_item_id)) throw new Error("ingredient_item_id inválido");
    if (!Number.isFinite(d.quantity) || d.quantity < 0) throw new Error("quantidade inválida");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    // Find or create craft_recipes row for this item
    let recipeId: number;
    const existing = await pgOne<{ id: number }>(
      `select id from craft_recipes where item_id = $1 limit 1`,
      [data.item_id],
    );
    if (existing) {
      recipeId = existing.id;
    } else {
      const inserted = await pgOne<{ id: number }>(
        `insert into craft_recipes (item_id, quantity) values ($1, 1) returning id`,
        [data.item_id],
      );
      if (!inserted) throw new Error("Erro ao criar receita");
      recipeId = inserted.id;
    }

    await pgQuery(
      `delete from recipe_ingredients where recipe_id = $1 and ingredient_item_id = $2`,
      [recipeId, data.ingredient_item_id],
    );
    if (data.quantity > 0) {
      await pgQuery(
        `insert into recipe_ingredients (recipe_id, ingredient_item_id, quantity) values ($1, $2, $3)`,
        [recipeId, data.ingredient_item_id, data.quantity],
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
    const item = await pgOne<{ name: string }>(`select name from items where id = $1`, [data.item_id]);
    await deleteItemsByIds([data.item_id]);
    await logAdminAction(context.supabase, {
      action: "item_deleted",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: data.item_id,
      details: `Material eliminado: ${item?.name ?? "#" + data.item_id}`,
    });
  });

export const deleteItemsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_ids: number[] }) => {
    if (!Array.isArray(d.item_ids) || d.item_ids.length === 0) throw new Error("item_ids inválido");
    if (!d.item_ids.every((id) => Number.isFinite(id))) throw new Error("item_ids contém IDs inválidos");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");
    const items = await pgQuery<{ id: number; name: string }>(
      `select id, name from items where id = any($1::int[])`, [data.item_ids],
    );
    await deleteItemsByIds(data.item_ids);
    await logAdminAction(context.supabase, {
      action: "item_deleted",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: data.item_ids.join(","),
      details: `${data.item_ids.length} materiais eliminados: ${items.map((i) => i.name).join(", ")}`,
    });
  });

async function deleteItemsByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  // Guard: block deletion if there are pending orders for these items
  const pendingOrders = await pgOne<{ count: string }>(
    `select count(*)::text as count from orders where item_id = any($1::int[]) and status in ('pending','approved','in_progress','ready')`,
    [ids],
  );
  if (Number(pendingOrders?.count ?? 0) > 0) {
    throw new Error(`Não é possível eliminar: existem ${pendingOrders?.count} encomenda(s) pendente(s) associadas a estes materiais. Resolva as encomendas primeiro.`);
  }

  // Soft-delete items instead of hard delete to preserve order history
  await pgQuery(
    `update items set active = false, deleted_at = now(), updated_at = now() where id = any($1::int[])`,
    [ids],
  );

  // Clean up non-critical related records
  await pgQuery(`delete from inventory_movements where item_id = any($1::int[])`, [ids]);
  await pgQuery(`delete from operation_materials where item_id = any($1::int[])`, [ids]);
  await pgQuery(`delete from operation_participants where weapon_item_id = any($1::int[])`, [ids]);
  await pgQuery(`delete from recipe_ingredients where ingredient_item_id = any($1::int[])`, [ids]);
  await pgQuery(`delete from craft_recipes where item_id = any($1::int[])`, [ids]);
  await pgQuery(`delete from inventory_balance where item_id = any($1::int[])`, [ids]);
  await pgQuery(`delete from item_price_history where item_id = any($1::int[])`, [ids]);
}
