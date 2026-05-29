import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { IdSchema } from "./security";
import { getSaleItems } from "./config.loader";

// Categorias/subcategorias de armazém derivadas do config.json (evita hardcode)
function getInventoryCategories(): { categories: string[]; subcategories: string[] } {
  const items = getSaleItems();
  const categories = new Set<string>();
  const subcategories = new Set<string>();
  for (const item of Object.values(items)) {
    if (item.category) categories.add(item.category);
    if (item.subcategory) subcategories.add(item.subcategory);
  }
  return {
    categories: Array.from(categories),
    subcategories: Array.from(subcategories),
  };
}

async function gateInventory(supabase: unknown, userId: string) {
  const me = await resolveCurrentMember(supabase as never, userId);
  if (!me?.can_see_inventory) throw new Error("Sem acesso ao armazém.");
  return me;
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
    const { categories, subcategories } = getInventoryCategories();
    return pgQuery<StockRow>(
      `select i.id as item_id, i.name as item_name, i.category, i.subcategory,
              coalesce(ib.balance, 0)::float as qty,
              coalesce(i.purchase_price, 0)::float as unit_price
       from items i
       left join inventory_balance ib on ib.item_id = i.id
       where i.active is not false
         and coalesce(i.deleted_at, 'epoch'::timestamptz) = 'epoch'::timestamptz
         and (
           i.category = any($1::text[])
           or i.subcategory = any($2::text[])
         )
       order by unit_price desc nulls last`,
      [categories, subcategories],
    );
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
    return z.object({
      item_id: IdSchema,
      new_qty: z.number().finite(),
    }).parse(d);
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
  .inputValidator((d: { limit?: number; type?: string | null }) => ({
    limit: Math.min(Math.max(d?.limit ?? 100, 1), 500),
    type: z.string().max(50).nullable().optional().parse(d?.type) ?? null,
  }))
  .handler(async ({ data, context }): Promise<LedgerRow[]> => {
    await gateInventory(context.supabase, context.userId);
    const { categories, subcategories } = getInventoryCategories();
    const params: unknown[] = [data.limit, categories, subcategories];
    let where = "where (i.category = any($2::text[]) or i.subcategory = any($3::text[]))";
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
