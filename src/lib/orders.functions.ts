import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { DeliveryScopeSchema, OrderStatusSchema, IdSchema, NotesSchema } from "./security";
import { logAdminAction } from "./logging.functions";
import { resolveItemPrices } from "./pricing.resolver";
import { getSurchargeForItem } from "./tier-pricing.functions";

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

const ORDER_STATUSES = ["pending", "approved", "in_progress", "ready", "fulfilled", "denied", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const TERMINAL_STATUSES = new Set<OrderStatus>(["fulfilled", "denied", "cancelled"]);
const ALLOWED_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ["approved", "denied", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["fulfilled", "cancelled"],
};

type PriceLike = {
  tier_price?: number | null;
  min_sale_price?: number | null;
  purchase_price?: number | null;
};

type OrderIngredient = { name: string; needed: number };
type OutputCategory = { category: string | null; subcategory: string | null };
type RecipeIngredient = { name: string; needed: number; category: string | null; subcategory: string | null };

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function isOrangeCategory(output: OutputCategory): boolean {
  return normalizeText(output.category) === "armas_orange" || normalizeText(output.subcategory) === "armas_orange";
}

function isPiecesIngredient(ingredient: RecipeIngredient): boolean {
  const name = normalizeText(ingredient.name);
  const category = normalizeText(ingredient.category);
  const subcategory = normalizeText(ingredient.subcategory);
  return name === "peca" || name === "pecas" || category === "peca" || category === "pecas" || subcategory === "peca" || subcategory === "pecas";
}

function filterOrderIngredients(output: OutputCategory, ingredients: RecipeIngredient[]): RecipeIngredient[] {
  if (!isOrangeCategory(output)) return ingredients;
  return ingredients.filter(isPiecesIngredient);
}

function priceWithMaterials(prices: PriceLike): number {
  return Number(positive(prices.tier_price) ?? positive(prices.min_sale_price) ?? 0);
}

function priceWithoutMaterials(prices: PriceLike): number {
  return Number(positive(prices.purchase_price) ?? 0);
}

async function getOrderIngredients(itemId: number, output: OutputCategory, quantity: number): Promise<OrderIngredient[]> {
  const dbRows = await pgQuery<{ name: string; qty: number; category: string | null; subcategory: string | null }>(
    `select i.name, i.category, i.subcategory, ri.quantity::float as qty
     from craft_recipes cr
     join recipe_ingredients ri on ri.recipe_id = cr.id
     join items i on i.id = ri.ingredient_item_id
     where cr.item_id = $1
       and coalesce(i.active, true) = true
       and i.deleted_at is null
       and coalesce(ri.quantity, 0) > 0
     order by i.name`,
    [itemId],
  );
  return filterOrderIngredients(output, dbRows.map((row) => ({ name: row.name, category: row.category, subcategory: row.subcategory, needed: Number(row.qty) * quantity })))
    .map((row) => ({ name: row.name, needed: row.needed }));
}

async function insertOrderHistory(orderId: number, oldStatus: string, newStatus: string, changedBy: string, notes?: string | null) {
  try {
    await pgQuery(
      `insert into order_status_history (order_id, old_status, new_status, changed_by, notes, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [orderId, oldStatus, newStatus, changedBy, notes ?? null],
    );
  } catch {
    // History is useful, but missing legacy tables must not block operational flow.
  }
}

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope?: "mine" | "manage"; status?: string | null; statuses?: string[] | null }) => {
    const scope = DeliveryScopeSchema.optional().parse(d?.scope) ?? "mine";
    const status = OrderStatusSchema.optional().nullable().parse(d?.status) ?? null;
    const statusesRaw = z.array(OrderStatusSchema).optional().nullable().parse(d?.statuses);
    const statuses = statusesRaw && statusesRaw.length > 0 ? statusesRaw : null;
    return { scope, status, statuses };
  })
  .handler(async ({ data, context }): Promise<OrderRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const params: unknown[] = [];
    const conds: string[] = [];

    if (data.scope === "mine") {
      if (!me) return [];
      params.push(me.id);
      conds.push(`o.member_id = $${params.length}`);
    } else {
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
              o.total_price::float as dirty_money,
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
  .inputValidator((d: { lines: Array<{ item_id: number; quantity: number }>; notes?: string | null; responsavel_member_id?: number | null; payment_mode?: "materials_money" | "money_only" }) => {
    if (!Array.isArray(d.lines) || d.lines.length === 0) throw new Error("Carrinho vazio");
    if (d.lines.length > 50) throw new Error("Máximo 50 itens por encomenda");
    for (const l of d.lines) {
      if (!Number.isFinite(l.item_id) || l.item_id <= 0) throw new Error("Item inválido");
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) throw new Error("Quantidade inválida");
    }
    if (d.responsavel_member_id == null || !Number.isFinite(d.responsavel_member_id) || d.responsavel_member_id <= 0) {
      throw new Error("Tens de escolher um responsável");
    }
    const paymentMode = d.payment_mode ?? "materials_money";
    if (paymentMode !== "materials_money" && paymentMode !== "money_only") throw new Error("Modo de pagamento inválido");
    return { ...d, payment_mode: paymentMode, notes: NotesSchema.parse(d.notes) };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");

    const responsible = await pgOne<{ id: number }>(
      `select id from members where id = $1 and deleted_at is null and coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')`,
      [data.responsavel_member_id],
    );
    if (!responsible) throw new Error("Responsável inválido");

    const itemIds = data.lines.map((l) => l.item_id);
    const items = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      side: string | null;
      min_sale_price: number | null;
      purchase_price: number | null;
      morador_purchase_price: number | null;
      estimated_value: number | null;
    }>(
      `select id, name, category, subcategory, side,
              min_sale_price::float as min_sale_price,
              purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price,
              estimated_value::float as estimated_value
       from items
       where id = ANY($1::int[])
         and coalesce(active, true) = true
         and deleted_at is null`,
      [itemIds],
    );
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const batchId = crypto.randomUUID();
    const results: { id: number; item_name: string; quantity: number }[] = [];

    for (const line of data.lines) {
      const dbItem = itemMap.get(line.item_id);
      if (!dbItem) throw new Error(`Item não encontrado: ${line.item_id}`);
      if (dbItem.side !== "venda" && dbItem.side !== "ambos") throw new Error(`Esse item não está disponível para encomenda: ${dbItem.name}`);

      const itemSurcharges = await getSurchargeForItem(dbItem.id);
      const itemPrices = resolveItemPrices(dbItem, null, me.tier ?? null, itemSurcharges);
      const withMaterialsUnit = Math.round(priceWithMaterials(itemPrices));
      const withoutMaterialsUnit = Math.round(priceWithoutMaterials(itemPrices));
      const ingredients = await getOrderIngredients(dbItem.id, dbItem, line.quantity);
      const hasMaterials = ingredients.length > 0;
      const effectivePaymentMode = data.payment_mode === "materials_money" && hasMaterials ? "materials_money" : "money_only";
      const unit = effectivePaymentMode === "materials_money" ? withMaterialsUnit : withoutMaterialsUnit;
      if (effectivePaymentMode === "materials_money" && unit <= 0) throw new Error(`Preço com material inválido para ${dbItem.name}. Corrige o item na Gestão de Materiais.`);
      if (effectivePaymentMode === "money_only" && unit <= 0) throw new Error(`Preço sem material inválido para ${dbItem.name}. Corrige o item na Gestão de Materiais.`);

      const total = unit * line.quantity;
      const ingredientsJsonStr = effectivePaymentMode === "materials_money" ? JSON.stringify(ingredients) : null;
      const row = await pgOne<{ id: number }>(
        `insert into orders
           (member_id, item_id, quantity, status, unit_price, total_price, notes, markup_percent, created_at, updated_at, updated_by, responsavel_member_id, ingredients_json, batch_id, dirty_money, payment_mode, material_cost, money_cost)
         values ($1, $2, $3, 'pending', $4, $5, $6, 0, now(), now(), $7, $8, $9, $10, $11, $12, null, $13)
         returning id`,
        [
          me.id,
          line.item_id,
          line.quantity,
          unit,
          total,
          data.notes ?? null,
          `web:${context.userId}`,
          data.responsavel_member_id,
          ingredientsJsonStr,
          batchId,
          total,
          effectivePaymentMode,
          total,
        ],
      );
      if (row) results.push({ id: row.id, item_name: dbItem.name, quantity: line.quantity });
    }

    await logAdminAction(context.supabase, {
      action: "order_created",
      actorId: context.userId,
      actorName: me.display_name ?? "Membro",
      targetType: "order",
      targetId: results.map((r) => r.id).join(","),
      details: `${results.length} encomenda(s) criada(s): ${results.map((r) => `${r.quantity}× ${r.item_name}`).join(", ")}`,
      afterState: { batch_id: batchId, items: results },
    });
    return { ids: results.map((r) => r.id) };
  });

