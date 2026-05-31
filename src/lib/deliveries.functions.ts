import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { DeliveryScopeSchema, UuidSchema } from "./security";
import { logAdminAction } from "./logging.functions";


type DeliveryLine = {
  item_id: number;
  item_name?: string;
  qty: number;
  unit_value?: number;
};
type DeliveryRow = {
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
  .inputValidator((d: { scope?: "mine" | "manage" }) => ({
    scope: DeliveryScopeSchema.optional().parse(d?.scope) ?? "mine",
  }))
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
      if (!me.is_superadmin) {
        params.push(me.id);
        where += ` and r.responsavel_member_id = $${params.length}`;
      }
    }
    const rows = await pgQuery<DeliveryRow>(
      `select r.id, r.requester_member_id, m.display_name as requester_name,
              r.status, coalesce(r.tipo, 'entrega') as tipo, r.lines, r.notes,
              r.total_qty, r.total_value::float as total_value,
              r.created_at, r.decided_at, r.decision_reason
       from inventory_delivery_requests r
       left join members m on m.id = r.requester_member_id
       ${where}
       order by r.created_at desc
       limit 200`,
      params,
    );

    // Enrich lines with item names
    const allItemIds = new Set<number>();
    for (const r of rows) {
      for (const l of r.lines) {
        if (l.item_id) allItemIds.add(l.item_id);
      }
    }
    if (allItemIds.size > 0) {
      const items = await pgQuery<{ id: number; name: string }>(
        `select id, name from items where id = any($1::int[])`,
        [Array.from(allItemIds)],
      );
      const nameMap = new Map(items.map((i) => [i.id, i.name]));
      for (const r of rows) {
        for (const l of r.lines) {
          if (!l.item_name && l.item_id) {
            l.item_name = nameMap.get(l.item_id) ?? undefined;
          }
        }
      }
    }

    return rows;
  });

export const createDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      lines: { item_id: number; qty: number }[];
      notes?: string | null;
      tipo?: "entrega" | "venda";
      responsavel_member_id?: number | null;
    }) => {
      if (!Array.isArray(d.lines) || d.lines.length === 0)
        throw new Error("Sem linhas");
      for (const l of d.lines) {
        if (
          !Number.isFinite(l.item_id) ||
          !Number.isFinite(l.qty) ||
          l.qty <= 0
        )
          throw new Error("Linha inválida");
      }
      if (d.responsavel_member_id != null && (!Number.isFinite(d.responsavel_member_id) || d.responsavel_member_id <= 0)) {
        throw new Error("Responsável inválido");
      }
      return { ...d, tipo: d.tipo === "venda" ? "venda" : "entrega" };
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    if (!Number.isFinite(me.id) || me.id <= 0) throw new Error("ID de membro inválido");
    if (!me.discord_id) throw new Error("Membro sem Discord ID");
    const itemIds = data.lines.map((l) => l.item_id);
    const items = await pgQuery<{
      id: number;
      name: string;
      purchase_price: number | null;
      morador_purchase_price: number | null;
    }>(
      `select id, name, purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price
       from items where id = any($1::int[])`,
      [itemIds],
    );
    const map = new Map(items.map((i) => [i.id, i]));
    let totalQty = 0;
    let totalValue = 0;
    const enriched: DeliveryLine[] = data.lines.map((l) => {
      const it = map.get(l.item_id);
      const unit = it?.morador_purchase_price ?? it?.purchase_price ?? 0;
      totalQty += l.qty;
      totalValue += unit * l.qty;
      return {
        item_id: l.item_id,
        item_name: it?.name ?? "?",
        qty: l.qty,
        unit_value: unit,
      };
    });
    const row = await pgOne<{ id: string }>(
      `insert into inventory_delivery_requests
         (id, requester_member_id, requester_discord_id, status, lines, notes, total_qty, total_value, created_by, tipo, responsavel_member_id)
       values (gen_random_uuid(), $1, $2, 'pending', $3::jsonb, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        me.id,
        me.discord_id,
        JSON.stringify(enriched),
        data.notes ?? "",
        totalQty,
        totalValue,
        `web:${context.userId}`,
        data.tipo,
        data.responsavel_member_id ?? null,
      ],
    );
    await logAdminAction(context.supabase, {
      action: data.tipo === "venda" ? "delivery_request_created" : "delivery_created",
      actorId: context.userId,
      actorName: me.display_name ?? "Membro",
      targetType: "delivery",
      targetId: row?.id ?? "",
      details: `${data.tipo === "venda" ? "Venda" : "Entrega"} de ${totalQty} items (${data.lines.map((l) => `${l.qty}× #${l.item_id}`).join(", ")})`,
    });
    return { id: row?.id };
  });

export const decideDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: string; approve: boolean; reason?: string | null }) => {
      return z.object({
        id: UuidSchema,
        approve: z.boolean(),
        reason: z.string().max(500).nullable().optional(),
      }).parse(d);
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    const before = await pgOne<{
      requester_member_id: number;
      requester_discord_id: string;
      tipo: string;
      lines: DeliveryLine[];
      status: string;
      responsavel_member_id: number | null;
    }>(
      `select requester_member_id, requester_discord_id, tipo, lines, status, responsavel_member_id
       from inventory_delivery_requests
       where id = $1`,
      [data.id],
    );
    if (!before) throw new Error("Pedido não encontrado");
    if (!me.is_superadmin && me.id !== before.responsavel_member_id) {
      throw new Error("Sem permissão — só o responsável pode tratar este pedido");
    }
    if (before.status !== "pending") throw new Error("Já decidido");

    if (data.approve) {
      // A stored procedure already locks the request, marks it as approved,
      // inserts the inventory movements and updates member stats atomically.
      // Do not pre-update the status here, otherwise the procedure sees a
      // non-pending request and raises "Já decidido".
      await pgQuery(
        `SELECT public.sp_approve_delivery($1, $2, $3)`,
        [data.id, `web:${context.userId}`, me.discord_id],
      );
    } else {
      const rejected = await pgOne<{ id: string }>(
        `update inventory_delivery_requests set
           status = 'rejected', decision_by = $2, decision_reason = $3,
           decided_at = now(), updated_at = now(),
           approver_discord_id = coalesce(approver_discord_id, $4)
         where id = $1 and status = 'pending'
         returning id`,
        [
          data.id,
          `web:${context.userId}`,
          data.reason ?? "",
          me.discord_id,
        ],
      );
      if (!rejected) throw new Error("Já decidido");
    }

    await logAdminAction(context.supabase, {
      action: data.approve ? "delivery_approved" : "delivery_rejected",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "delivery",
      targetId: data.id,
      details: `${data.approve ? "Aprovada" : "Recusada"} ${before.tipo === "venda" ? "venda" : "entrega"} de ${before.requester_member_id}${data.reason ? " (" + data.reason + ")" : ""}`,
    });

    return { ok: true };
  });
