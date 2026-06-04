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
  unit_price?: number | string | null;
  effectivePrice?: number | string;
  basePrice?: number | string;
  lineValue?: number | string;
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
  responsavel_member_id: number | null;
  responsavel_name: string | null;
};

type RawDeliveryRow = Omit<DeliveryRow, "lines"> & { lines: unknown };

const SQL_NORMALIZED_NAME = "translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')";
const RESPONSIBLE_TIERS = ["patrao_di_zona", "kingpin", "manda_chuva"];

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
function normalizeStatus(status: unknown): string {
  const value = normalizeText(status);
  if (["approved", "aprovado", "aprovada", "received", "recebido", "recebida", "comprado", "comprada", "done", "closed", "completed", "concluido", "concluida", "fulfilled", "ready"].includes(value)) return "approved";
  if (["rejected", "recusado", "recusada", "declined", "denied", "cancelled", "canceled", "cancelado", "cancelada"].includes(value)) return "rejected";
  return "pending";
}

async function assertResponsibleExists(memberId: number) {
  const row = await pgOne<{ id: number }>(
    `select id
     from members
     where id = $1
       and deleted_at is null
       and coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')
       and tier = any($2::text[])`,
    [memberId, RESPONSIBLE_TIERS],
  );
  if (!row) throw new Error("Responsável inválido. Só Patrão di Zona, Kingpin ou Manda-Chuva podem ser responsáveis.");
}