export const transitionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; to: OrderStatus; notes?: string | null }) => z.object({ id: IdSchema, to: OrderStatusSchema, notes: NotesSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    const current = await pgOne<{ status: OrderStatus; member_id: number; item_id: number | null; quantity: number; item_name: string | null; responsavel_member_id: number | null }>(
      `select o.status, o.member_id, o.item_id, o.quantity, i.name as item_name, o.responsavel_member_id
       from orders o
       left join items i on i.id = o.item_id
       where o.id = $1`,
      [data.id],
    );
    if (!current) throw new Error("Encomenda não encontrada");
    if (!me.is_superadmin && current.responsavel_member_id !== me.id) throw new Error("Sem permissão — só o responsável pode tratar este pedido");
    if (TERMINAL_STATUSES.has(current.status)) throw new Error("Esta encomenda já está fechada.");
    if (!(ALLOWED_TRANSITIONS[current.status] ?? []).includes(data.to)) throw new Error("Transição inválida para esta encomenda.");

    if (data.to === "fulfilled" && current.item_id) {
      await pgQuery(
        `insert into inventory_movements (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
         values ('venda_bairrista', $1, $2, $3, 'armazem', $4, $5, now())`,
        [current.item_id, -Math.abs(Number(current.quantity)), current.member_id, `order:${data.id}`, `web:${context.userId}`],
      );
    }

    await pgQuery(
      `update orders set
         status = $2,
         updated_at = now(),
         updated_by = $3,
         delivered_at = case when $2 = 'fulfilled' then now() else delivered_at end,
         resolved_at = case when $2 in ('fulfilled','denied','cancelled') then now() else resolved_at end,
         approved_by = case when $2 = 'approved' and approved_by is null then $3 else approved_by end,
         fulfilled_by = case when $2 = 'fulfilled' then $3 else fulfilled_by end
       where id = $1`,
      [data.id, data.to, `web:${context.userId}`],
    );
    await insertOrderHistory(data.id, current.status, data.to, `web:${context.userId}`, data.notes ?? null);

    const actionMap: Record<string, string> = { approved: "order_approved", denied: "order_denied", fulfilled: "order_fulfilled", cancelled: "order_cancelled", ready: "order_updated", in_progress: "order_updated" };
    await logAdminAction(context.supabase, {
      action: actionMap[data.to] ?? "order_updated",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "order",
      targetId: data.id,
      details: `Encomenda #${data.id} (${current.item_name ?? "?"} × ${current.quantity}) alterada de "${current.status}" para "${data.to}"`,
      afterState: { old_status: current.status, new_status: data.to },
    });

    return { ok: true as const };
  });

