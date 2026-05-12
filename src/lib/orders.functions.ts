import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { enqueueNotification } from "./notifier.server";

export type OrderRow = {
  id: number;
  member_id: number | null;
  member_name: string | null;
  item_id: number | null;
  item_name: string | null;
  quantity: number;
  status: string;
  total_price: number | null;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
};

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string | null }) => ({ status: d?.status ?? null }))
  .handler(async ({ data }): Promise<OrderRow[]> => {
    const params: unknown[] = [];
    let where = "";
    if (data.status) {
      params.push(data.status);
      where = `where o.status = $${params.length}`;
    }
    return pgQuery<OrderRow>(
      `select o.id, o.member_id, m.display_name as member_name,
              o.item_id, i.name as item_name, o.quantity, o.status,
              o.total_price::float as total_price, o.notes, o.created_at, o.delivered_at
       from orders o
       left join members m on m.id = o.member_id
       left join items i on i.id = o.item_id
       ${where}
       order by o.created_at desc
       limit 200`,
      params
    );
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: number; item_id: number; quantity: number; notes?: string | null }) => {
    if (!Number.isFinite(d.member_id)) throw new Error("Membro inválido");
    if (!Number.isFinite(d.item_id)) throw new Error("Item inválido");
    if (!Number.isFinite(d.quantity) || d.quantity <= 0) throw new Error("Quantidade inválida");
    return d;
  })
  .handler(async ({ data, context }) => {
    const item = await pgOne<{ name: string; price: number | null }>(
      `select name, coalesce(min_sale_price, estimated_value)::float as price from items where id = $1`,
      [data.item_id]
    );
    const unit = item?.price ?? null;
    const total = unit != null ? unit * data.quantity : null;
    const row = await pgOne<{ id: number }>(
      `insert into orders
         (member_id, item_id, quantity, status, unit_price, total_price, notes, created_at, updated_at, updated_by)
       values ($1, $2, $3, 'pending', $4, $5, $6, now(), now(), $7)
       returning id`,
      [data.member_id, data.item_id, data.quantity, unit, total, data.notes ?? null, `web:${context.userId}`]
    );
    await enqueueNotification({
      embed: {
        title: "Nova encomenda",
        description: `**${item?.name ?? "Item"}** × ${data.quantity}`,
        fields: [{ name: "Status", value: "pending", inline: true }],
      },
    });
    return { id: row?.id };
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; status: string; notes?: string | null }) => {
    const allowed = ["pending", "approved", "fulfilled", "cancelled", "delivered"];
    if (!allowed.includes(d.status)) throw new Error("Status inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const before = await pgOne<{ status: string }>(`select status from orders where id = $1`, [data.id]);
    const isDelivered = data.status === "delivered" || data.status === "fulfilled";
    await pgQuery(
      `update orders set
         status = $2,
         updated_at = now(),
         updated_by = $3,
         delivered_at = case when $4 then now() else delivered_at end,
         resolved_at = case when $5 then now() else resolved_at end
       where id = $1`,
      [data.id, data.status, `web:${context.userId}`, isDelivered, data.status !== "pending"]
    );
    await pgQuery(
      `insert into order_status_history (order_id, old_status, new_status, changed_by, notes, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [data.id, before?.status ?? null, data.status, `web:${context.userId}`, data.notes ?? null]
    );
    return { ok: true };
  });
