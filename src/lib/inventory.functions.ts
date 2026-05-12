import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";

export type StockRow = {
  item_id: number;
  item_name: string;
  category: string | null;
  qty: number;
  unit_price: number | null;
};

export const getStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<StockRow[]> => {
    return pgQuery<StockRow>(
      `select i.id as item_id, i.name as item_name, i.category,
              coalesce(sum(ib.qty), 0)::float as qty,
              i.unit_price::float as unit_price
       from items i
       left join inventory_balance ib on ib.item_id = i.id
       group by i.id, i.name, i.category, i.unit_price
       order by i.category nulls last, i.name`
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

export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; type?: string | null }) => ({
    limit: Math.min(Math.max(d?.limit ?? 100, 1), 500),
    type: d?.type ?? null,
  }))
  .handler(async ({ data }): Promise<LedgerRow[]> => {
    const params: unknown[] = [data.limit];
    let where = "";
    if (data.type) {
      params.push(data.type);
      where = `where im.type = $${params.length}`;
    }
    return pgQuery<LedgerRow>(
      `select im.id, im.type, im.item_id, i.name as item_name, im.qty,
              im.member_id, m.display_name as member_name,
              im.created_at, im.notes
       from inventory_movements im
       left join items i on i.id = im.item_id
       left join members m on m.id = im.member_id
       ${where}
       order by im.created_at desc
       limit $1`,
      params
    );
  });
