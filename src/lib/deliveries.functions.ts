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

type RawDeliveryLine = Partial<DeliveryLine> & {
  itemId?: number | string;
  itemName?: string;
  quantity?: number | string;
  amount?: number | string;
  unitValue?: number | string;
  unitPrice?: number | string | null;
  effectivePrice?: number | string;
  basePrice?: number | string;
  lineValue?: number | string;
  category?: string;
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

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function asPositiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asOptionalNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function normalizeDeliveryLines(lines: unknown, strict: boolean): Promise<DeliveryLine[]> {
  if (!Array.isArray(lines)) {
    if (strict) throw new Error("Linhas da entrega inválidas");
    return [];
  }

  const rawLines = lines.filter((l): l is RawDeliveryLine => Boolean(l && typeof l === "object"));
  const ids = new Set<number>();
  const names = new Set<string>();

  for (const line of rawLines) {
    const id = asPositiveNumber(line.item_id ?? line.itemId);
    if (id) ids.add(id);
    const name = line.item_name ?? line.itemName;
    if (name) names.add(normalizeText(name));
  }

  const items = await pgQuery<{
    id: number;
    name: string;
    purchase_price: number | null;
    morador_purchase_price: number | null;
  }>(
    `select id, name,
            purchase_price::float as purchase_price,
            morador_purchase_price::float as morador_purchase_price
     from items
     where coalesce(active, true) = true
       and deleted_at is null
       and (
         id = any($1::int[])
         or lower(unaccent(name)) = any($2::text[])
       )`,
    [Array.from(ids), Array.from(names)],
  );

  const byId = new Map(items.map((item) => [item.id, item]));
  const byName = new Map(items.map((item) => [normalizeText(item.name), item]));
  const normalized: DeliveryLine[] = [];

  for (const line of rawLines) {
    const rawId = asPositiveNumber(line.item_id ?? line.itemId);
    const rawName = line.item_name ?? line.itemName;
    const qty = asPositiveNumber(line.qty ?? line.quantity ?? line.amount);
    const item = (rawId ? byId.get(rawId) : undefined) ?? (rawName ? byName.get(normalizeText(rawName)) : undefined);

    if (!qty || !item) {
      if (strict) {
        throw new Error(`Linha de entrega inválida: ${JSON.stringify(line)}`);
      }
      normalized.push({
        item_id: rawId ?? 0,
        item_name: rawName ?? "Item inválido",
        qty: qty ?? 0,
        unit_value: asOptionalNumber(line.unit_value ?? line.unitValue ?? line.unitPrice ?? line.effectivePrice ?? line.basePrice) ?? 0,
      });
      continue;
    }

    const explicitUnit = asOptionalNumber(line.unit_value ?? line.unitValue ?? line.unitPrice ?? line.effectivePrice ?? line.basePrice);
    const lineValue = asOptionalNumber(line.lineValue);
    const unit = explicitUnit ?? (lineValue != null ? lineValue / qty : null) ?? item.morador_purchase_price ?? item.purchase_price ?? 0;

    normalized.push({
      item_id: item.id,
      item_name: item.name,
      qty,
      unit_value: unit,
    });
  }

  return normalized;
}

function deliveryTotals(lines: DeliveryLine[]) {
  return lines.reduce(
    (acc, line) => {
      acc.totalQty += line.qty;
      acc.totalValue += line.qty * (line.unit_value ?? 0);
      return acc;
    },
    { totalQty: 0, totalValue: 0 },
  );
}

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

    const rows = await pgQuery<Omit<DeliveryRow, "lines"> & { lines: unknown }>(
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

    return Promise.all(rows.map(async (row) => {
      const lines = await normalizeDeliveryLines(row.lines, false);
      const totals = deliveryTotals(lines);
      return {
        ...row,
        lines,
        total_qty: row.total_qty || totals.totalQty,
        total_value: row.total_value || totals.totalValue,
      };
    }));
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
      if (!Array.isArray(d.lines) || d.lines.length === 0) throw new Error("Sem linhas");
      for (const l of d.lines) {
        if (!Number.isFinite(l.item_id) || !Number.isFinite(l.qty) || l.qty <= 0) throw new Error("Linha inválida");
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

    const enriched = await normalizeDeliveryLines(data.lines, true);
    const { totalQty, totalValue } = deliveryTotals(enriched);

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
      details: `${data.tipo === "venda" ? "Venda" : "Entrega"} de ${totalQty} items (${enriched.map((l) => `${l.qty}× ${l.item_name ?? `#${l.item_id}`}`).join(", ")})`,
    });
    return { id: row?.id };
  });

export const decideDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: string; approve: boolean; reason?: string | null }) => z.object({
      id: UuidSchema,
      approve: z.boolean(),
      reason: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    const before = await pgOne<{
      requester_member_id: number;
      requester_discord_id: string;
      tipo: string;
      lines: unknown;
      status: string;
      responsavel_member_id: number | null;
    }>(
      `select requester_member_id, requester_discord_id, tipo, lines, status, responsavel_member_id
       from inventory_delivery_requests
       where id = $1`,
      [data.id],
    );
    if (!before) throw new Error("Pedido não encontrado");
    if (!me.is_superadmin && me.id !== before.responsavel_member_id) throw new Error("Sem permissão — só o responsável pode tratar este pedido");
    if (before.status !== "pending") throw new Error("Já decidido");

    if (data.approve) {
      const normalizedLines = await normalizeDeliveryLines(before.lines, true);
      const { totalQty, totalValue } = deliveryTotals(normalizedLines);

      // Normalize legacy delivery payloads before the stored procedure reads the
      // request. Old rows may use itemId/quantity/itemName while the SP expects
      // canonical item_id/qty/item_name.
      await pgQuery(
        `update inventory_delivery_requests
         set lines = $2::jsonb, total_qty = $3, total_value = $4, updated_at = now()
         where id = $1 and status = 'pending'`,
        [data.id, JSON.stringify(normalizedLines), totalQty, totalValue],
      );

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
        [data.id, `web:${context.userId}`, data.reason ?? "", me.discord_id],
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