type OrderCommentRow = { id: number; order_id: number; author_name: string | null; content: string; created_at: string };

export const listOrderComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: number }) => {
    const id = Number(d.order_id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido");
    return { order_id: id };
  })
  .handler(async ({ data }) => pgQuery<OrderCommentRow>(`select id, order_id, author_name, content, created_at from order_comments where order_id = $1 order by created_at asc limit 200`, [data.order_id]));

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
    const order = await pgOne<{ member_id: number; status: string }>(`select member_id, status from orders where id = $1`, [data.order_id]);
    if (!order) throw new Error("Encomenda não encontrada");
    if (order.member_id !== me.id && !me.is_manager) throw new Error("Sem permissão para comentar nesta encomenda.");
    return pgOne<OrderCommentRow>(
      `insert into order_comments (order_id, author_id, author_name, content, created_at)
       values ($1, $2, $3, $4, now())
       returning id, order_id, author_name, content, created_at`,
      [data.order_id, me.id, me.display_name ?? "Membro", data.content],
    );
  });

export const cancelOwnOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids?: number[]; id?: number }) => {
    const ids = Array.isArray(d.ids) && d.ids.length > 0 ? d.ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0) : d.id != null ? [Number(d.id)] : [];
    if (ids.length === 0) throw new Error("ID inválido");
    return { ids };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    const beforeRows = await pgQuery<{ id: number; status: OrderStatus; member_id: number }>(`select o.id, o.status, o.member_id from orders o where o.id = ANY($1::int[])`, [data.ids]);
    if (beforeRows.length === 0) throw new Error("Encomenda(s) não encontrada(s)");
    if (beforeRows.some((r) => r.member_id !== me.id)) throw new Error("Não podes cancelar encomendas de outrem.");
    const cancelable = beforeRows.filter((r) => !TERMINAL_STATUSES.has(r.status)).map((r) => r.id);
    if (cancelable.length === 0) return { ok: true as const, cancelled: 0 };

    await pgQuery(
      `update orders set status = 'cancelled', updated_at = now(), updated_by = $2, resolved_at = now()
       where id = any($1::int[]) and status not in ('fulfilled','denied','cancelled')`,
      [cancelable, `web:${context.userId}`],
    );
    await Promise.all(beforeRows.filter((r) => cancelable.includes(r.id)).map((r) => insertOrderHistory(r.id, r.status, "cancelled", `web:${context.userId}`, "Cancelado pelo utilizador")));
    return { ok: true as const, cancelled: cancelable.length };
  });
