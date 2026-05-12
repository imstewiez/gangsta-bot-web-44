import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

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
              coalesce(sum(ib.balance), 0)::float as qty,
              coalesce(i.min_sale_price, i.estimated_value)::float as unit_price
       from items i
       left join inventory_balance ib on ib.item_id = i.id
       where i.active is not false
       group by i.id, i.name, i.category, i.min_sale_price, i.estimated_value
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
      where = `where im.movement_type = $${params.length}`;
    }
    return pgQuery<LedgerRow>(
      `select im.id, im.movement_type as type, im.item_id, i.name as item_name,
              im.quantity as qty,
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

export const listItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return pgQuery<{ id: number; name: string; category: string | null }>(
      `select id, name, category from items where active is not false order by category nulls last, name`
    );
  });

export const listMembersLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return pgQuery<{ id: number; label: string }>(
      `select id, coalesce(display_name, username, nickname, discord_id) as label
       from members where deleted_at is null order by label`
    );
  });

export const createMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    movement_type: string;
    item_id: number;
    quantity: number;
    member_id?: number | null;
    notes?: string | null;
  }) => {
    const allowed = ["entrada", "saida", "ajuste", "consumo", "venda", "entrega"];
    if (!allowed.includes(d.movement_type)) throw new Error("Tipo inválido");
    if (!Number.isFinite(d.item_id)) throw new Error("Item inválido");
    if (!Number.isFinite(d.quantity) || d.quantity === 0) throw new Error("Quantidade inválida");
    return d;
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const row = await pgOne<{ id: number }>(
      `insert into inventory_movements
         (movement_type, item_id, quantity, member_id, notes, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, now())
       returning id`,
      [
        data.movement_type,
        data.item_id,
        data.quantity,
        data.member_id ?? null,
        data.notes ?? null,
        `web:${userId}`,
      ]
    );
    return { id: row?.id ?? null };
  });
