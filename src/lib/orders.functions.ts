import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne, withClient } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { tierMargin } from "./pricing.shared";
import { notifyUsers, notifyManagers } from "./notifications.server";

export type OrderRow = {
  id: number;
  member_id: number | null;
  member_name: string | null;
  item_id: number | null;
  item_name: string | null;
  quantity: number;
  status: string;
  unit_price: number | null;
  total_price: number | null;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
};

const ORDER_STATUSES = [
  "pending",
  "approved",
  "in_progress",
  "ready",
  "fulfilled",
  "denied",
  "cancelled",
] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { scope?: "mine" | "manage"; status?: string | null }) => ({
      scope: d?.scope ?? "mine",
      status: d?.status ?? null,
    }),
  )
  .handler(async ({ data, context }): Promise<OrderRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const params: unknown[] = [];
    const conds: string[] = [];

    if (data.scope === "mine") {
      if (!me) return [];
      params.push(me.id);
      conds.push(`o.member_id = $${params.length}`);
    } else {
      // manage scope: only managers
      if (!me?.is_manager) return [];
    }
    if (data.status) {
      params.push(data.status);
      conds.push(`o.status = $${params.length}`);
    }
    const where = conds.length ? `where ${conds.join(" and ")}` : "";
    return pgQuery<OrderRow>(
      `select o.id, o.member_id, m.display_name as member_name,
              o.item_id, i.name as item_name, o.quantity, o.status,
              o.unit_price::float as unit_price,
              o.total_price::float as total_price,
              o.notes, o.created_at, o.delivered_at
       from orders o
       left join members m on m.id = o.member_id
       left join items i on i.id = o.item_id
       ${where}
       order by o.created_at desc
       limit 200`,
      params,
    );
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { item_id: number; quantity: number; notes?: string | null }) => {
      if (!Number.isFinite(d.item_id)) throw new Error("Item inválido");
      if (!Number.isFinite(d.quantity) || d.quantity <= 0)
        throw new Error("Quantidade inválida");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    const item = await pgOne<{
      name: string;
      side: string | null;
      base: number | null;
    }>(
      `select name, side, min_sale_price::float as base from items where id = $1 and active = true`,
      [data.item_id],
    );
    if (!item) throw new Error("Item não encontrado");
    if (item.side !== "venda")
      throw new Error("Esse item não está disponível para encomenda");
    const margin = tierMargin(me.tier);
    const unit =
      item.base != null ? Math.round(item.base * (1 + margin)) : null;
    const total = unit != null ? unit * data.quantity : null;
    const row = await pgOne<{ id: number }>(
      `insert into orders
         (member_id, item_id, quantity, status, unit_price, total_price, notes, markup_percent, created_at, updated_at, updated_by)
       values ($1, $2, $3, 'pending', $4, $5, $6, $7, now(), now(), $8)
       returning id`,
      [
        me.id,
        data.item_id,
        data.quantity,
        unit,
        total,
        data.notes ?? null,
        margin * 100,
        `web:${context.userId}`,
      ],
    );
    await notifyManagers(context.supabase, {
      type: "order_new",
      title: "Nova encomenda",
      body: `${me.display_name ?? "Membro"} pediu ${data.quantity}× ${item.name}`,
      link: "/encomendas",
    });
    return { id: row?.id };
  });

export const transitionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: number; to: OrderStatus; notes?: string | null }) => {
      if (!ORDER_STATUSES.includes(d.to)) throw new Error("Estado inválido");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    return withClient(async (c) => {
      await c.query("begin");
      try {
        const beforeRes = await c.query(
          `select o.status, o.member_id, o.item_id, o.quantity, i.name as item_name
           from orders o left join items i on i.id = o.item_id where o.id = $1`,
          [data.id],
        );
        const before = beforeRes.rows[0] as
          | {
              status: string;
              member_id: number;
              item_id: number | null;
              item_name: string | null;
              quantity: number;
            }
          | undefined;
        if (!before) throw new Error("Encomenda não encontrada");
        const isFinal = data.to === "fulfilled";
        const isResolved = data.to !== "pending";

        // Stock check + decrement on fulfillment
        if (isFinal && before.status !== "fulfilled" && before.item_id) {
          const balRes = await c.query(
            `select coalesce(balance, 0) as balance from inventory_balance where item_id = $1`,
            [before.item_id],
          );
          const have = Number(
            (balRes.rows[0] as { balance: number } | undefined)?.balance ?? 0,
          );
          if (have < before.quantity) {
            await c.query("rollback");
            return {
              ok: false as const,
              error: `Sem stock que chegue: ${before.item_name ?? "item"} (${have} em casa, ${before.quantity} pedidos)`,
            };
          }
          await c.query(
            `insert into inventory_movements
               (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
             values ('venda_bairrista', $1, $2, $3, 'armazem', $4, $5, now())`,
            [
              before.item_id,
              -before.quantity,
              before.member_id,
              `order:${data.id}`,
              `web:${context.userId}`,
            ],
          );
        }

        await c.query(
          `update orders set status=$2, updated_at=now(), updated_by=$3,
             delivered_at = case when $4 then now() else delivered_at end,
             resolved_at = case when $5 then now() else resolved_at end,
             approved_by = case when $2='approved' and approved_by is null then $3 else approved_by end,
             fulfilled_by = case when $4 then $3 else fulfilled_by end
           where id=$1`,
          [data.id, data.to, `web:${context.userId}`, isFinal, isResolved],
        );
        await c.query(
          `insert into order_status_history (order_id, old_status, new_status, changed_by, notes, created_at)
           values ($1, $2, $3, $4, $5, now())`,
          [
            data.id,
            before.status,
            data.to,
            `web:${context.userId}`,
            data.notes ?? null,
          ],
        );
        await c.query("commit");

        // notify requester (outside transaction)
        const reqProfile = await pgOne<{ discord_id: string | null }>(
          `select discord_id from members where id = $1`,
          [before.member_id],
        );
        if (reqProfile?.discord_id) {
          const STATUS_PT: Record<string, string> = {
            pending: "à espera",
            approved: "aceite pela chefia",
            in_progress: "a ser tratada",
            ready: "pronta a levantar",
            fulfilled: "entregue",
            denied: "recusada",
            cancelled: "cancelada",
          };
          await notifyUsers(context.supabase, [reqProfile.discord_id], {
            type: "order_update",
            title: `Encomenda #${data.id} · ${STATUS_PT[data.to] ?? data.to}`,
            body: `${before.item_name ?? "Item"} — ${STATUS_PT[data.to] ?? data.to}`,
            link: "/encomendas",
          });
        }
        return { ok: true as const };
      } catch (e) {
        await c.query("rollback").catch(() => null);
        throw e;
      }
    });
  });
