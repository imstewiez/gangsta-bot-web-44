import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne, withClient } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";


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
    (d: { scope?: "mine" | "manage"; status?: string | null; statuses?: string[] | null }) => ({
      scope: d?.scope ?? "mine",
      status: d?.status ?? null,
      statuses: Array.isArray(d?.statuses) && d.statuses.length > 0 ? d.statuses : null,
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
      return { ...d, payment_mode: paymentMode };
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    // Preço de encomenda = min_sale_price direto (já inclui markup da firma na DB)
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

    // Pre-fetch recipes + ingredients for all ordered items
    const recipes = await pgQuery<{
      item_id: number;
      recipe_id: number;
      item_name: string;
      tier: string | null;
      subcategory: string | null;
    }>(
      `select i.id as item_id, r.id as recipe_id, i.name as item_name, r.tier, i.subcategory
       from craft_recipes r join items i on i.id = r.item_id where i.id = ANY($1)`,
      [itemIds],
    );
    const recipeMap = new Map(recipes.map((r) => [r.item_id, r]));

    const paymentMode = (data.payment_mode as string) || 'materials_money';
    const batchId = crypto.randomUUID();
    const results: { id: number; item_name: string; quantity: number }[] = [];
    for (const line of data.lines) {
      const item = itemMap.get(line.item_id);
      if (!item) throw new Error(`Item não encontrado: ${line.item_id}`);
      if (item.side !== "venda")
        throw new Error(`Esse item não está disponível para encomenda: ${item.name}`);

      // Compute ingredients for this line
      const recipe = recipeMap.get(line.item_id);
      let ingredientsJson: Array<{ name: string; needed: number }> | null = null;
      let materialCostPerUnit = 0;
      if (recipe) {
        const isOrange = (recipe.tier === "orange") || (recipe.subcategory === "armas_orange");
        const ings = await pgQuery<{
          name: string;
          quantity: number;
          unit_cost: number;
        }>(
          `select ii.name, ri.quantity, coalesce(ii.purchase_price, ii.estimated_value, 0)::float as unit_cost
           from recipe_ingredients ri
           join items ii on ii.id = ri.ingredient_item_id
           where ri.recipe_id = $1`,
          [recipe.recipe_id],
        );
        // For money_only: compute material cost from ALL ingredients (regardless of orange filter)
        materialCostPerUnit = ings.reduce((sum, ing) => sum + (Number(ing.quantity) * Number(ing.unit_cost ?? 0)), 0);
        // For materials_money: keep the filtered ingredients list
        if (paymentMode === 'materials_money') {
          ingredientsJson = ings
            .filter((ing) => !(isOrange && !ing.name.toLowerCase().includes("peça")))
            .map((ing) => ({ name: ing.name, needed: Number(ing.quantity) * line.quantity }));
        }
      }

      let unit: number | null = null;
      let total: number | null = null;
      let dirtyMoney = 0;
      let materialCost: number | null = null;
      let moneyCost: number | null = null;

      if (paymentMode === 'money_only') {
        const base = item.base ?? 0;
        // unit = base + material_cost_per_unit + 20% of base
        unit = Math.round(base + materialCostPerUnit + base * 0.20);
        total = unit * line.quantity;
        dirtyMoney = 0;
        materialCost = Math.round(materialCostPerUnit * line.quantity);
        moneyCost = total;
        ingredientsJson = [];
      } else {
        // materials_money: usa preço final hardcoded ou DB
        unit = item.base ?? 0;
        total = unit * line.quantity;
        dirtyMoney = (item.base ?? 0) * line.quantity;
      }

      let row: { id: number } | null = null;
      const ingredientsJsonStr = ingredientsJson ? JSON.stringify(ingredientsJson) : null;

      // Try INSERT with new columns first; fallback to old schema if migration not applied
      try {
        row = await pgOne<{ id: number }>(
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
      } catch (insertErr: any) {
        const msg = String(insertErr?.message ?? insertErr);
        if (msg.includes('batch_id') || msg.includes('dirty_money') || msg.includes('responsavel_member_id') || msg.includes('ingredients_json') || msg.includes('payment_mode') || msg.includes('material_cost') || msg.includes('money_cost')) {
          console.warn('[createOrder] Fallback to old schema (migration not applied):', msg);
          row = await pgOne<{ id: number }>(
            `insert into orders
               (member_id, item_id, quantity, status, unit_price, total_price, notes, markup_percent, created_at, updated_at, updated_by)
             values ($1, $2, $3, 'pending', $4, $5, $6, $7, now(), now(), $8)
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
            ],
          );
        } else {
          throw insertErr;
        }
      }
      if (row) {
        results.push({ id: row.id, item_name: item.name, quantity: line.quantity });
      }
    }
    return { ids: results.map((r) => r.id) };
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
          `select o.status, o.member_id, o.item_id, o.quantity, i.name as item_name, o.responsavel_member_id
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
              responsavel_member_id: number | null;
            }
          | undefined;
        if (!before) throw new Error("Encomenda não encontrada");
        if (!me?.is_superadmin && me?.id !== before.responsavel_member_id) {
          throw new Error("Sem permissão — só o responsável pode alterar esta encomenda");
        }
        const isFinal = data.to === "fulfilled";
        const isResolved = data.to !== "pending";

        // Decrement stock on fulfillment (allow negative — no shortage errors)
        if (isFinal && before.status !== "fulfilled" && before.item_id) {
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
        return { ok: true as const };
      } catch (e) {
        await c.query("rollback").catch(() => null);
        throw e;
      }
    });
  });

type OrderCommentRow = {
  id: number;
  order_id: number;
  author_name: string | null;
  content: string;
  created_at: string;
};

async function ensureOrderCommentsTable() {
  await pgQuery(
    `create table if not exists order_comments (
      id serial primary key,
      order_id int not null references orders(id) on delete cascade,
      author_id int references members(id) on delete set null,
      author_name text,
      content text not null,
      created_at timestamptz default now()
    )`,
  );
  await pgQuery(
    `create index if not exists idx_order_comments_order_id on order_comments(order_id)`,
  );
}

export const listOrderComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: number }) => {
    const id = Number(d.order_id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido");
    return { order_id: id };
  })
  .handler(async ({ data }) => {
    await ensureOrderCommentsTable();
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
    await ensureOrderCommentsTable();
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

    return withClient(async (c) => {
      await c.query("begin");
      try {
        const beforeRes = await c.query(
          `select o.id, o.status, o.member_id
           from orders o where o.id = ANY($1)`,
          [data.ids],
        );
        const rows = beforeRes.rows as Array<{
          id: number;
          status: string;
          member_id: number;
        }>;
        if (rows.length === 0) throw new Error("Encomenda(s) não encontrada(s)");

        const notOwn = rows.find((r) => r.member_id !== me.id);
        if (notOwn) throw new Error("Não podes cancelar encomendas de outrem.");

        const finalRows = rows.filter((r) =>
          ["fulfilled", "denied", "cancelled"].includes(r.status),
        );
        // Cancel only non-final rows; ignore already-final ones silently
        const toCancel = rows.filter(
          (r) => !["fulfilled", "denied", "cancelled"].includes(r.status),
        );
        if (toCancel.length === 0) {
          await c.query("commit");
          return { ok: true as const, cancelled: 0 };
        }

        const ids = toCancel.map((r) => r.id);
        await c.query(
          `update orders set status='cancelled', updated_at=now(), updated_by=$2,
             resolved_at = now()
           where id = ANY($1)`,
          [ids, `web:${context.userId}`],
        );
        const values = toCancel
          .map(
            (r, i) =>
              `($${i * 5 + 1}, $${i * 5 + 2}, 'cancelled', $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
          )
          .join(",");
        const flat = toCancel.flatMap((r) => [
          r.id,
          r.status,
          `web:${context.userId}`,
          "Cancelado pelo utilizador",
          new Date().toISOString(),
        ]);
        await c.query(
          `insert into order_status_history (order_id, old_status, new_status, changed_by, notes, created_at)
           values ${values}`,
          flat,
        );
        await c.query("commit");

        return { ok: true as const, cancelled: toCancel.length };
      } catch (e) {
        await c.query("rollback").catch(() => null);
        throw e;
      }
    });
  });
