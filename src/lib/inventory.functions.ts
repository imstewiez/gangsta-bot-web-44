import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { IdSchema } from "./security";
import { resolveItemPrices } from "./pricing.resolver";

async function gateInventory(supabase: unknown, userId: string) {
  const me = await resolveCurrentMember(supabase as never, userId);
  if (!me?.can_see_inventory) throw new Error("Sem acesso ao armazém.");
  return me;
}

function isInventoryVisible(side: string | null | undefined, recipeIngredientIds: Set<number>, itemId: number): boolean {
  const effectiveSide = side ?? "venda";
  if (effectiveSide === "venda" || effectiveSide === "ambos") return true;
  if (effectiveSide === "compra" && recipeIngredientIds.has(itemId)) return true;
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

async function getInventoryVisibleItems(): Promise<Array<{
  id: number;
  name: string;
  category: string | null;
  subcategory: string | null;
  side: string | null;
  purchase_price: number | null;
  min_sale_price: number | null;
  estimated_value: number | null;
  morador_purchase_price: number | null;
}>> {
  const recipeIngredientIdRows = await pgQuery<{ ingredient_item_id: number }>(
    `select distinct ri.ingredient_item_id
     from recipe_ingredients ri
     join items ing on ing.id = ri.ingredient_item_id
     join craft_recipes cr on cr.id = ri.recipe_id
     join items out_i on out_i.id = cr.item_id
     where ri.ingredient_item_id is not null
       and coalesce(ri.quantity, 0) > 0
       and coalesce(ing.active, true) = true
       and ing.deleted_at is null
       and coalesce(out_i.active, true) = true
       and out_i.deleted_at is null`,
  );
  const recipeIngredientIds = new Set(recipeIngredientIdRows.map((r) => r.ingredient_item_id));

  const dbItems = await pgQuery<{
    id: number;
    name: string;
    category: string | null;
    subcategory: string | null;
    side: string | null;
    purchase_price: number | null;
    min_sale_price: number | null;
    estimated_value: number | null;
    morador_purchase_price: number | null;
  }>(
    `select id, name, category, subcategory, side,
            purchase_price::float as purchase_price,
            min_sale_price::float as min_sale_price,
            estimated_value::float as estimated_value,
            morador_purchase_price::float as morador_purchase_price
     from items
     where coalesce(active, true) = true and deleted_at is null
     order by category, name`,
  );

  return dbItems.filter((i) => isInventoryVisible(i.side, recipeIngredientIds, i.id));
}

export const getStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StockRow[]> => {
    const me = await gateInventory(context.supabase, context.userId);
    const visibleItems = await getInventoryVisibleItems();
    const dbIds = visibleItems.map((i) => i.id);
    if (dbIds.length === 0) return [];

    const balances = await pgQuery<{ item_id: number; balance: number }>(
      `select i.id as item_id, coalesce(ib.balance, 0)::float as balance
       from items i
       left join inventory_balance ib on ib.item_id = i.id
       where i.id = any($1::int[])
       order by i.purchase_price desc nulls last`,
      [dbIds],
    );
    const balanceMap = new Map(balances.map((b) => [b.item_id, b.balance]));

    return visibleItems.map((db) => {
      const prices = resolveItemPrices(db, null);
      return {
        item_id: db.id,
        item_name: db.name,
        category: db.category ?? null,
        subcategory: db.subcategory ?? null,
        qty: balanceMap.get(db.id) ?? 0,
        unit_price: me.is_manager ? (prices.estimated_value ?? prices.purchase_price ?? prices.min_sale_price ?? null) : null,
      };
    });
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
    return z.object({ item_id: IdSchema, new_qty: z.number().finite() }).parse(d);
  })
  .handler(async ({ data, context }) => {
    const me = await gateInventory(context.supabase, context.userId);
    if (!me.is_manager) throw new Error("Sem permissão para ajustar stock.");
    const item = await pgOne<{ id: number }>(
      `select id from items where id = $1 and coalesce(active, true) = true and deleted_at is null`,
      [data.item_id],
    );
    if (!item) throw new Error("Item não encontrado ou inativo.");
    const result = await pgOne<{ sp_adjust_stock: number }>(
      `SELECT public.sp_adjust_stock($1, $2, $3, $4) as sp_adjust_stock`,
      [data.item_id, data.new_qty, `web:${context.userId}`, null],
    );
    return { ok: true, delta: result?.sp_adjust_stock ?? 0 };
  });

export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; type?: string | null }) => ({
    limit: Math.min(Math.max(d?.limit ?? 100, 1), 500),
    type: z.string().max(50).nullable().optional().parse(d?.type) ?? null,
  }))
  .handler(async ({ data, context }): Promise<LedgerRow[]> => {
    await gateInventory(context.supabase, context.userId);
    const visibleItems = await getInventoryVisibleItems();
    const dbIds = visibleItems.map((i) => i.id);
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
