import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { logAdminAction } from "./logging.functions";

export type AdminRecipeRow = {
  recipe_id: number;
  item_id: number;
  item_name: string;
  category: string | null;
  subcategory: string | null;
  recipe_category: string | null;
  tier: string | null;
  ingredients: Array<{ item_id: number; name: string; quantity: number; unit_cost: number }>;
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

type RecipeIngredientAdmin = {
  recipe_id: number;
  ingredient_item_id: number;
  quantity: number;
  ingredient_name: string;
  tier_quantities?: Record<string, number>;
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
  org_buy_enabled: boolean;
  high_demand: boolean;
  high_demand_points: number | null;
  high_demand_reason: string | null;
  high_demand_until: string | null;
  active: boolean;
  in_config: boolean;
  recipe_id: number | null;
  ingredients: RecipeIngredientAdmin[];
};

type ItemPricingInput = {
  name?: string;
  category?: string | null;
  subcategory?: string | null;
  side?: string | null;
  purchase_price?: number | null;
  morador_purchase_price?: number | null;
  min_sale_price?: number | null;
  estimated_value?: number | null;
  xp_points?: number | null;
  org_buy_enabled?: boolean | null;
  high_demand?: boolean | null;
  high_demand_points?: number | null;
  high_demand_reason?: string | null;
  high_demand_until?: string | null;
  active?: boolean | null;
};

type NormalizedItemPricing = {
  name: string;
  category: string;
  subcategory: string | null;
  side: "venda" | "compra" | "ambos";
  purchase_price: number | null;
  morador_purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  xp_points: number;
  org_buy_enabled: boolean;
  high_demand: boolean;
  high_demand_points: number | null;
  high_demand_reason: string | null;
  high_demand_until: string | null;
  active: boolean;
};

const VALID_SIDES = new Set(["venda", "compra", "ambos"]);
const BAIRRISTA_TIERS = ["young_blood", "o_gunao", "gangster_fodido"];

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
function cleanNullableInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor invalido");
  return Math.round(n);
}
function cleanNullableIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Data invalida");
  return date.toISOString();
}
function moneyValue(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value ?? 0) : 0;
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
function normalizeSide(value: unknown): "venda" | "compra" | "ambos" {
  const side = cleanText(value, "venda");
  if (!VALID_SIDES.has(side)) throw new Error("Lado inválido");
  return side as "venda" | "compra" | "ambos";
}
function normalizeItemPricing(input: ItemPricingInput, existing?: Partial<NormalizedItemPricing>): NormalizedItemPricing {
  const name = cleanText(input.name, existing?.name ?? "");
  if (!name) throw new Error("Nome obrigatório");
  const side = normalizeSide(input.side ?? existing?.side ?? "venda");
  const category = inferCategory(name, cleanText(input.category ?? existing?.category, "outros"));
  const subcategory = inferSubcategory(name, category, cleanNullableText(input.subcategory ?? existing?.subcategory));
  const purchase_price = input.purchase_price !== undefined ? cleanMoney(input.purchase_price) : (existing?.purchase_price ?? null);
  let morador_purchase_price = input.morador_purchase_price !== undefined ? cleanMoney(input.morador_purchase_price) : (existing?.morador_purchase_price ?? null);
  let min_sale_price = input.min_sale_price !== undefined ? cleanMoney(input.min_sale_price) : (existing?.min_sale_price ?? null);
  let estimated_value = input.estimated_value !== undefined ? cleanMoney(input.estimated_value) : (existing?.estimated_value ?? null);
  const xp_points = input.xp_points !== undefined ? cleanXp(input.xp_points) : (existing?.xp_points ?? 0);
  const canBeBought = side === "compra" || side === "ambos";
  const org_buy_enabled = canBeBought
    ? (input.org_buy_enabled !== undefined && input.org_buy_enabled !== null ? Boolean(input.org_buy_enabled) : (existing?.org_buy_enabled ?? true))
    : false;
  const requestedHighDemand = input.high_demand !== undefined && input.high_demand !== null ? Boolean(input.high_demand) : (existing?.high_demand ?? false);
  const high_demand = canBeBought && org_buy_enabled && requestedHighDemand;
  const high_demand_points = high_demand
    ? (input.high_demand_points !== undefined ? cleanNullableInt(input.high_demand_points) : (existing?.high_demand_points ?? null))
    : null;
  const high_demand_reason = high_demand
    ? (input.high_demand_reason !== undefined ? cleanNullableText(input.high_demand_reason) : (existing?.high_demand_reason ?? null))
    : null;
  const high_demand_until = high_demand
    ? (input.high_demand_until !== undefined ? cleanNullableIso(input.high_demand_until) : (existing?.high_demand_until ?? null))
    : null;
  const active = input.active !== undefined && input.active !== null ? Boolean(input.active) : (existing?.active ?? true);

  if (side === "compra") { min_sale_price = null; estimated_value = null; }
  if (side === "venda") { morador_purchase_price = null; }
  if (active) {
    if (canBeBought && org_buy_enabled && moneyValue(purchase_price) <= 0 && moneyValue(morador_purchase_price) <= 0) {
      throw new Error("Define pelo menos um preço de compra para este material.");
    }
    if ((side === "venda" || side === "ambos") && moneyValue(min_sale_price) <= 0 && moneyValue(purchase_price) <= 0) {
      throw new Error("Define preço com material ou preço sem material para este item.");
    }
  }
  return {
    name,
    category,
    subcategory,
    side,
    purchase_price,
    morador_purchase_price,
    min_sale_price,
    estimated_value,
    xp_points,
    org_buy_enabled,
    high_demand,
    high_demand_points,
    high_demand_reason,
    high_demand_until,
    active,
  };
}
async function assertManager(context: any) {
  const me = await resolveCurrentMember(context.supabase, context.userId);
  if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");
  return me;
}
async function getOrCreateRecipeId(itemId: number): Promise<number> {
  const existing = await pgOne<{ id: number }>(`select id from craft_recipes where item_id = $1 limit 1`, [itemId]);
  if (existing) return existing.id;
  const inserted = await pgOne<{ id: number }>(`insert into craft_recipes (item_id, quantity) values ($1, 1) returning id`, [itemId]);
  if (!inserted) throw new Error("Erro ao criar receita");
  return inserted.id;
}

