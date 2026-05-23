import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne, withClient } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
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
    const bodyLines = results.map((r) => `${r.quantity}× ${r.item_name}`).join(", ");
    await notifyManagers(context.supabase, {
      type: "order_new",
      title: "Nova encomenda",
      body: `${me.display_name ?? "Membro"} pediu: ${bodyLines}`,
      link: "/entregas",
    });
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
            link: "/entregas",
          });
        }
        return { ok: true as const };
      } catch (e) {
        await c.query("rollback").catch(() => null);
        throw e;
      }
    });
  });
