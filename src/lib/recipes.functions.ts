import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { REAL_UNIT_COST, getWeaponSalePrice, getMagazineSalePrice, getTierPrice } from "./pricing.catalog";
import { logger } from "./logger.server";
import { isOrangeWeapon } from "./armory.catalog";

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
    const rows = await pgQuery<{
      recipe_id: number;
      item_id: number;
      item_name: string;
      category: string | null;
      subcategory: string | null;
      tier: string | null;
      unit: string | null;
      estimated_value: string | null;
      min_sale_price: string | null;
      ing_item_id: number | null;
      ing_name: string | null;
      ing_category: string | null;
      ing_subcategory: string | null;
      quantity: number | null;
      unit_cost: string | null;
      recipe_category: string | null;
    }>(
      `select r.id as recipe_id, r.item_id, i.name as item_name, i.category, i.subcategory, r.tier, i.unit,
              r.category as recipe_category,
              i.estimated_value,
              i.min_sale_price,
              ri.ingredient_item_id as ing_item_id,
              ii.name as ing_name,
              ii.category as ing_category,
              ii.subcategory as ing_subcategory,
              ri.quantity,
              case ii.name
                when 'Corpo Mini SMG' then 8000
                when 'Corpo Pistol XM3' then 8000
                when 'Corpo Micro SMG' then 10000
                when 'Corpo TEC-9' then 10000
                when 'Corpo TEC Pistol' then 15000
                when 'Corpo AP Pistol' then 15000
                else coalesce(ii.purchase_price, 0)
              end as unit_cost
         from craft_recipes r
         join items i on i.id = r.item_id
         left join recipe_ingredients ri on ri.recipe_id = r.id
         left join items ii on ii.id = ri.ingredient_item_id
        where i.deleted_at is null
        order by i.name, ri.id`,
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
          subcategory: r.subcategory,
          tier: r.tier,
          unit: r.unit,
          ingredients: [],
          total_cost: 0,
          estimated_value: Number(r.estimated_value ?? 0),
          min_sale_price: r.min_sale_price != null ? Number(r.min_sale_price) : null,
          tier_price: null,
          margin: 0,
          margin_pct: null,
          recipe_category: r.recipe_category,
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
          category: r.ing_category,
          subcategory: r.ing_subcategory,
        });
        recipe.total_cost += line;
      }
    }
    for (const r of map.values()) {
      const realCost = REAL_UNIT_COST[r.item_name] ?? r.total_cost;
      r.total_cost = realCost;
      const basePrice = r.min_sale_price ?? r.estimated_value;
      let tierPrice = basePrice;

      // Corpos e prints mantêm sempre o preço base
      const isBodyOrPrint = /\bcorpo\b|\bprint\b/i.test(r.item_name);

      // Aplica acréscimo por tier a armas de fogo
      if (!isBodyOrPrint && (
        r.category === "armas_red" ||
        r.category === "armas_orange" ||
        r.subcategory === "armas_red" ||
        r.subcategory === "armas_orange" ||
        /mini smg|xm3|micro smg|tec-9|tec pistol|ap pistol|compact rifle|heavy|\.50|p90|pdw|bullpup|carabina/i.test(r.item_name)
      )) {
        tierPrice = getWeaponSalePrice(basePrice, me?.tier ?? null);
      }

      // Aplica preço por tier a carregadores
      if (r.subcategory === "carregadores" || r.category === "municoes") {
        const magTier = r.item_name.toLowerCase().includes("special")
          ? "special"
          : r.item_name.toLowerCase().includes("red")
            ? "red"
            : "orange";
        tierPrice = getMagazineSalePrice(magTier, me?.tier ?? null);
      }

      r.tier_price = tierPrice;
      const margin = tierPrice - realCost;
      const pct = realCost > 0 ? (margin / realCost) * 100 : null;
      // margem só vai no payload se for chefia
      r.margin = isManager ? margin : 0;
      r.margin_pct = isManager ? pct : null;
    }
    return [...map.values()].sort(
      (a, b) => b.estimated_value - a.estimated_value,
    );
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
    const head = await pgOne<{ item_name: string; tier: string | null; subcategory: string | null; estimated_value: number | null; min_sale_price: number | null }>(
      `select i.name as item_name, r.tier, i.subcategory, i.estimated_value::float as estimated_value, i.min_sale_price::float as min_sale_price
       from craft_recipes r join items i on i.id = r.item_id where r.id = $1`,
      [data.recipe_id],
    );
    const isOrange = (head?.tier === "orange") || (head?.subcategory === "armas_orange");
    const ings = await pgQuery<{
      name: string;
      quantity: number;
      unit_cost: string | null;
    }>(
      `select ii.name, ri.quantity, coalesce(ii.purchase_price, ii.estimated_value, 0) as unit_cost
         from recipe_ingredients ri
         join items ii on ii.id = ri.ingredient_item_id
        where ri.recipe_id = $1`,
      [data.recipe_id],
    );
    let total_cost = 0;
    const ingredients: CraftFeasibility["ingredients"] = [];
    for (const ing of ings) {
      const needed = Number(ing.quantity) * data.quantity;
      const unitCost = Number(ing.unit_cost ?? 0);
      const lineCost = needed * unitCost;
      total_cost += lineCost;
      // Orange weapons: only show Peças as material, everything else is included in dirty money
      if (isOrange) {
        if (ing.name.toLowerCase().includes("peça")) {
          ingredients.push({ name: ing.name, needed, qty_per_recipe: Number(ing.quantity), unit_cost: unitCost, line_cost: lineCost });
        }
      } else {
        ingredients.push({ name: ing.name, needed, qty_per_recipe: Number(ing.quantity), unit_cost: unitCost, line_cost: lineCost });
      }
    }
    const itemPrice = (head?.estimated_value ?? 0) * data.quantity;
    const dirty_money = itemPrice;
    const tier_price = getTierPrice(head?.item_name ?? "", head?.min_sale_price ?? 0, me?.tier ?? null);
    return {
      recipe_id: data.recipe_id,
      item_name: head?.item_name ?? "?",
      requested_qty: data.quantity,
      dirty_money,
      min_sale_price: head?.min_sale_price ?? null,
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
      const itemIds = data.lines.map((l) => l.item_id);
      // Single query: recipes + ingredients for all requested items
      const rows = await pgQuery<{
        item_id: number;
        item_name: string;
        recipe_id: number;
        tier: string | null;
        subcategory: string | null;
        estimated_value: number | null;
        ing_name: string | null;
        ing_qty: number | null;
        unit_cost: number | null;
      }>(
        `select i.id as item_id, i.name as item_name, r.id as recipe_id, r.tier, i.subcategory,
                i.estimated_value::float as estimated_value,
                ii.name as ing_name, ri.quantity as ing_qty,
                coalesce(ii.purchase_price, ii.estimated_value, 0)::float as unit_cost
         from craft_recipes r
         join items i on i.id = r.item_id
         left join recipe_ingredients ri on ri.recipe_id = r.id
         left join items ii on ii.id = ri.ingredient_item_id
         where i.id = any($1)`,
        [itemIds],
      );

      const recipeMap = new Map<number, { item_name: string; tier: string | null; subcategory: string | null; estimated_value: number | null }>();
      const allIngredients = new Map<string, { name: string; needed: number; qty_per_recipe: number; unit_cost: number; line_cost: number }>();
      let dirty_money = 0;
      let full_material_cost = 0;
      const items: CraftFeasibilityBatch["items"] = [];

      for (const line of data.lines) {
        // Find recipe data for this line
        const recipeRows = rows.filter((r) => r.item_id === line.item_id);
        if (recipeRows.length === 0) {
          continue;
        }

        const recipe = recipeRows[0];
        items.push({ item_name: recipe.item_name, requested_qty: line.quantity });

        const isOrange = (recipe.tier === "orange") || (recipe.subcategory === "armas_orange") || isOrangeWeapon(recipe.item_name);
        const itemPrice = (recipe.estimated_value ?? 0) * line.quantity;
        dirty_money += itemPrice;

        for (const row of recipeRows) {
          if (!row.ing_name || row.ing_qty == null) continue;
          const needed = Number(row.ing_qty) * line.quantity;
          const unitCost = Number(row.unit_cost ?? 0);
          const lineCost = needed * unitCost;
          full_material_cost += lineCost;

          if (isOrange && !row.ing_name.toLowerCase().includes("peça")) continue;

          const existing = allIngredients.get(row.ing_name);
          if (existing) {
            existing.needed += needed;
            existing.line_cost += lineCost;
          } else {
            allIngredients.set(row.ing_name, {
              name: row.ing_name,
              needed,
              qty_per_recipe: Number(row.ing_qty),
              unit_cost: unitCost,
              line_cost: lineCost,
            });
          }
        }
      }

      const result = {
        dirty_money,
        full_material_cost,
        ingredients: Array.from(allIngredients.values()),
        items,
      };
      return result;
    } catch (e: any) {
      logger.error("computeCraftFeasibilityBatch_error", { error: e instanceof Error ? e.message : String(e) });
      throw new Error("Erro ao calcular materiais: " + (e?.message ?? "Erro desconhecido"));
    }
  });