export const listRecipesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRecipeRow[]> => {
    await assertManager(context);
    const rows = await pgQuery<any>(
      `select cr.id as recipe_id, out_i.id as item_id, out_i.name as item_name, out_i.category, out_i.subcategory,
              ri.ingredient_item_id, ing_i.name as ingredient_name, ri.quantity::float as quantity, ing_i.estimated_value::float as unit_cost
       from craft_recipes cr
       join items out_i on out_i.id = cr.item_id
       left join recipe_ingredients ri on ri.recipe_id = cr.id
       left join items ing_i on ing_i.id = ri.ingredient_item_id and ing_i.deleted_at is null and coalesce(ing_i.active, true) = true
       where out_i.deleted_at is null and coalesce(out_i.active, true) = true
       order by out_i.category, out_i.name, ing_i.name`,
    );
    const map = new Map<number, AdminRecipeRow>();
    for (const row of rows) {
      if (!map.has(row.recipe_id)) map.set(row.recipe_id, { recipe_id: row.recipe_id, item_id: row.item_id, item_name: row.item_name, category: row.category, subcategory: row.subcategory, recipe_category: row.category, tier: null, ingredients: [] });
      if (row.ingredient_item_id && row.ingredient_name && row.quantity > 0) {
        map.get(row.recipe_id)!.ingredients.push({ item_id: row.ingredient_item_id, name: row.ingredient_name, quantity: Number(row.quantity), unit_cost: moneyValue(row.unit_cost) });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.recipe_category ?? "").localeCompare(b.recipe_category ?? "") || a.item_name.localeCompare(b.item_name));
  });

export const listItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminItemRow[]> => {
    await assertManager(context);
    return pgQuery<AdminItemRow>(
      `select id, name, category, subcategory, estimated_value::float as estimated_value, purchase_price::float as purchase_price, 'unidade'::text as unit
       from items where coalesce(active, true) = true and deleted_at is null order by category, name`,
    );
  });

