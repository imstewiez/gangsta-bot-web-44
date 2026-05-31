import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { logAdminAction } from "./logging.functions";
import { getAllRecipes, getItemById, getNumericId, getAllItems } from "./config.loader";

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

type AdminDbItemRow = {
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
  in_config: boolean;
  recipe_id: number | null;
  ingredients: Array<{
    recipe_id: number;
    ingredient_item_id: number;
    quantity: number;
    ingredient_name: string;
  }>;
};

const VALID_SIDES = new Set(["venda", "compra", "ambos"]);

function cleanText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function cleanNullableText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function cleanMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor/preço inválido");
  return Math.round(n);
}

function cleanXp(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("XP inválido");
  return Math.round(n);
}

function inferCategory(name: string, category?: string | null): string {
  const n = name.toLowerCase();
  if (n.includes("colete")) return "coletes";
  if (category && category !== "equipamento") return category;
  return category || "outros";
}

function inferSubcategory(name: string, category: string, subcategory?: string | null): string | null {
  const n = name.toLowerCase();
  if (n.includes("colete")) return "coletes";
  return subcategory ?? (category === "coletes" ? "coletes" : null);
}

async function assertManager(context: any) {
  const me = await resolveCurrentMember(context.supabase, context.userId);
  if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");
  return me;
}

export const listRecipesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRecipeRow[]> => {
    await assertManager(context);

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
          quantity: Number(qty),
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
    await assertManager(context);
    const rows = await pgQuery<AdminItemRow>(
      `select id, name, category, subcategory,
              estimated_value::float as estimated_value,
              purchase_price::float as purchase_price,
              'unidade'::text as unit
       from items
       where coalesce(active, true) = true and deleted_at is null
       order by category, name`,
    );
    return rows;
  });

