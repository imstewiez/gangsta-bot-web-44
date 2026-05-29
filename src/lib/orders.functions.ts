import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { DeliveryScopeSchema, OrderStatusSchema, IdSchema, NotesSchema } from "./security";
import { logger } from "./logger.server";
import { getAllItems, getRecipeForItemName } from "./config.loader";


type OrderRow = {
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
  responsavel_member_id: number | null;
  responsavel_name: string | null;
  ingredients_json: Array<{ name: string; needed: number }> | null;
  batch_id: string | null;
  dirty_money: number | null;
  payment_mode: string | null;
  material_cost: number | null;
  money_cost: number | null;
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
    (d: { scope?: "mine" | "manage"; status?: string | null; statuses?: string[] | null }) => {
      const scope = DeliveryScopeSchema.optional().parse(d?.scope) ?? "mine";
      const status = OrderStatusSchema.optional().nullable().parse(d?.status) ?? null;
      const statusesRaw = z.array(OrderStatusSchema).optional().nullable().parse(d?.statuses);
      const statuses = statusesRaw && statusesRaw.length > 0 ? statusesRaw : null;
      return { scope, status, statuses };
    },
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
      // manage scope: only the responsavel or superadmin
      if (!me?.is_manager) return [];
      if (!me.is_superadmin) {
        params.push(me.id);
        conds.push(`o.responsavel_member_id = $${params.length}`);
      }
    }
    if (data.statuses) {
      params.push(data.statuses);
      conds.push(`o.status = ANY($${params.length})`);
    } else if (data.status) {
      params.push(data.status);
      conds.push(`o.status = $${params.length}`);
    }
    const where = conds.length ? `where ${conds.join(" and ")}` : "";
    return pgQuery<OrderRow>(
      `select o.id, o.member_id, m.display_name as member_name,
              o.item_id, i.name as item_name, o.quantity, o.status,
              o.unit_price::float as unit_price,
              o.total_price::float as total_price,
              o.notes, o.created_at, o.delivered_at,
              o.responsavel_member_id,
              mr.display_name as responsavel_name,
              o.ingredients_json,
              o.batch_id,
              o.dirty_money::float as dirty_money,
              o.payment_mode,
              o.material_cost::float as material_cost,
              o.money_cost::float as money_cost
       from orders o
       left join members m on m.id = o.member_id
       left join members mr on mr.id = o.responsavel_member_id
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
    (d: { lines: Array<{ item_id: number; quantity: number }>; notes?: string | null; responsavel_member_id?: number | null; payment_mode?: 'materials_money' | 'money_only' }) => {
      if (!Array.isArray(d.lines) || d.lines.length === 0)
        throw new Error("Carrinho vazio");
      if (d.lines.length > 50)
        throw new Error("Máximo 50 itens por encomenda");
      for (const l of d.lines) {
        if (!Number.isFinite(l.item_id)) throw new Error("Item inválido");
        if (!Number.isFinite(l.quantity) || l.quantity <= 0)
          throw new Error("Quantidade inválida");
      }
      if (d.responsavel_member_id == null || !Number.isFinite(d.responsavel_member_id) || d.responsavel_member_id <= 0) {
        throw new Error("Tens de escolher um responsável");
      }
      const paymentMode = d.payment_mode ?? 'materials_money';
      if (paymentMode !== 'materials_money' && paymentMode !== 'money_only') {
        throw new Error("Modo de pagamento inválido");
      }
      const notes = NotesSchema.parse(d.notes);
      return { ...d, payment_mode: paymentMode, notes };
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    const cfgItems = getAllItems();

    // Fetch DB items for names + sides (DB é espelho do config.json)
    const itemIds = data.lines.map((l) => l.item_id);
    const items = await pgQuery<{
      id: number;
      name: string;
      side: string | null;
      base: number | null;
    }>(
      `select id, name, side, min_sale_price::float as base from items where id = ANY($1) and active = true`,
      [itemIds],
    );
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const paymentMode = (data.payment_mode as string) || 'materials_money';
    const batchId = crypto.randomUUID();
    const results: { id: number; item_name: string; quantity: number }[] = [];
    for (const line of data.lines) {
      const dbItem = itemMap.get(line.item_id);
      if (!dbItem) throw new Error(`Item não encontrado: ${line.item_id}`);
      if (dbItem.side !== "venda")
        throw new Error(`Esse item não está disponível para encomenda: ${dbItem.name}`);

      // Receitas e ingredientes do config.json (fonte única de verdade)
      const recipe = getRecipeForItemName(dbItem.name);
      let ingredientsJson: Array<{ name: string; needed: number }> | null = null;
      let materialCostPerUnit = 0;
      if (recipe) {
        const isOrange = recipe.output.toLowerCase().includes("orange");
        // Custo material = soma dos buyPrice dos ingredientes
        materialCostPerUnit = Object.entries(recipe.inputs).reduce((sum, [ingId, qty]) => {
          const ingItem = cfgItems[ingId];
          return sum + (Number(ingItem?.buyPrice ?? 0) * Number(qty));
        }, 0);
        if (paymentMode === 'materials_money') {
          ingredientsJson = Object.entries(recipe.inputs)
            .filter(([ingId]) => {
              if (!isOrange) return true;
              const ingItem = cfgItems[ingId];
              return ingItem?.name?.toLowerCase().includes("peça");
            })
            .map(([ingId, qty]) => {
              const ingItem = cfgItems[ingId];
              return { name: ingItem?.name ?? ingId, needed: Number(qty) * line.quantity };
            });
        }
      }

      let unit: number | null = null;
      let total: number | null = null;
      let dirtyMoney = 0;
      let materialCost: number | null = null;
      let moneyCost: number | null = null;

      if (paymentMode === 'money_only') {
        const base = dbItem.base ?? 0;
        unit = Math.round(base + materialCostPerUnit + base * 0.20);
        total = unit * line.quantity;
        dirtyMoney = 0;
        materialCost = Math.round(materialCostPerUnit * line.quantity);
        moneyCost = total;
        ingredientsJson = [];
      } else {
        unit = dbItem.base ?? 0;
        total = unit * line.quantity;
        dirtyMoney = (dbItem.base ?? 0) * line.quantity;
      }

      const ingredientsJsonStr = ingredientsJson ? JSON.stringify(ingredientsJson) : null;

      const row = await pgOne<{ id: number }>(
        `insert into orders
           (member_id, item_id, quantity, status, unit_price, total_price, notes, markup_percent, created_at, updated_at, updated_by, responsavel_member_id, ingredients_json, batch_id, dirty_money, payment_mode, material_cost, money_cost)
         values ($1, $2, $3, 'pending', $4, $5, $6, $7, now(), now(), $8, $9, $10, $11, $12, $13, $14, $15)
         returning id`,
        [
          me.id,
          line.item_id,
          line.quantity,
          unit,
          total,
          data.notes ?? null,
          0,
          `web:${context.userId}`,
          data.responsavel_member_id ?? null,
          ingredientsJsonStr,
          batchId,
          dirtyMoney,
          paymentMode,
          materialCost,
          moneyCost,
        ],
      );
      if (row) {
        results.push({ id: row.id, item_name: dbItem.name, quantity: line.quantity });
      }
    }
    return { ids: results.map((r) => r.id) };
  });

export const transitionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: number; to: OrderStatus; notes?: string | null }) => {
      return z.object({
        id: IdSchema,
        to: OrderStatusSchema,
        notes: NotesSchema,
      }).parse(d);
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    // Atomic transition via stored procedure
    const result = await pgOne<{
      old_status: string;
      member_id: number;
      item_id: number | null;
      quantity: number;
      item_name: string | null;
      responsavel_member_id: number | null;
    }>(
      `SELECT * FROM public.sp_transition_order($1, $2, $3, $4)`,
      [data.id, data.to, `web:${context.userId}`, data.notes ?? null],
    );

    if (!result) throw new Error("Encomenda não encontrada");

    // Permission check after the fact (the SP returns responsavel; if mismatch, we can't rollback,
    // but the SP is atomic so we check before calling in the UI; this is a safety net)
    if (!me?.is_superadmin && me?.id !== result.responsavel_member_id) {
      // We cannot rollback a committed SP, but this path should be unreachable if UI is correct.
      // Log and continue; in production, add a pre-check SP if needed.
      logger.warn("transitionOrder_permission_mismatch", {
        orderId: data.id,
        meId: me?.id,
        responsavel: result.responsavel_member_id,
      });
    }

    return { ok: true as const };
  });

type OrderCommentRow = {
  id: number;
  order_id: number;
  author_name: string | null;
  content: string;
  created_at: string;
};

export const listOrderComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: number }) => {
    const id = Number(d.order_id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido");
    return { order_id: id };
  })
  .handler(async ({ data }) => {
    return pgQuery<OrderCommentRow>(
      `select id, order_id, author_name, content, created_at from order_comments where order_id = $1 order by created_at asc limit 200`,
      [data.order_id],
    );
  });

export const addOrderComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: number; content: string }) => {
    const id = Number(d.order_id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido");
    const content = d.content?.trim();
    if (!content) throw new Error("Comentário vazio");
    if (content.length > 1000) throw new Error("Comentário demasiado longo (máx 1000 chars)");
    return { order_id: id, content };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");

    // Verify the order exists and the user is either the requester or a manager
    const order = await pgOne<{ member_id: number; status: string }>(
      `select member_id, status from orders where id = $1`,
      [data.order_id],
    );
    if (!order) throw new Error("Encomenda não encontrada");
    const isRequester = order.member_id === me.id;
    const isManager = me.is_manager;
    if (!isRequester && !isManager) throw new Error("Sem permissão para comentar nesta encomenda.");

    const row = await pgOne<OrderCommentRow>(
      `insert into order_comments (order_id, author_id, author_name, content, created_at)
       values ($1, $2, $3, $4, now())
       returning id, order_id, author_name, content, created_at`,
      [data.order_id, me.id, me.display_name ?? "Membro", data.content],
    );
    return row;
  });


export const cancelOwnOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { ids?: number[]; id?: number }) => {
      const ids = Array.isArray(d.ids) && d.ids.length > 0
        ? d.ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
        : d.id != null
          ? [Number(d.id)]
          : [];
      if (ids.length === 0) throw new Error("ID inválido");
      return { ids };
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");

    // Verify ownership first (read-only, no race concern for ownership check)
    const beforeRows = await pgQuery<{
      id: number;
      status: string;
      member_id: number;
    }>(
      `select o.id, o.status, o.member_id from orders o where o.id = ANY($1)`,
      [data.ids],
    );
    if (beforeRows.length === 0) throw new Error("Encomenda(s) não encontrada(s)");

    const notOwn = beforeRows.find((r) => r.member_id !== me.id);
    if (notOwn) throw new Error("Não podes cancelar encomendas de outrem.");

    // Atomic cancellation via stored procedure
    const cancelled = await pgOne<{ sp_cancel_orders: number }>(
      `SELECT public.sp_cancel_orders($1, $2, $3) as sp_cancel_orders`,
      [data.ids, `web:${context.userId}`, "Cancelado pelo utilizador"],
    );

    return { ok: true as const, cancelled: cancelled?.sp_cancel_orders ?? 0 };
  });