export const listDbItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDbItemRow[]> => {
    await assertManager(context);
    const rows = await pgQuery<any>(
      `select id, name, category, subcategory, side, purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price, min_sale_price::float as min_sale_price,
              estimated_value::float as estimated_value, xp_points,
              coalesce(org_buy_enabled, true) as org_buy_enabled,
              (coalesce(high_demand, false) and (high_demand_until is null or high_demand_until > now())) as high_demand,
              high_demand_points,
              high_demand_reason,
              high_demand_until,
              coalesce(active, true) as active
       from items where deleted_at is null order by coalesce(active, true) desc, category, name`,
    );
    const recipeRows = await pgQuery<{ recipe_id: number; item_id: number }>(`select id as recipe_id, item_id from craft_recipes`);
    const recipeItemByRecipeId = new Map(recipeRows.map((r) => [r.recipe_id, r.item_id]));
    const recipeMap = new Map<number, { recipe_id: number; ingredients: RecipeIngredientAdmin[] }>();
    for (const recipe of recipeRows) recipeMap.set(recipe.item_id, { recipe_id: recipe.recipe_id, ingredients: [] });
    const ingredientRows = await pgQuery<any>(
      `select ri.recipe_id, ri.ingredient_item_id, ri.quantity::float as quantity, i.name as ingredient_name,
              coalesce(jsonb_object_agg(o.tier, o.quantity) filter (where o.tier is not null), '{}'::jsonb) as tier_quantities
       from recipe_ingredients ri
       join items i on i.id = ri.ingredient_item_id
       left join recipe_ingredient_tier_overrides o on o.recipe_id = ri.recipe_id and o.ingredient_item_id = ri.ingredient_item_id
       where coalesce(i.active, true) = true and i.deleted_at is null
       group by ri.recipe_id, ri.ingredient_item_id, ri.quantity, i.name`,
    ).catch(async () => pgQuery<any>(
      `select ri.recipe_id, ri.ingredient_item_id, ri.quantity::float as quantity, i.name as ingredient_name, '{}'::jsonb as tier_quantities
       from recipe_ingredients ri join items i on i.id = ri.ingredient_item_id
       where coalesce(i.active, true) = true and i.deleted_at is null`,
    ));
    for (const ing of ingredientRows) {
      const itemId = recipeItemByRecipeId.get(ing.recipe_id);
      const recipe = itemId ? recipeMap.get(itemId) : null;
      if (recipe) recipe.ingredients.push({ ...ing, tier_quantities: ing.tier_quantities ?? {} });
    }
    return rows.map((r) => {
      const category = inferCategory(r.name, r.category);
      const subcategory = inferSubcategory(r.name, category, r.subcategory);
      const recipe = recipeMap.get(r.id);
      return { ...r, category, subcategory, side: VALID_SIDES.has(r.side ?? "") ? r.side : "venda", in_config: false, recipe_id: recipe?.recipe_id ?? null, ingredients: recipe?.ingredients ?? [] };
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
    await pgQuery(`update items set ${sets.join(", ")}, updated_at = now() where id = $${vals.length} and deleted_at is null`, vals);
  });

export const updateItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ItemPricingInput & { item_id: number }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await assertManager(context);
    const existing = await pgOne<NormalizedItemPricing>(`select name, category, subcategory, side, purchase_price::float as purchase_price, morador_purchase_price::float as morador_purchase_price, min_sale_price::float as min_sale_price, estimated_value::float as estimated_value, xp_points, coalesce(org_buy_enabled, true) as org_buy_enabled, coalesce(high_demand, false) as high_demand, high_demand_points, high_demand_reason, high_demand_until, coalesce(active, true) as active from items where id = $1 and deleted_at is null`, [data.item_id]);
    if (!existing) throw new Error("Item não encontrado");
    const item = normalizeItemPricing(data, existing);
    await pgQuery(`update items set name = $2, category = $3, subcategory = $4, side = $5, purchase_price = $6, morador_purchase_price = $7, min_sale_price = $8, estimated_value = $9, xp_points = $10, active = $11, org_buy_enabled = $12, high_demand = $13, high_demand_points = $14, high_demand_reason = $15, high_demand_until = $16::timestamptz, high_demand_updated_at = now(), updated_at = now() where id = $1 and deleted_at is null`, [data.item_id, item.name, item.category, item.subcategory, item.side, item.purchase_price, item.morador_purchase_price, item.min_sale_price, item.estimated_value, item.xp_points, item.active, item.org_buy_enabled, item.high_demand, item.high_demand_points, item.high_demand_reason, item.high_demand_until]);
    await logAdminAction(context.supabase, { action: "item_updated", actorId: context.userId, actorName: me.display_name ?? "Direção", targetType: "item", targetId: data.item_id, details: `Item atualizado: ${item.name}`, afterState: item });
  });

