import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { notifyUsers, notifyManagers } from "./notifications.server";

export type DeliveryLine = { item_id: number; item_name?: string; qty: number; unit_value?: number };
export type DeliveryRow = {
  id: string;
  requester_member_id: number;
  requester_name: string | null;
  status: string;
  tipo: string;
  lines: DeliveryLine[];
  notes: string;
  total_qty: number;
  total_value: number;
  created_at: string;
  decided_at: string | null;
  decision_reason: string;
};

export const listDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope?: "mine" | "manage" }) => ({ scope: d?.scope ?? "mine" }))
  .handler(async ({ data, context }): Promise<DeliveryRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const params: unknown[] = [];
    let where = "where r.tipo in ('entrega','venda')";
    if (data.scope === "mine") {
      if (!me) return [];
      params.push(me.id);
      where += ` and r.requester_member_id = $${params.length}`;
    } else {
      if (!me?.is_manager) return [];
    }
    return pgQuery<DeliveryRow>(
      `select r.id, r.requester_member_id, m.display_name as requester_name,
              r.status, coalesce(r.tipo, 'entrega') as tipo, r.lines, r.notes,
              r.total_qty, r.total_value::float as total_value,
              r.created_at, r.decided_at, r.decision_reason
       from inventory_delivery_requests r
       left join members m on m.id = r.requester_member_id
       ${where}
       order by r.created_at desc
       limit 200`,
      params
    );
  });

export const createDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lines: { item_id: number; qty: number }[]; notes?: string | null }) => {
    if (!Array.isArray(d.lines) || d.lines.length === 0) throw new Error("Sem linhas");
    for (const l of d.lines) {
      if (!Number.isFinite(l.item_id) || !Number.isFinite(l.qty) || l.qty <= 0) throw new Error("Linha inválida");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    if (!me.discord_id) throw new Error("Membro sem Discord ID");
    // Compute lines with prices (morador price for member submissions when available)
    const itemIds = data.lines.map((l) => l.item_id);
    const items = await pgQuery<{
      id: number; name: string; purchase_price: number | null; morador_purchase_price: number | null;
    }>(
      `select id, name, purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price
       from items where id = any($1::int[])`,
      [itemIds]
    );
    const map = new Map(items.map((i) => [i.id, i]));
    let totalQty = 0;
    let totalValue = 0;
    const enriched: DeliveryLine[] = data.lines.map((l) => {
      const it = map.get(l.item_id);
      const unit = it?.morador_purchase_price ?? it?.purchase_price ?? 0;
      totalQty += l.qty;
      totalValue += unit * l.qty;
      return { item_id: l.item_id, item_name: it?.name ?? "?", qty: l.qty, unit_value: unit };
    });
    const row = await pgOne<{ id: string }>(
      `insert into inventory_delivery_requests
         (id, requester_member_id, requester_discord_id, status, lines, notes, total_qty, total_value, created_by, tipo)
       values (gen_random_uuid(), $1, $2, 'pending', $3::jsonb, $4, $5, $6, $7, 'entrega')
       returning id`,
      [me.id, me.discord_id, JSON.stringify(enriched), data.notes ?? "", totalQty, totalValue, `web:${context.userId}`]
    );
    await notifyManagers(context.supabase, {
      type: "delivery_new",
      title: "Nova entrega de material",
      body: `${me.display_name ?? "Membro"} entregou ${totalQty} itens (€${Math.round(totalValue)})`,
      link: "/entregas",
    });
    return { id: row?.id };
  });

export const decideDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean; reason?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    const status = data.approve ? "approved" : "rejected";
    const before = await pgOne<{ requester_discord_id: string; lines: DeliveryLine[]; status: string }>(
      `select requester_discord_id, lines, status from inventory_delivery_requests where id = $1`,
      [data.id]
    );
    if (!before) throw new Error("Pedido não encontrado");
    if (before.status !== "pending") throw new Error("Já decidido");
    await pgQuery(
      `update inventory_delivery_requests set
         status = $2, decision_by = $3, decision_reason = $4, decided_at = now(), updated_at = now(),
         approver_discord_id = coalesce(approver_discord_id, $5)
       where id = $1`,
      [data.id, status, `web:${context.userId}`, data.reason ?? "", me.discord_id]
    );
    if (data.approve) {
      // post inventory movements: incoming (positive) using allowed type
      for (const l of before.lines) {
        await pgQuery(
          `insert into inventory_movements
             (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
           values ('entrega_bairrista', $1, $2, $3, 'armazem', $4, $5, now())`,
          [l.item_id, l.qty, null, `delivery:${data.id}`, `web:${context.userId}`]
        );
      }
    }
    await notifyUsers(context.supabase, [before.requester_discord_id], {
      type: "delivery_update",
      title: data.approve ? "Entrega aprovada" : "Entrega rejeitada",
      body: data.reason ?? "",
      link: "/entregas",
    });
    return { ok: true };
  });