async function normalizeDeliveryLines(lines: unknown, strict: boolean, tipo: "entrega" | "venda" = "entrega"): Promise<DeliveryLine[]> {
  if (!Array.isArray(lines)) {
    if (strict) throw new Error("Linhas inválidas");
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
    side: string | null;
    purchase_price: number | null;
    morador_purchase_price: number | null;
  }>(
    `select id, name, side,
            purchase_price::float as purchase_price,
            morador_purchase_price::float as morador_purchase_price
     from items
     where coalesce(active, true) = true
       and deleted_at is null
       and (
         id = any($1::int[])
         or ${SQL_NORMALIZED_NAME} = any($2::text[])
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
    const side = item?.side ?? "compra";
    const allowed = item && (side === "compra" || side === "ambos");

    if (!qty || !item || !allowed) {
      if (strict) throw new Error(`Linha inválida: ${JSON.stringify(line)}`);
      normalized.push({
        item_id: rawId ?? 0,
        item_name: rawName ?? "Item inválido",
        qty: qty ?? 0,
        unit_value: tipo === "entrega" ? 0 : (asOptionalNumber(line.unit_value ?? line.unitValue ?? line.unitPrice ?? line.unit_price ?? line.effectivePrice ?? line.basePrice) ?? 0),
      });
      continue;
    }

    const explicitUnit = asOptionalNumber(line.unit_value ?? line.unitValue ?? line.unitPrice ?? line.unit_price ?? line.effectivePrice ?? line.basePrice);
    const lineValue = asOptionalNumber(line.lineValue);
    const unit = tipo === "entrega" ? 0 : (explicitUnit ?? (lineValue != null ? lineValue / qty : null) ?? item.morador_purchase_price ?? item.purchase_price ?? 0);
    normalized.push({ item_id: item.id, item_name: item.name, qty, unit_value: unit });
  }

  if (strict && normalized.length === 0) throw new Error("Seleciona pelo menos uma linha válida.");
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

async function hydrateDeliveryRow(row: RawDeliveryRow): Promise<DeliveryRow> {
  const tipo = row.tipo === "venda" ? "venda" : "entrega";
  const lines = await normalizeDeliveryLines(row.lines, false, tipo);
  const totals = deliveryTotals(lines);
  return {
    ...row,
    status: normalizeStatus(row.status),
    tipo,
    lines,
    total_qty: row.total_qty || totals.totalQty,
    total_value: tipo === "entrega" ? 0 : (row.total_value || totals.totalValue),
  };
}

export const listDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope?: "mine" | "manage"; statusFilter?: "active" | "archived" }) => ({
    scope: DeliveryScopeSchema.optional().parse(d?.scope) ?? "mine",
    statusFilter: z.enum(["active", "archived"]).optional().parse(d?.statusFilter) ?? "active",
  }))
  .handler(async ({ data, context }): Promise<DeliveryRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (data.scope === "mine" && !me) return [];
    if (data.scope === "manage" && !me?.is_manager) return [];

    if (data.statusFilter === "archived") {
      const params: unknown[] = [];
      let memberFilter = "";
      if (data.scope === "mine") {
        params.push(me!.id);
        memberFilter = `and im.member_id = $${params.length}`;
      }

      const movementRows = await pgQuery<RawDeliveryRow>(
        `select ('movement:' || im.id::text) as id,
                im.member_id as requester_member_id,
                coalesce(m.display_name, m.nickname) as requester_name,
                'approved' as status,
                case when im.movement_type ilike '%venda%' or im.movement_type ilike '%sale%' then 'venda' else 'entrega' end as tipo,
                jsonb_build_array(jsonb_build_object(
                  'item_id', im.item_id,
                  'item_name', coalesce(i.name, 'Item #' || im.item_id::text),
                  'qty', abs(im.quantity),
                  'unit_price', coalesce(i.morador_purchase_price, i.purchase_price, 0)
                )) as lines,
                coalesce(im.notes, '') as notes,
                abs(im.quantity)::float as total_qty,
                abs(im.quantity * coalesce(i.morador_purchase_price, i.purchase_price, 0))::float as total_value,
                im.created_at,
                im.created_at as decided_at,
                'Registo confirmado no inventário' as decision_reason,
                null::int as responsavel_member_id,
                null::text as responsavel_name
         from inventory_movements im
         left join items i on i.id = im.item_id
         left join members m on m.id = im.member_id
         where im.member_id is not null
           and im.item_id is not null
           and (
             im.movement_type in ('entrega_bairrista','entrega_oficial','venda_bairrista')
             or im.movement_type ilike '%entreg%'
             or im.movement_type ilike '%venda%'
             or im.movement_type ilike '%delivery%'
             or im.movement_type ilike '%sale%'
           )
           ${memberFilter}
         order by im.created_at desc
         limit 500`,
        params,
      );
      return Promise.all(movementRows.map((row) => hydrateDeliveryRow(row)));
    }

    const params: unknown[] = [];
    let where = "where coalesce(r.status, 'pending') in ('pending','pendente','open','aberto','em_aberto')";
    if (data.scope === "mine") {
      params.push(me!.id);
      where += ` and r.requester_member_id = $${params.length}`;
    }

    const requestRows = await pgQuery<RawDeliveryRow>(
      `select r.id, r.requester_member_id, m.display_name as requester_name,
              coalesce(r.status, 'pending') as status,
              coalesce(r.tipo, 'entrega') as tipo,
              coalesce(r.lines, '[]'::jsonb) as lines,
              coalesce(r.notes, '') as notes,
              coalesce(r.total_qty, 0)::float as total_qty,
              coalesce(r.total_value, 0)::float as total_value,
              r.created_at, r.decided_at, coalesce(r.decision_reason, '') as decision_reason,
              r.responsavel_member_id,
              coalesce(mr.display_name, mr.nickname) as responsavel_name
       from inventory_delivery_requests r
       left join members m on m.id = r.requester_member_id
       left join members mr on mr.id = r.responsavel_member_id
       ${where}
       order by r.created_at desc
       limit 500`,
      params,
    ).catch(() => []);

    return Promise.all(requestRows.map((row) => hydrateDeliveryRow(row)));
  });

export const createDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lines: { item_id: number; qty: number }[]; notes?: string | null; tipo?: "entrega" | "venda"; responsavel_member_id?: number | null }) => {
    if (!Array.isArray(d.lines) || d.lines.length === 0) throw new Error("Sem linhas");
    for (const l of d.lines) {
      if (!Number.isFinite(l.item_id) || l.item_id <= 0 || !Number.isFinite(l.qty) || l.qty <= 0) throw new Error("Linha inválida");
    }
    if (d.responsavel_member_id == null || !Number.isFinite(d.responsavel_member_id) || d.responsavel_member_id <= 0) throw new Error("Tens de escolher um responsável.");
    return { ...d, tipo: d.tipo === "venda" ? "venda" : "entrega", responsavel_member_id: Number(d.responsavel_member_id) };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    if (!Number.isFinite(me.id) || me.id <= 0) throw new Error("ID de membro inválido");
    if (!me.discord_id) throw new Error("Membro sem Discord ID");
    await assertResponsibleExists(data.responsavel_member_id);

    const enriched = await normalizeDeliveryLines(data.lines, true, data.tipo);
    const { totalQty, totalValue } = deliveryTotals(enriched);

    const row = await pgOne<{ id: string }>(
      `insert into inventory_delivery_requests
         (id, requester_member_id, requester_discord_id, status, lines, notes, total_qty, total_value, created_by, tipo, responsavel_member_id)
       values (gen_random_uuid(), $1, $2, 'pending', $3::jsonb, $4, $5, $6, $7, $8, $9)
       returning id`,
      [me.id, me.discord_id, JSON.stringify(enriched), data.notes ?? "", totalQty, totalValue, `web:${context.userId}`, data.tipo, data.responsavel_member_id],
    );

    await logAdminAction(context.supabase, {
      action: data.tipo === "venda" ? "delivery_request_created" : "delivery_created",
      actorId: context.userId,
      actorName: me.display_name ?? "Membro",
      targetType: "delivery",
      targetId: row?.id ?? "",
      details: `${data.tipo === "venda" ? "Venda" : "Entrega"} de ${totalQty} itens (${enriched.map((l) => `${l.qty}× ${l.item_name ?? `#${l.item_id}`}`).join(", ")})`,
    });
    return { id: row?.id };
  });

export const decideDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean; reason?: string | null }) => z.object({
    id: UuidSchema,
    approve: z.boolean(),
    reason: z.string().max(500).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    const before = await pgOne<{ requester_member_id: number; requester_discord_id: string; tipo: string; lines: unknown; status: string; responsavel_member_id: number | null }>(
      `select requester_member_id, requester_discord_id, coalesce(tipo, 'entrega') as tipo, lines, coalesce(status, 'pending') as status, responsavel_member_id
       from inventory_delivery_requests
       where id = $1`,
      [data.id],
    );
    if (!before) throw new Error("Pedido não encontrado");
    if (!before.responsavel_member_id) throw new Error("Pedido sem responsável. Define um responsável antes de tratar.");
    if (!me.is_superadmin && me.id !== before.responsavel_member_id) throw new Error("Sem permissão — só o responsável pode tratar este pedido");
    if (normalizeStatus(before.status) !== "pending") throw new Error("Já decidido");

    const tipo = before.tipo === "venda" ? "venda" : "entrega";
    const lines = await normalizeDeliveryLines(before.lines, false, tipo);
    const totals = deliveryTotals(lines);
    const nextStatus = data.approve ? "approved" : "rejected";

    await pgQuery(
      `update inventory_delivery_requests
       set status = $2,
           decided_by = $3,
           decided_at = now(),
           decision_reason = $4
       where id = $1`,
      [data.id, nextStatus, context.userId, data.reason ?? ""],
    );

    if (data.approve && lines.length) {
      for (const line of lines) {
        await pgQuery(
          `insert into inventory_movements (item_id, quantity, movement_type, member_id, notes, created_by)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            line.item_id,
            tipo === "venda" ? -line.qty : line.qty,
            tipo === "venda" ? "venda_bairrista" : "entrega_bairrista",
            before.requester_member_id,
            `delivery:${data.id}`,
            `web:${context.userId}`,
          ],
        );
      }
    }

    await logAdminAction(context.supabase, {
      action: tipo === "venda" ? "delivery_request_decided" : "delivery_decided",
      actorId: context.userId,
      actorName: me.display_name ?? "Gestor",
      targetType: "delivery",
      targetId: data.id,
      details: `${tipo === "venda" ? "Venda" : "Entrega"} ${data.approve ? "aprovada" : "recusada"}: ${totals.totalQty} itens`,
    });

    return { ok: true };
  });