export const createItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ItemPricingInput & { name: string; category: string }) => {
    if (!cleanText(d.name)) throw new Error("Nome obrigatório");
    if (!cleanText(d.category)) throw new Error("Categoria obrigatória");
    return d;
  })
  .handler(async ({ context, data }): Promise<{ id: number }> => {
    const me = await assertManager(context);
    const item = normalizeItemPricing(data, { active: true });
    const existing = await pgOne<{ id: number; active: boolean | null; deleted_at: string | null }>(`select id, active, deleted_at from items where lower(name) = lower($1) order by id desc limit 1`, [item.name]);
    if (existing?.deleted_at) {
      await pgQuery(`update items set category = $2, subcategory = $3, side = $4, purchase_price = $5, morador_purchase_price = $6, min_sale_price = $7, estimated_value = $8, xp_points = $9, org_buy_enabled = $10, high_demand = $11, high_demand_points = $12, high_demand_reason = $13, high_demand_until = $14::timestamptz, high_demand_updated_at = now(), active = true, deleted_at = null, updated_at = now() where id = $1`, [existing.id, item.category, item.subcategory, item.side, item.purchase_price, item.morador_purchase_price, item.min_sale_price, item.estimated_value, item.xp_points, item.org_buy_enabled, item.high_demand, item.high_demand_points, item.high_demand_reason, item.high_demand_until]);
      return { id: existing.id };
    }
    if (existing) throw new Error("Já existe um material com esse nome.");
    const result = await pgOne<{ id: number }>(`insert into items (name, category, subcategory, side, purchase_price, morador_purchase_price, min_sale_price, estimated_value, xp_points, org_buy_enabled, high_demand, high_demand_points, high_demand_reason, high_demand_until, high_demand_updated_at, active) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz,now(),true) returning id`, [item.name, item.category, item.subcategory, item.side, item.purchase_price, item.morador_purchase_price, item.min_sale_price, item.estimated_value, item.xp_points, item.org_buy_enabled, item.high_demand, item.high_demand_points, item.high_demand_reason, item.high_demand_until]);
    if (!result) throw new Error("Erro ao criar item");
    await logAdminAction(context.supabase, { action: "item_created", actorId: context.userId, actorName: me.display_name ?? "Direção", targetType: "item", targetId: result.id, details: `Material criado: ${item.name}`, afterState: item });
    return { id: result.id };
  });

export const getMaterialItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context);
    return pgQuery<{ id: number; name: string; category: string | null; purchase_price: number | null }>(`select id, name, category, purchase_price::float as purchase_price from items where coalesce(active, true)=true and deleted_at is null and coalesce(org_buy_enabled, true)=true and coalesce(side,'compra') in ('compra','ambos') order by category, name`);
  });