export const listDbItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDbItemRow[]> => {
    await assertManager(context);

    const configItems = getAllItems();
    const configNames = new Set(Object.values(configItems).map((i) => i.name));
    const configRecipes = getAllRecipes();

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
              xp_points,
              coalesce(active, true) as active
       from items
       where deleted_at is null
       order by coalesce(active, true) desc, category, name`,
    );

    const dbIdByName = new Map(rows.map((r) => [r.name, r.id]));

    const recipeRows = await pgQuery<{ recipe_id: number; item_id: number }>(
      `select id as recipe_id, item_id from craft_recipes`,
    );
    const recipeItemByRecipeId = new Map(recipeRows.map((r) => [r.recipe_id, r.item_id]));

    const ingredientRows = await pgQuery<{
      recipe_id: number;
      ingredient_item_id: number;
      quantity: number;
      ingredient_name: string;
    }>(
      `select ri.recipe_id, ri.ingredient_item_id, ri.quantity::float as quantity, i.name as ingredient_name
       from recipe_ingredients ri
       join items i on i.id = ri.ingredient_item_id`,
    );

    const recipeMap = new Map<number, { recipe_id: number; ingredients: typeof ingredientRows }>();
    for (const r of recipeRows) {
      recipeMap.set(r.item_id, { recipe_id: r.recipe_id, ingredients: [] });
    }
    for (const ing of ingredientRows) {
      const itemId = recipeItemByRecipeId.get(ing.recipe_id);
      if (!itemId) continue;
      const rec = recipeMap.get(itemId);
      if (rec) rec.ingredients.push(ing);
    }

    for (const recipe of Object.values(configRecipes)) {
      const outputItem = configItems[recipe.output];
      if (!outputItem) continue;
      const outputDbId = dbIdByName.get(outputItem.name);
      if (!outputDbId || recipeMap.has(outputDbId)) continue;

      const syntheticIngredients = [];
      for (const [ingConfigId, qty] of Object.entries(recipe.inputs)) {
        const ingItem = configItems[ingConfigId];
        if (!ingItem) continue;
        const ingDbId = dbIdByName.get(ingItem.name);
        if (!ingDbId) continue;
        syntheticIngredients.push({
          recipe_id: -1,
          ingredient_item_id: ingDbId,
          quantity: Number(qty),
          ingredient_name: ingItem.name,
        });
      }

      recipeMap.set(outputDbId, { recipe_id: -1, ingredients: syntheticIngredients });
    }

    return rows.map((r) => {
      const category = inferCategory(r.name, r.category);
      const subcategory = inferSubcategory(r.name, category, r.subcategory);
      const recipe = recipeMap.get(r.id);
      return {
        ...r,
        category,
        subcategory,
        side: VALID_SIDES.has(r.side ?? "") ? r.side : "venda",
        in_config: configNames.has(r.name),
        recipe_id: recipe && recipe.recipe_id > 0 ? recipe.recipe_id : null,
        ingredients: recipe?.ingredients ?? [],
      };
    });
  });

export const updateItemPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; estimated_value?: number; purchase_price?: number; min_sale_price?: number; xp_points?: number }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    await assertManager(context);
    const sets: string[] = [];
    const vals: (number | string | null)[] = [];
    if (data.estimated_value !== undefined) { sets.push(`estimated_value = $${sets.length + 1}`); vals.push(cleanMoney(data.estimated_value)); }
    if (data.purchase_price !== undefined) { sets.push(`purchase_price = $${sets.length + 1}`); vals.push(cleanMoney(data.purchase_price)); }
    if (data.min_sale_price !== undefined) { sets.push(`min_sale_price = $${sets.length + 1}`); vals.push(cleanMoney(data.min_sale_price)); }
    if (data.xp_points !== undefined) { sets.push(`xp_points = $${sets.length + 1}`); vals.push(cleanXp(data.xp_points)); }
    if (sets.length === 0) return;
    vals.push(data.item_id);
    await pgQuery(`update items set ${sets.join(", ")}, updated_at = now() where id = $${vals.length}`, vals);
  });

export const updateItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    item_id: number;
    name?: string;
    category?: string;
    subcategory?: string | null;
    side?: string;
    purchase_price?: number | null;
    morador_purchase_price?: number | null;
    min_sale_price?: number | null;
    estimated_value?: number | null;
    xp_points?: number;
    active?: boolean;
  }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await assertManager(context);

    const name = data.name !== undefined ? cleanText(data.name) : undefined;
    const category = data.category !== undefined ? inferCategory(name ?? "", cleanText(data.category, "outros")) : undefined;
    const subcategory = data.subcategory !== undefined || category !== undefined
      ? inferSubcategory(name ?? "", category ?? "outros", cleanNullableText(data.subcategory))
      : undefined;
    const side = data.side !== undefined ? cleanText(data.side, "venda") : undefined;
    if (side !== undefined && !VALID_SIDES.has(side)) throw new Error("Lado inválido");

    const sets: string[] = [];
    const vals: (number | string | boolean | null)[] = [];
    if (name !== undefined) { sets.push(`name = $${sets.length + 1}`); vals.push(name); }
    if (category !== undefined) { sets.push(`category = $${sets.length + 1}`); vals.push(category); }
    if (subcategory !== undefined) { sets.push(`subcategory = $${sets.length + 1}`); vals.push(subcategory); }
    if (side !== undefined) { sets.push(`side = $${sets.length + 1}`); vals.push(side); }
    if (data.purchase_price !== undefined) { sets.push(`purchase_price = $${sets.length + 1}`); vals.push(cleanMoney(data.purchase_price)); }
    if (data.morador_purchase_price !== undefined) { sets.push(`morador_purchase_price = $${sets.length + 1}`); vals.push(cleanMoney(data.morador_purchase_price)); }
    if (data.min_sale_price !== undefined) { sets.push(`min_sale_price = $${sets.length + 1}`); vals.push(cleanMoney(data.min_sale_price)); }
    if (data.estimated_value !== undefined) { sets.push(`estimated_value = $${sets.length + 1}`); vals.push(cleanMoney(data.estimated_value)); }
    if (data.xp_points !== undefined) { sets.push(`xp_points = $${sets.length + 1}`); vals.push(cleanXp(data.xp_points)); }
    if (data.active !== undefined) { sets.push(`active = $${sets.length + 1}`); vals.push(Boolean(data.active)); }
    if (sets.length === 0) return;

    vals.push(data.item_id);
    await pgQuery(`update items set ${sets.join(", ")}, updated_at = now() where id = $${vals.length}`, vals);
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
    subcategory?: string | null;
    side?: string;
    purchase_price?: number | null;
    morador_purchase_price?: number | null;
    min_sale_price?: number | null;
    estimated_value?: number | null;
    xp_points?: number;
  }) => {
    if (!cleanText(d.name)) throw new Error("Nome obrigatório");
    if (!cleanText(d.category)) throw new Error("Categoria obrigatória");
    return d;
  })
  .handler(async ({ context, data }): Promise<{ id: number }> => {
    const me = await assertManager(context);
    const name = cleanText(data.name);
    const category = inferCategory(name, cleanText(data.category, "outros"));
    const subcategory = inferSubcategory(name, category, cleanNullableText(data.subcategory));
    const side = cleanText(data.side, "venda");
    if (!VALID_SIDES.has(side)) throw new Error("Lado inválido");

    const existing = await pgOne<{ id: number; active: boolean | null; deleted_at: string | null }>(
      `select id, active, deleted_at from items where lower(name) = lower($1) order by id desc limit 1`,
      [name],
    );
    if (existing?.deleted_at) {
      await pgQuery(
        `update items set category = $2, subcategory = $3, side = $4,
             purchase_price = $5, morador_purchase_price = $6, min_sale_price = $7,
             estimated_value = $8, xp_points = $9, active = true, deleted_at = null, updated_at = now()
         where id = $1`,
        [
          existing.id,
          category,
          subcategory,
          side,
          cleanMoney(data.purchase_price),
          cleanMoney(data.morador_purchase_price),
          cleanMoney(data.min_sale_price),
          cleanMoney(data.estimated_value),
          cleanXp(data.xp_points),
        ],
      );
      return { id: existing.id };
    }
    if (existing) throw new Error("Já existe um material com esse nome.");

    const result = await pgOne<{ id: number }>(
      `insert into items
         (name, category, subcategory, side, purchase_price, morador_purchase_price, min_sale_price, estimated_value, xp_points, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       returning id`,
      [
        name,
        category,
        subcategory,
        side,
        cleanMoney(data.purchase_price),
        cleanMoney(data.morador_purchase_price),
        cleanMoney(data.min_sale_price),
        cleanMoney(data.estimated_value),
        cleanXp(data.xp_points),
      ],
    );
    if (!result) throw new Error("Erro ao criar item");
    await logAdminAction(context.supabase, {
      action: "item_created",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: result.id,
      details: `Material criado: ${name}`,
      afterState: { name, category, side },
    });
    return { id: result.id };
  });

export const getMaterialItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context);
    return pgQuery<{
      id: number;
      name: string;
      category: string | null;
      purchase_price: number | null;
    }>(
      `select id, name, category, purchase_price::float as purchase_price
       from items
       where coalesce(active, true) = true
         and deleted_at is null
         and coalesce(side, 'compra') in ('compra', 'ambos')
       order by category, name`,
    );
  });

export const updateItemRecipeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    item_id: number;
    ingredients: Array<{ ingredient_item_id: number; quantity: number }>;
  }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    if (!Array.isArray(d.ingredients)) throw new Error("ingredients inválido");
    for (const ing of d.ingredients) {
      if (!Number.isFinite(ing.ingredient_item_id) || ing.ingredient_item_id <= 0) throw new Error("ingredient_item_id inválido");
      if (!Number.isFinite(ing.quantity) || ing.quantity < 0) throw new Error("quantidade inválida");
    }
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    await assertManager(context);
    const existing = await pgOne<{ id: number }>(`select id from craft_recipes where item_id = $1 limit 1`, [data.item_id]);
    let recipeId: number;
    if (existing) recipeId = existing.id;
    else {
      const inserted = await pgOne<{ id: number }>(`insert into craft_recipes (item_id, quantity) values ($1, 1) returning id`, [data.item_id]);
      if (!inserted) throw new Error("Erro ao criar receita");
      recipeId = inserted.id;
    }
    await pgQuery(`delete from recipe_ingredients where recipe_id = $1`, [recipeId]);
    for (const ing of data.ingredients) {
      if (ing.quantity > 0) {
        await pgQuery(`insert into recipe_ingredients (recipe_id, ingredient_item_id, quantity) values ($1, $2, $3)`, [recipeId, ing.ingredient_item_id, ing.quantity]);
      }
    }
  });

export const updateRecipeIngredientQty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; ingredient_item_id: number; quantity: number }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    if (!Number.isFinite(d.ingredient_item_id) || d.ingredient_item_id <= 0) throw new Error("ingredient_item_id inválido");
    if (!Number.isFinite(d.quantity) || d.quantity < 0) throw new Error("quantidade inválida");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    await updateItemRecipeAdmin({ data: { item_id: data.item_id, ingredients: [{ ingredient_item_id: data.ingredient_item_id, quantity: data.quantity }] } } as never);
  });

export const deleteItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await assertManager(context);
    const item = await pgOne<{ name: string }>(`select name from items where id = $1`, [data.item_id]);
    await deleteItemsByIds([data.item_id]);
    await logAdminAction(context.supabase, {
      action: "item_deleted",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: data.item_id,
      details: `Material desativado: ${item?.name ?? "#" + data.item_id}`,
    });
  });

export const deleteItemsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_ids: number[] }) => {
    if (!Array.isArray(d.item_ids) || d.item_ids.length === 0) throw new Error("item_ids inválido");
    if (!d.item_ids.every((id) => Number.isFinite(id) && id > 0)) throw new Error("item_ids contém IDs inválidos");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await assertManager(context);
    const items = await pgQuery<{ id: number; name: string }>(`select id, name from items where id = any($1::int[])`, [data.item_ids]);
    await deleteItemsByIds(data.item_ids);
    await logAdminAction(context.supabase, {
      action: "item_deleted",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: data.item_ids.join(","),
      details: `${data.item_ids.length} materiais desativados: ${items.map((i) => i.name).join(", ")}`,
    });
  });

async function deleteItemsByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const pendingOrders = await pgOne<{ count: string }>(
    `select count(*)::text as count from orders where item_id = any($1::int[]) and status in ('pending','approved','in_progress','ready')`,
    [ids],
  );
  if (Number(pendingOrders?.count ?? 0) > 0) {
    throw new Error(`Não é possível eliminar: existem ${pendingOrders?.count} encomenda(s) pendente(s) associadas a estes materiais. Resolve as encomendas primeiro.`);
  }

  // Soft delete only. Do not delete movements/history; production data must stay auditable.
  await pgQuery(`update items set active = false, deleted_at = now(), updated_at = now() where id = any($1::int[])`, [ids]);
}
