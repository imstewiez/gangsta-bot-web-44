import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { IdSchema } from "./security";
import { getAllItems, getAllRecipes, getItemById } from "./config.loader";
import { resolveItemPrices } from "./pricing.resolver";

async function gateInventory(supabase: unknown, userId: string) {
  const me = await resolveCurrentMember(supabase as never, userId);
  if (!me?.can_see_inventory) throw new Error("Sem acesso ao armazém.");
  return me;
}

function getRecipeIngredientNames(): Set<string> {
  const recipes = getAllRecipes();
  const names = new Set<string>();
  for (const recipe of Object.values(recipes)) {
    for (const ingId of Object.keys(recipe.inputs)) {
      const item = getItemById(ingId);
      if (item) names.add(item.name);
    }
  }
  return names;
}

function isInventoryVisible(
  side: string | null | undefined,
  itemName: string,
  itemByName: Map<string, { side?: string }>,
  recipeIngredients: Set<string>,
): boolean {
  const effectiveSide = side ?? itemByName.get(itemName)?.side ?? "venda";
  if (effectiveSide === "venda" || effectiveSide === "ambos") return true;
  if (effectiveSide === "compra" && recipeIngredients.has(itemName)) return true;
  return false;
}

export type StockRow = {
  item_id: number;
  item_name: string;
  category: string | null;
  subcategory: string | null;
  qty: number;
  unit_price: number | null;
};

export const getStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StockRow[]> => {
    await gateInventory(context.supabase, context.userId);
    const items = getAllItems();
    const itemNames = Object.values(items).map((i) => i.name);
    const recipeIngredients = getRecipeIngredientNames();

    // Map config names to real DB IDs + side + prices (DB é espelho do config)
    const dbItems = await pgQuery<{
      id: number; name: string; side: string | null;
      purchase_price: number | null; min_sale_price: number | null; estimated_value: number | null;
    }>(
      `select id, name, side,
              purchase_price::float as purchase_price,
              min_sale_price::float as min_sale_price,
              estimated_value::float as estimated_value
       from items where name = any($1::text[])`,
      [itemNames],
    );
    const dbByName = new Map(dbItems.map((i) => [i.name, i]));
    const itemByName = new Map(Object.entries(items).map(([, v]) => [v.name, v]));
    const dbIds = dbItems
      .filter((i) => isInventoryVisible(i.side, i.name, itemByName, recipeIngredients))
      .map((i) => i.id);

    if (dbIds.length === 0) return [];

    const balances = await pgQuery<{
      item_id: number;
      balance: number;
    }>(
      `select i.id as item_id, coalesce(ib.balance, 0)::float as balance
       from items i
       left join inventory_balance ib on ib.item_id = i.id
       where i.id = any($1::int[])
       order by i.purchase_price desc nulls last`,
      [dbIds],
    );

    const balanceMap = new Map(balances.map((b) => [b.item_id, b.balance]));

    return Object.values(items)
      .map((item) => {
        const db = dbByName.get(item.name);
        if (!db) return null;
        if (!isInventoryVisible(db.side, item.name, itemByName, recipeIngredients)) return null;
        const prices = resolveItemPrices(db, item);
        return {
          item_id: db.id,
          item_name: item.name,
          category: item.category ?? null,
          subcategory: item.subcategory ?? null,
          qty: balanceMap.get(db.id) ?? 0,
          unit_price: prices.purchase_price ?? prices.estimated_value ?? null,
        };
      })
      .filter(Boolean) as StockRow[];
  });

export type LedgerRow = {
  id: number;
  type: string;
  item_id: number | null;
  item_name: string | null;
  qty: number;
  member_id: number | null;
  member_name: string | null;
  created_at: string;
  notes: string | null;
};

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; new_qty: number }) => {
    return z
      .object({
        item_id: IdSchema,
        new_qty: z.number().finite(),
      })
      .parse(d);
  })
  .handler(async ({ data, context }) => {
    await gateInventory(context.supabase, context.userId);
    const result = await pgOne<{ sp_adjust_stock: number }>(
      `SELECT public.sp_adjust_stock($1, $2, $3, $4) as sp_adjust_stock`,
      [data.item_id, data.new_qty, `web:${context.userId}`, null],
    );
    return { ok: true, delta: result?.sp_adjust_stock ?? 0 };
  });

export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { limit?: number; type?: string | null }) => ({
      limit: Math.min(Math.max(d?.limit ?? 100, 1), 500),
      type: z.string().max(50).nullable().optional().parse(d?.type) ?? null,
    }),
  )
  .handler(async ({ data, context }): Promise<LedgerRow[]> => {
    await gateInventory(context.supabase, context.userId);
    const items = getAllItems();
    const itemNames = Object.values(items).map((i) => i.name);
    const recipeIngredients = getRecipeIngredientNames();
    const itemByName = new Map(Object.entries(items).map(([, v]) => [v.name, v]));

    // Only show movements for items existing in config.json (venda + ambos + recipe ingredients)
    const dbItems = await pgQuery<{ id: number; name: string; side: string | null }>(
      `select id, name, side from items where name = any($1::text[])`,
      [itemNames],
    );
    const dbIds = dbItems
      .filter((i) => isInventoryVisible(i.side, i.name, itemByName, recipeIngredients))
      .map((i) => i.id);
    if (dbIds.length === 0) return [];

    const params: unknown[] = [data.limit, dbIds];
    let where = "where im.item_id = any($2::int[])";
    if (data.type) {
      params.push(data.type);
      where += ` and im.movement_type = $${params.length}`;
    }
    return pgQuery<LedgerRow>(
      `select im.id, im.movement_type as type, im.item_id, i.name as item_name,
              im.quantity as qty,
              im.member_id, m.display_name as member_name,
              im.created_at, im.notes
       from inventory_movements im
       join items i on i.id = im.item_id
       left join members m on m.id = im.member_id
       ${where}
       order by im.created_at desc
       limit $1`,
      params,
    );
  });