export const updateItemRecipeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; ingredients: Array<{ ingredient_item_id: number; quantity: number; tier_quantities?: Record<string, number> }> }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    if (!Array.isArray(d.ingredients)) throw new Error("ingredients inválido");
    for (const ing of d.ingredients) {
      if (!Number.isFinite(ing.ingredient_item_id) || ing.ingredient_item_id <= 0) throw new Error("ingredient_item_id inválido");
      if (!Number.isFinite(ing.quantity) || ing.quantity < 0) throw new Error("quantidade inválida");
      for (const [tier, qty] of Object.entries(ing.tier_quantities ?? {})) {
        if (!BAIRRISTA_TIERS.includes(tier)) continue;
        if (!Number.isFinite(Number(qty)) || Number(qty) < 0) throw new Error("quantidade por cargo inválida");
      }
    }
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    await assertManager(context);
    const output = await pgOne<{ id: number; side: string | null; name: string }>(`select id, side, name from items where id=$1 and coalesce(active,true)=true and deleted_at is null`, [data.item_id]);
    if (!output) throw new Error("Item não encontrado");
    if (output.side === "compra") throw new Error("Itens de compra não têm receita.");
    const aggregated = new Map<number, { quantity: number; tier_quantities: Record<string, number> }>();
    for (const ing of data.ingredients) {
      if (ing.ingredient_item_id === data.item_id) throw new Error("Um item não pode ser ingrediente de si próprio.");
      if (ing.quantity > 0) {
        const prev = aggregated.get(ing.ingredient_item_id) ?? { quantity: 0, tier_quantities: {} };
        prev.quantity += Math.round(Number(ing.quantity));
        for (const tier of BAIRRISTA_TIERS) {
          const val = ing.tier_quantities?.[tier];
          if (val != null && Number(val) > 0) prev.tier_quantities[tier] = Math.round(Number(val));
        }
        aggregated.set(ing.ingredient_item_id, prev);
      }
    }
    if (aggregated.size > 0) {
      const validRows = await pgQuery<{ id: number }>(`select id from items where id = any($1::int[]) and coalesce(active,true)=true and deleted_at is null and coalesce(org_buy_enabled, true)=true and coalesce(side,'compra') in ('compra','ambos')`, [Array.from(aggregated.keys())]);
      const valid = new Set(validRows.map((r) => r.id));
      for (const id of aggregated.keys()) if (!valid.has(id)) throw new Error("A receita só pode usar materiais ativos de compra/ambos.");
    }
    const recipeId = await getOrCreateRecipeId(data.item_id);
    await pgQuery(`delete from recipe_ingredient_tier_overrides where recipe_id = $1`, [recipeId]).catch(() => undefined);
    await pgQuery(`delete from recipe_ingredients where recipe_id = $1`, [recipeId]);
    for (const [ingredientId, cfg] of aggregated.entries()) {
      await pgQuery(`insert into recipe_ingredients (recipe_id, ingredient_item_id, quantity) values ($1,$2,$3)`, [recipeId, ingredientId, cfg.quantity]);
      for (const [tier, qty] of Object.entries(cfg.tier_quantities)) {
        if (qty === cfg.quantity) continue;
        await pgQuery(`insert into recipe_ingredient_tier_overrides (recipe_id, ingredient_item_id, tier, quantity) values ($1,$2,$3,$4)`, [recipeId, ingredientId, tier, qty]).catch(() => undefined);
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
    await assertManager(context);
    if (data.ingredient_item_id === data.item_id) throw new Error("Um item não pode ser ingrediente de si próprio.");
    const output = await pgOne<{ id: number; side: string | null }>(`select id, side from items where id=$1 and coalesce(active,true)=true and deleted_at is null`, [data.item_id]);
    if (!output || output.side === "compra") throw new Error("Item de saída inválido para receita.");
    const recipeId = await getOrCreateRecipeId(data.item_id);
    await pgQuery(`delete from recipe_ingredients where recipe_id=$1 and ingredient_item_id=$2`, [recipeId, data.ingredient_item_id]);
    await pgQuery(`delete from recipe_ingredient_tier_overrides where recipe_id=$1 and ingredient_item_id=$2`, [recipeId, data.ingredient_item_id]).catch(() => undefined);
    if (data.quantity > 0) await pgQuery(`insert into recipe_ingredients (recipe_id, ingredient_item_id, quantity) values ($1,$2,$3)`, [recipeId, data.ingredient_item_id, Math.round(Number(data.quantity))]);
  });

export const deleteItemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    return d;
  })
  .handler(async ({ context, data }): Promise<void> => {
    const me = await assertManager(context);
    const item = await pgOne<{ name: string }>(`select name from items where id=$1`, [data.item_id]);
    await deleteItemsByIds([data.item_id]);
    await logAdminAction(context.supabase, { action: "item_deleted", actorId: context.userId, actorName: me.display_name ?? "Direção", targetType: "item", targetId: data.item_id, details: `Material desativado: ${item?.name ?? "#" + data.item_id}` });
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
    await logAdminAction(context.supabase, { action: "item_deleted", actorId: context.userId, actorName: me.display_name ?? "Direção", targetType: "item", targetId: data.item_ids.join(","), details: `${data.item_ids.length} materiais desativados: ${items.map((i) => i.name).join(", ")}` });
  });

async function deleteItemsByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const pendingOrders = await pgOne<{ count: string }>(`select count(*)::text as count from orders where item_id = any($1::int[]) and status in ('pending','approved','in_progress','ready')`, [ids]);
  if (Number(pendingOrders?.count ?? 0) > 0) throw new Error(`Não é possível eliminar: existem ${pendingOrders?.count} encomenda(s) pendente(s) associadas a estes materiais. Resolve as encomendas primeiro.`);
  await pgQuery(`update items set active = false, deleted_at = now(), updated_at = now() where id = any($1::int[])`, [ids]);
}
